import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { RestaurantEntity } from '../../platform/domain/restaurant.entity';
import { ProductEntity } from './product.entity';

@Entity('categories')
@Index(['restaurantId'])
@Index(['restaurantId', 'slug'], { unique: true })
export class CategoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'restaurant_id' })
  restaurantId: string;

  @ManyToOne(() => RestaurantEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'restaurant_id' })
  restaurant: RestaurantEntity;

  @Column()
  name: string;

  @Column()
  slug: string;

  @Column({ name: 'show_in_terminal', default: true })
  showInTerminal: boolean;

  @Column({ name: 'show_in_menu', default: true })
  showInMenu: boolean;

  @Column({ default: 0 })
  order: number;

  @OneToMany(() => ProductEntity, (p) => p.category)
  products: ProductEntity[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
