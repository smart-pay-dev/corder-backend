import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OpenAccountEntity } from '../domain/open-account.entity';

export interface CreateOpenAccountDto {
  customerName: string;
  customerPhone?: string;
  amount: number;
  description: string;
  createdBy: string;
}

@Injectable()
export class OpenAccountsService {
  constructor(
    @InjectRepository(OpenAccountEntity)
    private readonly repo: Repository<OpenAccountEntity>,
  ) {}

  list(restaurantId: string) {
    return this.repo.find({
      where: { restaurantId },
      order: { createdAt: 'DESC' },
    });
  }

  async create(restaurantId: string, dto: CreateOpenAccountDto) {
    const entity = this.repo.create({
      restaurantId,
      customerName: dto.customerName,
      customerPhone: dto.customerPhone ?? null,
      amount: dto.amount,
      paidAmount: 0,
      status: 'open',
      description: dto.description,
      createdBy: dto.createdBy,
    });
    return this.repo.save(entity);
  }

  async pay(restaurantId: string, id: string, amount: number) {
    const acc = await this.repo.findOne({ where: { id, restaurantId } });
    if (!acc) throw new NotFoundException('Açık hesap bulunamadı.');
    const paid = Number(acc.paidAmount ?? 0) + Number(amount);
    acc.paidAmount = paid;
    if (paid >= Number(acc.amount)) {
      acc.status = 'paid';
      acc.paidAt = new Date();
    } else {
      acc.status = 'partial';
    }
    return this.repo.save(acc);
  }
}

