import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CategoryEntity } from '../domain/category.entity';
import { CreateCategoryDto } from '../api/dto/create-category.dto';
import { UpdateCategoryDto } from '../api/dto/update-category.dto';

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

@Injectable()
export class CategoryService {
  constructor(
    @InjectRepository(CategoryEntity)
    private readonly repo: Repository<CategoryEntity>,
  ) {}

  async findByRestaurant(restaurantId: string): Promise<CategoryEntity[]> {
    return this.repo.find({
      where: { restaurantId },
      order: { order: 'ASC', name: 'ASC' },
    });
  }

  async findOne(id: string, restaurantId: string): Promise<CategoryEntity> {
    const c = await this.repo.findOne({ where: { id, restaurantId } });
    if (!c) throw new NotFoundException('Category not found');
    return c;
  }

  async create(restaurantId: string, dto: CreateCategoryDto): Promise<CategoryEntity> {
    const slug = toSlug(dto.name);
    const existing = await this.repo.findOne({ where: { restaurantId, slug } });
    if (existing) throw new ConflictException('Category slug already exists');
    const maxOrder = await this.repo
      .createQueryBuilder('c')
      .where('c.restaurant_id = :restaurantId', { restaurantId })
      .select('MAX(c.order)', 'max')
      .getRawOne<{ max: number }>();
    const order = dto.order ?? (Number(maxOrder?.max ?? 0) + 1);
    const entity = this.repo.create({
      restaurantId,
      name: dto.name.trim(),
      slug,
      showInTerminal: dto.showInTerminal ?? true,
      showInMenu: dto.showInMenu ?? true,
      order,
    });
    return this.repo.save(entity);
  }

  async update(id: string, restaurantId: string, dto: UpdateCategoryDto): Promise<CategoryEntity> {
    const entity = await this.findOne(id, restaurantId);
    if (dto.name !== undefined) {
      entity.name = dto.name.trim();
      entity.slug = toSlug(dto.name);
    }
    if (dto.showInTerminal !== undefined) entity.showInTerminal = dto.showInTerminal;
    if (dto.showInMenu !== undefined) entity.showInMenu = dto.showInMenu;
    if (dto.order !== undefined) entity.order = dto.order;
    return this.repo.save(entity);
  }

  async remove(id: string, restaurantId: string): Promise<void> {
    const entity = await this.findOne(id, restaurantId);
    await this.repo.remove(entity);
  }
}
