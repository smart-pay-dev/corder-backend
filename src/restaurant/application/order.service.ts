import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderEntity } from '../domain/order.entity';
import { OrderItemEntity } from '../domain/order-item.entity';
import { CreateOrderDto } from '../api/dto/create-order.dto';
import { OrdersGateway } from '../api/orders.gateway';
import { CashShiftService } from './cash-shift.service';

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(OrderEntity)
    private readonly orderRepo: Repository<OrderEntity>,
    @InjectRepository(OrderItemEntity)
    private readonly itemRepo: Repository<OrderItemEntity>,
    private readonly ordersGateway: OrdersGateway,
    private readonly cashShiftService: CashShiftService,
  ) {}

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
    const payload = JSON.parse(JSON.stringify(created));
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
}
