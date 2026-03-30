import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductEntity } from '../domain/product.entity';
import { CategoryEntity } from '../domain/category.entity';
import { CreateProductDto } from '../api/dto/create-product.dto';
import { UpdateProductDto } from '../api/dto/update-product.dto';

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(ProductEntity)
    private readonly repo: Repository<ProductEntity>,
    @InjectRepository(CategoryEntity)
    private readonly categoryRepo: Repository<CategoryEntity>,
  ) {}

  async findByRestaurant(restaurantId: string): Promise<ProductEntity[]> {
    return this.repo
      .createQueryBuilder('p')
      .innerJoinAndSelect('p.category', 'c')
      .where('c.restaurant_id = :restaurantId', { restaurantId })
      .orderBy('c.order', 'ASC')
      .addOrderBy('p.order', 'ASC')
      .addOrderBy('p.name', 'ASC')
      .getMany();
  }

  async findOne(id: string, restaurantId: string): Promise<ProductEntity> {
    const p = await this.repo
      .createQueryBuilder('p')
      .innerJoinAndSelect('p.category', 'c')
      .where('p.id = :id', { id })
      .andWhere('c.restaurant_id = :restaurantId', { restaurantId })
      .getOne();
    if (!p) throw new NotFoundException('Product not found');
    return p;
  }

  async create(restaurantId: string, dto: CreateProductDto): Promise<ProductEntity> {
    const cat = await this.categoryRepo.findOne({ where: { id: dto.categoryId, restaurantId } });
    if (!cat) throw new NotFoundException('Category not found');
    const entity = new ProductEntity();
    entity.categoryId = dto.categoryId;
    entity.name = dto.name.trim();
    entity.description = dto.description?.trim() ?? null;
    entity.price = dto.price;
    entity.imageUrl = dto.imageUrl ?? null;
    entity.inStock = dto.inStock ?? true;
    entity.order = dto.order ?? 0;
    const saved = await this.repo.save(entity);
    return this.findOne(saved.id, restaurantId);
  }

  async update(id: string, restaurantId: string, dto: UpdateProductDto): Promise<ProductEntity> {
    const entity = await this.findOne(id, restaurantId);
    if (dto.name !== undefined) entity.name = dto.name.trim();
    if (dto.description !== undefined) entity.description = dto.description?.trim() ?? null;
    if (dto.price !== undefined) entity.price = dto.price;
    if (dto.imageUrl !== undefined) entity.imageUrl = dto.imageUrl;
    if (dto.inStock !== undefined) entity.inStock = dto.inStock;
    if (dto.order !== undefined) entity.order = dto.order;
    await this.repo.save(entity);
    return this.findOne(id, restaurantId);
  }

  async remove(id: string, restaurantId: string): Promise<void> {
    const entity = await this.findOne(id, restaurantId);
    await this.repo.remove(entity);
  }
}
