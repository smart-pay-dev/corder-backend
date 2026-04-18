import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { RestaurantEntity } from '../../platform/domain/restaurant.entity';
import { TableEntity } from './table.entity';
import { OrderItemEntity } from './order-item.entity';

@Entity('orders')
@Index(['restaurantId', 'status'])
@Index(['restaurantId', 'createdAt'])
export class OrderEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'restaurant_id' })
  restaurantId: string;

  @ManyToOne(() => RestaurantEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'restaurant_id' })
  restaurant: RestaurantEntity;

  @Column({ name: 'table_id' })
  tableId: string;

  @ManyToOne(() => TableEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'table_id' })
  table: TableEntity;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ default: 'active' })
  status: string;

  @OneToMany(() => OrderItemEntity, (i) => i.order, { cascade: true })
  items: OrderItemEntity[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  /** Ürün satırı başka masadan taşındıysa kaynak masa adı (yeni adisyon etiketi). */
  @Column({ name: 'merged_from', type: 'varchar', length: 160, nullable: true })
  mergedFrom: string | null;

  /** Mutfak fişi yazdırıldı (print-agent HTTP ack); null = hâlâ mutfak kuyruğunda sayılır. */
  @Column({ name: 'kitchen_ticket_printed_at', type: 'timestamptz', nullable: true })
  kitchenTicketPrintedAt: Date | null;
}
