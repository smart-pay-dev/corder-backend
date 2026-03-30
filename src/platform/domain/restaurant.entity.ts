import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('restaurants')
@Index(['terminalEmail'])
export class RestaurantEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  slug: string;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  email: string;

  @Column({ default: 'active' })
  status: string;

  @Column({ name: 'root_admin_id', type: 'uuid', nullable: true })
  rootAdminId: string | null;

  /** Terminal girişi (root admin'den bağımsız; restoran bazında tek). */
  @Column({ name: 'terminal_email', type: 'varchar', nullable: true })
  terminalEmail: string | null;

  @Column({ name: 'terminal_password_hash', type: 'varchar', nullable: true })
  terminalPasswordHash: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
