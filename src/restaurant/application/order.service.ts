import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { OrderEntity } from '../domain/order.entity';
import { OrderItemEntity } from '../domain/order-item.entity';
import { TableEntity } from '../domain/table.entity';
import { RestaurantStaffEntity } from '../domain/restaurant-staff.entity';
import { ProductEntity } from '../domain/product.entity';
import { CreateOrderDto } from '../api/dto/create-order.dto';
import { PrintReceiptDto } from '../api/dto/print-receipt.dto';
import { OrdersGateway } from '../api/orders.gateway';
import { CashShiftService } from './cash-shift.service';

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(OrderEntity)
    private readonly orderRepo: Repository<OrderEntity>,
    @InjectRepository(OrderItemEntity)
    private readonly itemRepo: Repository<OrderItemEntity>,
    @InjectRepository(TableEntity)
    private readonly tableRepo: Repository<TableEntity>,
    @InjectRepository(RestaurantStaffEntity)
    private readonly staffRepo: Repository<RestaurantStaffEntity>,
    @InjectRepository(ProductEntity)
    private readonly productRepo: Repository<ProductEntity>,
    private readonly ordersGateway: OrdersGateway,
    private readonly cashShiftService: CashShiftService,
  ) {}

  /** Sipariş kalemlerine ürünün kategori UUID'sini ekler (print-agent kategori->yazıcı eşlemesi için). */
  private async attachCategoryIdsToItems(
    items: Array<{ productId?: string } & Record<string, unknown>>,
    restaurantId: string,
  ): Promise<void> {
    const ids = [...new Set(items.map((i) => i.productId).filter(Boolean))] as string[];
    if (!ids.length) return;
    const products = await this.productRepo.find({
      where: { id: In(ids) },
      relations: ['category'],
    });
    const map = new Map<string, string>();
    for (const p of products) {
      if (p.category?.restaurantId === restaurantId) {
        map.set(p.id, p.categoryId);
      }
    }
    for (const item of items) {
      const pid = item.productId;
      if (pid && map.has(pid)) {
        item.categoryId = map.get(pid);
      }
    }
  }

  async findByRestaurant(restaurantId: string, tableId?: string): Promise<OrderEntity[]> {
    const qb = this.orderRepo
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.items', 'items')
      .where('o.restaurant_id = :restaurantId', { restaurantId })
      .andWhere('o.status = :status', { status: 'active' })
      .orderBy('o.created_at', 'DESC');
    if (tableId) qb.andWhere('o.table_id = :tableId', { tableId });
    return qb.getMany();
  }

  async findOne(id: string, restaurantId: string): Promise<OrderEntity> {
    const o = await this.orderRepo.findOne({
      where: { id, restaurantId },
      relations: ['items'],
    });
    if (!o) throw new NotFoundException('Order not found');
    return o;
  }

  async create(restaurantId: string, dto: CreateOrderDto): Promise<OrderEntity> {
    await this.cashShiftService.requireCurrent(restaurantId);
    const order = this.orderRepo.create({
      restaurantId,
      tableId: dto.tableId,
      userId: dto.userId ?? null,
      status: 'active',
    });
    const saved = await this.orderRepo.save(order) as OrderEntity;
    const items = dto.items.map((i) =>
      this.itemRepo.create({
        orderId: saved.id,
        productId: i.productId,
        productName: i.productName,
        price: i.price,
        quantity: i.quantity,
        note: i.note,
        status: 'sent',
      }),
    );
    await this.itemRepo.save(items);
    const created = await this.findOne(saved.id, restaurantId);
    const [table, waiter] = await Promise.all([
      this.tableRepo.findOne({ where: { id: dto.tableId, restaurantId } }),
      dto.userId ? this.staffRepo.findOne({ where: { id: dto.userId, restaurantId } }) : Promise.resolve(null),
    ]);
    const payload = {
      ...JSON.parse(JSON.stringify(created)),
      restaurantId,
      tableName: table?.name ?? null,
      waiterName: waiter?.name ?? null,
    } as Record<string, unknown>;
    const pItems = payload.items as Array<{ productId?: string } & Record<string, unknown>> | undefined;
    if (pItems?.length) {
      await this.attachCategoryIdsToItems(pItems, restaurantId);
    }
    this.ordersGateway.emitOrderCreated(restaurantId, payload);
    return created;
  }

  /** Move all active orders from one table to another (merge/transfer). */
  async moveTable(
    restaurantId: string,
    fromTableId: string,
    toTableId: string,
  ): Promise<{ moved: number }> {
    if (fromTableId === toTableId) return { moved: 0 };
    const [fromTable, toTable] = await Promise.all([
      this.tableRepo.findOne({ where: { id: fromTableId, restaurantId } }),
      this.tableRepo.findOne({ where: { id: toTableId, restaurantId } }),
    ]);
    if (!fromTable || !toTable) {
      throw new NotFoundException('Table not found');
    }
    if (fromTable.status === 'checkout' || toTable.status === 'checkout') {
      throw new BadRequestException('Hesap kesimindeki masa tasinamaz');
    }
    const result = await this.orderRepo.update(
      { restaurantId, tableId: fromTableId, status: 'active' },
      { tableId: toTableId },
    );
    const moved = result.affected ?? 0;
    if (moved > 0) {
      this.ordersGateway.emitOrdersMoved(restaurantId, { fromTableId, toTableId });
      this.ordersGateway.emitOrdersUpdated(restaurantId);
    }
    return { moved };
  }

  /** Hesap kapat: masadaki tüm active siparişleri closed yapar (panel/terminal anlık senkron). */
  async closeTable(restaurantId: string, tableId: string): Promise<{ closed: number }> {
    const result = await this.orderRepo.update(
      { restaurantId, tableId, status: 'active' },
      { status: 'closed' },
    );
    const closed = result.affected ?? 0;
    if (closed > 0) {
      this.ordersGateway.emitOrdersUpdated(restaurantId);
    }
    return { closed };
  }

  /**
   * Konsolide kasa fişi: aynı ürün adı + birim fiyat tek satırda toplanır; not alanı düşürülür.
   */
  private aggregateConsolidatedReceiptLines(
    lines: Array<{
      productName: string;
      quantity: number;
      price: number;
      note?: string;
      productId?: string;
      categoryId?: string;
    }>,
  ): Array<{
    productName: string;
    quantity: number;
    price: number;
    productId?: string;
    categoryId?: string;
  }> {
    const map = new Map<
      string,
      { productName: string; quantity: number; price: number; productId?: string; categoryId?: string }
    >();
    for (const raw of lines) {
      const name = (raw.productName || '').trim() || 'Urun';
      const price = Number(raw.price) || 0;
      const key = `${name}\u0000${price}`;
      const qty = Number(raw.quantity) || 0;
      if (qty <= 0) continue;
      const cur = map.get(key);
      if (cur) {
        cur.quantity += qty;
      } else {
        map.set(key, {
          productName: name,
          quantity: qty,
          price,
          productId: raw.productId,
          categoryId: raw.categoryId,
        });
      }
    }
    return [...map.values()];
  }

  /**
   * Masadaki tüm aktif siparişleri tek fişte birleştirir veya elden satış satırlarını doğrudan yollar.
   * `orderId` ile tek adisyon (notlar dahil). Print-agent WebSocket `order.print_job` ile alır.
   */
  async printReceipt(restaurantId: string, dto: PrintReceiptDto): Promise<{ ok: true; jobId: string }> {
    const jobId = randomUUID();
    const createdAt = new Date().toISOString();
    const receiptMode = dto.receiptMode ?? 'split';

    let tableName: string;
    let waiterName: string;
    let items: Array<{
      productName: string;
      quantity: number;
      price: number;
      note?: string;
      productId?: string;
      categoryId?: string;
    }>;
    let total: number;

    if (dto.orderId) {
      const o = await this.orderRepo.findOne({
        where: { id: dto.orderId, restaurantId, status: In(['active', 'closed']) },
        relations: ['items', 'table'],
      });
      if (!o) {
        throw new NotFoundException('Sipariş bulunamadı');
      }
      tableName = o.table?.name ?? '-';
      const rawItems = o.items?.filter((i) => i.status !== 'cancelled') ?? [];
      items = rawItems.map((i) => ({
        productName: i.productName,
        quantity: i.quantity,
        price: Number(i.price),
        note: i.note ?? undefined,
        productId: i.productId,
      }));
      await this.attachCategoryIdsToItems(items, restaurantId);
      total = items.reduce((s, i) => s + i.price * i.quantity, 0);
      const waiter = o.userId
        ? await this.staffRepo.findOne({ where: { id: o.userId, restaurantId } })
        : null;
      waiterName = waiter?.name ?? '-';
    } else if (dto.tableId) {
      const orders = await this.findByRestaurant(restaurantId, dto.tableId);
      if (!orders.length) {
        throw new BadRequestException('Bu masada aktif sipariş yok');
      }
      const table = await this.tableRepo.findOne({ where: { id: dto.tableId, restaurantId } });
      tableName = table?.name ?? dto.tableId;
      const flat = orders.flatMap((o) => o.items.filter((i) => i.status !== 'cancelled'));
      items = flat.map((i) => ({
        productName: i.productName,
        quantity: i.quantity,
        price: Number(i.price),
        note: i.note ?? undefined,
        productId: i.productId,
      }));
      await this.attachCategoryIdsToItems(items, restaurantId);
      if (receiptMode === 'consolidated') {
        items = this.aggregateConsolidatedReceiptLines(items);
      }
      total = items.reduce((s, i) => s + i.price * i.quantity, 0);
      const firstUserId = orders.map((o) => o.userId).find(Boolean);
      const waiter = firstUserId
        ? await this.staffRepo.findOne({ where: { id: firstUserId, restaurantId } })
        : null;
      waiterName = waiter?.name ?? '-';
    } else {
      if (!dto.tableName?.trim() || !dto.items?.length || dto.total === undefined) {
        throw new BadRequestException('tableId yoksa tableName, items ve total gerekli');
      }
      tableName = dto.tableName.trim();
      waiterName = dto.waiterName?.trim() || '-';
      items = dto.items.map((i) => ({
        productName: i.productName,
        quantity: i.quantity,
        price: i.price,
        note: i.note,
        productId: i.productId,
        categoryId: i.categoryId,
      }));
      await this.attachCategoryIdsToItems(items, restaurantId);
      if (receiptMode === 'consolidated') {
        items = this.aggregateConsolidatedReceiptLines(items);
      }
      const computedFromLines = items.reduce((s, i) => s + i.price * i.quantity, 0);
      total =
        dto.total !== undefined && dto.total !== null ? Number(dto.total) : computedFromLines;
    }

    const includeLineNotes = receiptMode === 'split' || Boolean(dto.orderId);

    this.ordersGateway.emitPrintJob(restaurantId, {
      type: 'order.print_job',
      jobId,
      restaurantId,
      printType: 'receipt',
      createdAt,
      receiptMode,
      includeLineNotes,
      order: {
        tableName,
        waiterName,
        items,
        total,
      },
    });

    return { ok: true, jobId };
  }

  /** Print-agent HTTP: WebSocket kaçırsa bile mutfak fişi buradan tamamlanır. */
  async findPendingKitchenPrints(restaurantId: string): Promise<Record<string, unknown>[]> {
    const orders = await this.orderRepo.find({
      where: {
        restaurantId,
        status: 'active',
        kitchenTicketPrintedAt: IsNull(),
      },
      relations: ['items', 'table'],
      order: { createdAt: 'ASC' },
      take: 100,
    });

    const out: Record<string, unknown>[] = [];
    for (const o of orders) {
      const items = o.items?.filter((i) => i.status !== 'cancelled') ?? [];
      if (!items.length) continue;
      const waiter = o.userId
        ? await this.staffRepo.findOne({ where: { id: o.userId, restaurantId } })
        : null;
      const snapshot = { ...o, items };
      const row = {
        ...JSON.parse(JSON.stringify(snapshot)),
        restaurantId,
        tableName: o.table?.name ?? null,
        waiterName: waiter?.name ?? null,
      } as Record<string, unknown>;
      const rowItems = row.items as Array<{ productId?: string } & Record<string, unknown>> | undefined;
      if (rowItems?.length) {
        await this.attachCategoryIdsToItems(rowItems, restaurantId);
      }
      out.push(row);
    }
    return out;
  }

  async markKitchenTicketPrinted(restaurantId: string, orderId: string): Promise<{ ok: true }> {
    const res = await this.orderRepo.update(
      { id: orderId, restaurantId, status: 'active' },
      { kitchenTicketPrintedAt: new Date() },
    );
    if (!res.affected) {
      throw new NotFoundException('Sipariş bulunamadı veya kapatılmış');
    }
    return { ok: true };
  }
}
