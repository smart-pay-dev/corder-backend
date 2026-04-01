import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RootAdminEntity } from '../platform/domain/root-admin.entity';
import { RestaurantEntity } from '../platform/domain/restaurant.entity';
import { TableEntity } from './domain/table.entity';
import { OrderEntity } from './domain/order.entity';
import { OrderItemEntity } from './domain/order-item.entity';
import { CategoryEntity } from './domain/category.entity';
import { ProductEntity } from './domain/product.entity';
import { RestaurantStaffEntity } from './domain/restaurant-staff.entity';
import { CashShiftEntity } from './domain/cash-shift.entity';
import { CompletedOrderEntity } from './domain/completed-order.entity';
import { RestaurantAuthService } from './application/restaurant-auth.service';
import { CashShiftService } from './application/cash-shift.service';
import { StaffService } from './application/staff.service';
import { TableService } from './application/table.service';
import { OrderService } from './application/order.service';
import { CategoryService } from './application/category.service';
import { ProductService } from './application/product.service';
import { CompletedOrdersService } from './application/completed-orders.service';
import { RestaurantAuthController } from './api/restaurant-auth.controller';
import { TablesController } from './api/tables.controller';
import { OrdersController } from './api/orders.controller';
import { CategoriesController } from './api/categories.controller';
import { ProductsController } from './api/products.controller';
import { UploadController } from './api/upload.controller';
import { StaffController } from './api/staff.controller';
import { ShiftsController } from './api/shifts.controller';
import { CompletedOrdersController } from './api/completed-orders.controller';
import { OrdersGateway } from './api/orders.gateway';
import { RestaurantJwtStrategy } from './infrastructure/restaurant-jwt.strategy';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RootAdminEntity,
      RestaurantEntity,
      RestaurantStaffEntity,
      TableEntity,
      OrderEntity,
      OrderItemEntity,
      CategoryEntity,
      ProductEntity,
      CashShiftEntity,
      CompletedOrderEntity,
    ]),
    PassportModule.register({ defaultStrategy: 'restaurant-jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.get('JWT_EXPIRES_IN', '7d') },
      }),
    }),
  ],
  controllers: [
    RestaurantAuthController,
    TablesController,
    OrdersController,
    CategoriesController,
    ProductsController,
    UploadController,
    StaffController,
    ShiftsController,
    CompletedOrdersController,
  ],
  providers: [
    RestaurantAuthService,
    StaffService,
    TableService,
    OrderService,
    CategoryService,
    ProductService,
    CashShiftService,
    CompletedOrdersService,
    RestaurantJwtStrategy,
    OrdersGateway,
  ],
  exports: [RestaurantAuthService, TableService, OrderService, CategoryService, ProductService, CashShiftService],
})
export class RestaurantModule {}
