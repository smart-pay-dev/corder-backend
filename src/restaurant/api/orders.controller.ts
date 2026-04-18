import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { OrderService } from '../application/order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { MoveOrdersDto } from './dto/move-orders.dto';
import { CloseOrdersDto } from './dto/close-orders.dto';
import { PrintReceiptDto } from './dto/print-receipt.dto';
import { MoveOrderItemsDto } from './dto/move-order-items.dto';
import { RestaurantJwtGuard } from '../infrastructure/restaurant-jwt.guard';
import { RestaurantId } from '../infrastructure/restaurant-id.decorator';

@Controller('restaurant/orders')
@UseGuards(RestaurantJwtGuard)
export class OrdersController {
  constructor(private readonly service: OrderService) {}

  @Get()
  findAll(
    @RestaurantId() restaurantId: string,
    @Query('tableId') tableId?: string,
  ) {
    return this.service.findByRestaurant(restaurantId, tableId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @RestaurantId() restaurantId: string) {
    return this.service.findOne(id, restaurantId);
  }

  @Post()
  create(@RestaurantId() restaurantId: string, @Body() dto: CreateOrderDto) {
    return this.service.create(restaurantId, dto);
  }

  @Post('move-items')
  moveOrderItems(@RestaurantId() restaurantId: string, @Body() dto: MoveOrderItemsDto) {
    return this.service.moveItemsToTable(restaurantId, {
      fromTableId: dto.fromTableId,
      toTableId: dto.toTableId,
      itemIds: dto.itemIds,
      userId: dto.userId ?? null,
    });
  }

  @Patch('move')
  moveTable(
    @RestaurantId() restaurantId: string,
    @Body() dto: MoveOrdersDto,
  ) {
    return this.service.moveTable(restaurantId, dto.fromTableId, dto.toTableId);
  }

  @Patch('close')
  closeTable(
    @RestaurantId() restaurantId: string,
    @Body() dto: CloseOrdersDto,
  ) {
    return this.service.closeTable(restaurantId, dto.tableId);
  }

  @Post('print-receipt')
  printReceipt(@RestaurantId() restaurantId: string, @Body() dto: PrintReceiptDto) {
    return this.service.printReceipt(restaurantId, dto);
  }
}
