import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TableEntity } from '../domain/table.entity';
import { CreateTableDto } from '../api/dto/create-table.dto';
import { UpdateTableDto } from '../api/dto/update-table.dto';

@Injectable()
export class TableService {
  constructor(
    @InjectRepository(TableEntity)
    private readonly repo: Repository<TableEntity>,
  ) {}

  async findByRestaurant(restaurantId: string): Promise<TableEntity[]> {
    return this.repo.find({
      where: { restaurantId },
      order: { section: 'ASC', name: 'ASC' },
    });
  }

  async findOne(id: string, restaurantId: string): Promise<TableEntity> {
    const t = await this.repo.findOne({ where: { id, restaurantId } });
    if (!t) throw new NotFoundException('Table not found');
    return t;
  }

  async create(restaurantId: string, dto: CreateTableDto): Promise<TableEntity> {
    const entity = this.repo.create({
      restaurantId,
      name: dto.name,
      section: dto.section ?? 'default',
    });
    return this.repo.save(entity);
  }

  async update(id: string, restaurantId: string, dto: UpdateTableDto): Promise<TableEntity> {
    const entity = await this.findOne(id, restaurantId);
    if (dto.name !== undefined) entity.name = dto.name;
    if (dto.section !== undefined) entity.section = dto.section;
    if (dto.status !== undefined) entity.status = dto.status;
    return this.repo.save(entity);
  }

  async remove(id: string, restaurantId: string): Promise<void> {
    const entity = await this.findOne(id, restaurantId);
    await this.repo.remove(entity);
  }
}
