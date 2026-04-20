import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { LedgerCustomerEntity } from '../domain/ledger-customer.entity';
import { LedgerEntryEntity } from '../domain/ledger-entry.entity';

export interface CreateLedgerCustomerDto {
  name: string;
  phone?: string;
  notes?: string;
}

@Injectable()
export class LedgerService {
  constructor(
    @InjectRepository(LedgerCustomerEntity)
    private readonly customerRepo: Repository<LedgerCustomerEntity>,
    @InjectRepository(LedgerEntryEntity)
    private readonly entryRepo: Repository<LedgerEntryEntity>,
  ) {}

  async listCustomers(restaurantId: string) {
    const customers = await this.customerRepo.find({
      where: { restaurantId },
      order: { name: 'ASC' },
    });
    const ids = customers.map((c) => c.id);
    if (!ids.length) return [];
    const rows = await this.entryRepo
      .createQueryBuilder('e')
      .select('e.customer_id', 'customerId')
      .addSelect(
        `SUM(CASE WHEN e.entry_type = 'debt' THEN e.amount::numeric ELSE 0 END)`,
        'debtSum',
      )
      .addSelect(
        `SUM(CASE WHEN e.entry_type = 'payment' THEN e.amount::numeric ELSE 0 END)`,
        'paySum',
      )
      .where('e.restaurant_id = :restaurantId', { restaurantId })
      .andWhere('e.customer_id IN (:...ids)', { ids })
      .groupBy('e.customer_id')
      .getRawMany<{ customerId: string; debtSum: string | null; paySum: string | null }>();
    const balMap = new Map<string, number>();
    for (const r of rows) {
      const d = Number(r.debtSum || 0);
      const p = Number(r.paySum || 0);
      balMap.set(r.customerId, d - p);
    }
    return customers.map((c) => ({
      id: c.id,
      restaurantId: c.restaurantId,
      name: c.name,
      phone: c.phone,
      notes: c.notes,
      createdAt: c.createdAt.toISOString(),
      balance: balMap.get(c.id) ?? 0,
    }));
  }

  async createCustomer(restaurantId: string, dto: CreateLedgerCustomerDto) {
    const name = (dto.name || '').trim();
    if (!name) throw new BadRequestException('Cari adi gerekli');
    const row = this.customerRepo.create({
      restaurantId,
      name,
      phone: dto.phone?.trim() || null,
      notes: dto.notes?.trim() || null,
    });
    const saved = await this.customerRepo.save(row);
    return {
      id: saved.id,
      restaurantId: saved.restaurantId,
      name: saved.name,
      phone: saved.phone,
      notes: saved.notes,
      createdAt: saved.createdAt.toISOString(),
      balance: 0,
    };
  }

  async listEntries(restaurantId: string, customerId: string) {
    await this.assertCustomer(restaurantId, customerId);
    const list = await this.entryRepo.find({
      where: { restaurantId, customerId },
      order: { createdAt: 'DESC' },
    });
    return list.map((e) => ({
      id: e.id,
      entryType: e.entryType,
      amount: Number(e.amount),
      description: e.description,
      tableId: e.tableId,
      tableName: e.tableName,
      completedOrderId: e.completedOrderId,
      receivedBy: e.receivedBy,
      receivedByUserId: e.receivedByUserId,
      createdAt: e.createdAt.toISOString(),
    }));
  }

  async addPayment(
    restaurantId: string,
    customerId: string,
    amount: number,
    receivedBy: string,
    receivedByUserId?: string | null,
  ) {
    const pay = Number(amount);
    if (!Number.isFinite(pay) || pay <= 0) throw new BadRequestException('Tutar gecersiz');
    await this.assertCustomer(restaurantId, customerId);
    const row = this.entryRepo.create({
      restaurantId,
      customerId,
      entryType: 'payment',
      amount: pay,
      description: 'Tahsilat',
      tableId: null,
      tableName: null,
      completedOrderId: null,
      snapshot: null,
      receivedBy: receivedBy.trim() || null,
      receivedByUserId: receivedByUserId?.trim() || null,
    });
    await this.entryRepo.save(row);
    const customers = await this.listCustomers(restaurantId);
    const c = customers.find((x) => x.id === customerId);
    if (!c) throw new NotFoundException('Cari bulunamadi');
    return c;
  }

  private async assertCustomer(restaurantId: string, customerId: string): Promise<LedgerCustomerEntity> {
    const c = await this.customerRepo.findOne({ where: { id: customerId, restaurantId } });
    if (!c) throw new NotFoundException('Cari bulunamadi');
    return c;
  }

  async recordDebtInTransaction(
    em: EntityManager,
    params: {
      restaurantId: string;
      customerId: string;
      amount: number;
      description: string;
      tableId?: string | null;
      tableName?: string | null;
      completedOrderId: string;
      snapshot: unknown;
    },
  ): Promise<void> {
    const amt = Number(params.amount);
    if (!Number.isFinite(amt) || amt < 0) throw new BadRequestException('Borc tutari gecersiz');
    const cust = await em.findOne(LedgerCustomerEntity, {
      where: { id: params.customerId, restaurantId: params.restaurantId },
    });
    if (!cust) throw new NotFoundException('Cari bulunamadi');
    const row = em.create(LedgerEntryEntity, {
      restaurantId: params.restaurantId,
      customerId: params.customerId,
      entryType: 'debt',
      amount: amt,
      description: params.description,
      tableId: params.tableId?.trim() || null,
      tableName: params.tableName?.trim() || null,
      completedOrderId: params.completedOrderId,
      snapshot: params.snapshot ?? null,
      receivedBy: null,
      receivedByUserId: null,
    });
    await em.save(LedgerEntryEntity, row);
  }
}
