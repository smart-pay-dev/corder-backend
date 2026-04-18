import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { RestaurantEntity } from '../../platform/domain/restaurant.entity';

@Entity('tables')
@Index(['restaurantId'])
export class TableEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'restaurant_id' })
  restaurantId: string;

  @ManyToOne(() => RestaurantEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'restaurant_id' })
  restaurant: RestaurantEntity;

  @Column()
  name: string;

  @Column({ default: 'default' })
  section: string;

  @Column({ default: 'empty' })
  status: string;

  /** Garson terminalde bu masada işlemde — kasadaki checkout gibi kalıcı; diğer garson API ile giremez. */
  @Column({ name: 'session_staff_id', type: 'uuid', nullable: true })
  sessionStaffId: string | null;

  @Column({ name: 'session_staff_name', type: 'varchar', length: 120, nullable: true })
  sessionStaffName: string | null;

  @Column({ name: 'session_locked_at', type: 'timestamptz', nullable: true })
  sessionLockedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
