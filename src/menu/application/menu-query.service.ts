import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { RestaurantEntity } from '../../platform/domain/restaurant.entity';
import { CategoryEntity } from '../../restaurant/domain/category.entity';
import { ProductEntity } from '../../restaurant/domain/product.entity';
import { CampaignEntity } from '../../restaurant/domain/campaign.entity';

export interface MenuBusinessDto {
  id: string;
  name: string;
  slug: string;
  address?: string;
  phone?: string;
  email?: string;
  workingHours?: string;
  logo?: string;
  whatsapp?: string;
  instagram?: string;
  facebook?: string;
  website?: string;
  categories: { id: string; name: string; slug: string; products: { id: string; name: string; description?: string; price: number; imageUrl?: string; inStock: boolean }[] }[];
  campaigns: { id: string; title: string; description?: string; imageUrl: string; discountPercent?: number; originalPrice?: number; discountedPrice?: number; validUntil?: string; isActive: boolean }[];
}

@Injectable()
export class MenuQueryService {
  constructor(
    @InjectRepository(RestaurantEntity)
    private readonly restaurantRepo: Repository<RestaurantEntity>,
    @InjectRepository(CategoryEntity)
    private readonly categoryRepo: Repository<CategoryEntity>,
    @InjectRepository(ProductEntity)
    private readonly productRepo: Repository<ProductEntity>,
    @InjectRepository(CampaignEntity)
    private readonly campaignRepo: Repository<CampaignEntity>,
  ) {}

  async getBusinessBySlug(slug: string | null): Promise<MenuBusinessDto> {
    if (!slug?.trim()) throw new NotFoundException('restaurant query is required');
    const restaurant = await this.restaurantRepo.findOne({ where: { slug: slug.trim(), status: 'active' } });
    if (!restaurant) throw new NotFoundException('Business not found');
    const categories = await this.categoryRepo.find({
      where: { restaurantId: restaurant.id, showInMenu: true },
      order: { order: 'ASC', name: 'ASC' },
    });
    const categoryIds = categories.map((c) => c.id);
    const products = categoryIds.length
      ? await this.productRepo.find({
          where: { categoryId: In(categoryIds) },
          order: { order: 'ASC', name: 'ASC' },
        })
      : [];
    const campaigns = await this.campaignRepo.find({
      where: { restaurantId: restaurant.id, isActive: true },
      order: { order: 'ASC' },
    });
    const categoriesWithProducts = categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      products: products
        .filter((p) => p.categoryId === cat.id)
        .map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description ?? undefined,
          price: Number(p.price),
          imageUrl: p.imageUrl ?? undefined,
          inStock: p.inStock,
        })),
    }));
    return {
      id: restaurant.id,
      name: restaurant.name,
      slug: restaurant.slug,
      address: restaurant.address ?? undefined,
      phone: restaurant.phone ?? undefined,
      email: restaurant.email ?? undefined,
      categories: categoriesWithProducts,
      campaigns: campaigns.map((c) => ({
        id: c.id,
        title: c.title,
        description: c.description ?? undefined,
        imageUrl: c.imageUrl,
        discountPercent: c.discountPercent ?? undefined,
        originalPrice: c.originalPrice != null ? Number(c.originalPrice) : undefined,
        discountedPrice: c.discountedPrice != null ? Number(c.discountedPrice) : undefined,
        validUntil: c.validUntil?.toISOString(),
        isActive: c.isActive,
      })),
    };
  }
}
