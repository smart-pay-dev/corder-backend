import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CompletedOrderEntity } from '../domain/completed-order.entity';
import { CreateCompletedOrderDto } from '../api/dto/create-completed-order.dto';

interface ListFilters {
  from?: Date;
  to?: Date;
  waiter?: string;
  tableName?: string;
  limit?: number;
  offset?: number;
}

@Injectable()
export class CompletedOrdersService {
  constructor(
    @InjectRepository(CompletedOrderEntity)
    private readonly repo: Repository<CompletedOrderEntity>,
  ) {}

  async create(restaurantId: string, dto: CreateCompletedOrderDto): Promise<CompletedOrderEntity> {
    const entity = this.repo.create({
      restaurantId,
      tableName: dto.tableName,
      section: dto.section,
      waiter: dto.waiter,
      totalAmount: dto.totalAmount,
      discountAmount: dto.discountAmount,
      netAmount: dto.netAmount,
      closedBy: dto.closedBy,
      openedAt: new Date(dto.openedAt),
      closedAt: new Date(dto.closedAt),
      paymentMethod: dto.payment.method,
      paymentSplit: dto.payment.splitDetails ?? null,
      paymentDiscount: dto.payment.discount ?? null,
      paymentTip: dto.payment.tip ?? 0,
      ordersSnapshot: dto.orders,
      paymentSnapshot: dto.payment,
    });
    return this.repo.save(entity);
  }

  async list(restaurantId: string, filters: ListFilters): Promise<CompletedOrderEntity[]> {
    const qb = this.repo
      .createQueryBuilder('c')
      .where('c.restaurant_id = :restaurantId', { restaurantId })
      .orderBy('c.closed_at', 'DESC');

    if (filters.from) {
      qb.andWhere('c.closed_at >= :from', { from: filters.from.toISOString() });
    }
    if (filters.to) {
      qb.andWhere('c.closed_at <= :to', { to: filters.to.toISOString() });
    }
    if (filters.waiter) {
      qb.andWhere('c.waiter = :waiter', { waiter: filters.waiter });
    }
    if (filters.tableName) {
      qb.andWhere('c.table_name = :tableName', { tableName: filters.tableName });
    }
    if (filters.limit != null) {
      qb.take(filters.limit);
    }
    if (filters.offset != null) {
      qb.skip(filters.offset);
    }
    return qb.getMany();
  }
}

