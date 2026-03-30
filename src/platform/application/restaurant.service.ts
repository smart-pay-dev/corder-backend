import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { RestaurantEntity } from '../domain/restaurant.entity';
import { CreateRestaurantDto } from '../api/dto/create-restaurant.dto';
import { UpdateRestaurantDto } from '../api/dto/update-restaurant.dto';

@Injectable()
export class RestaurantService {
  constructor(
    @InjectRepository(RestaurantEntity)
    private readonly repo: Repository<RestaurantEntity>,
  ) {}

  async findAll(): Promise<RestaurantEntity[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<RestaurantEntity> {
    const r = await this.repo.findOne({ where: { id } });
    if (!r) throw new NotFoundException('Restaurant not found');
    return r;
  }

  async findBySlug(slug: string): Promise<RestaurantEntity | null> {
    return this.repo.findOne({ where: { slug } });
  }

  async create(dto: CreateRestaurantDto): Promise<RestaurantEntity> {
    const slug = dto.slug.toLowerCase().trim();
    const existing = await this.repo.findOne({ where: { slug } });
    if (existing) throw new ConflictException('Slug already in use');
    const entity = this.repo.create({
      ...dto,
      slug,
    });
    return this.repo.save(entity);
  }

  async update(id: string, dto: UpdateRestaurantDto): Promise<RestaurantEntity> {
    const entity = await this.findOne(id);
    if (dto.slug !== undefined) {
      const slug = dto.slug.toLowerCase().trim();
      if (slug !== entity.slug) {
        const existing = await this.repo.findOne({ where: { slug } });
        if (existing) throw new ConflictException('Slug already in use');
      }
      entity.slug = slug;
    }
    if (dto.name !== undefined) entity.name = dto.name;
    if (dto.address !== undefined) entity.address = dto.address;
    if (dto.phone !== undefined) entity.phone = dto.phone;
    if (dto.email !== undefined) entity.email = dto.email;
    if (dto.status !== undefined) entity.status = dto.status;
    if (dto.terminalEmail !== undefined) entity.terminalEmail = dto.terminalEmail?.trim() || null;
    if (dto.terminalPassword !== undefined && dto.terminalPassword.length > 0) {
      entity.terminalPasswordHash = await bcrypt.hash(dto.terminalPassword, 10);
    }
    return this.repo.save(entity);
  }

  async remove(id: string): Promise<void> {
    const entity = await this.findOne(id);
    await this.repo.remove(entity);
  }
}
