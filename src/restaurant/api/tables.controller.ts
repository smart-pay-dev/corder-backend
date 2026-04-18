import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { TableService } from '../application/table.service';
import { CreateTableDto } from './dto/create-table.dto';
import { UpdateTableDto } from './dto/update-table.dto';
import { RestaurantJwtGuard } from '../infrastructure/restaurant-jwt.guard';
import { RestaurantId } from '../infrastructure/restaurant-id.decorator';
import { OrdersGateway } from './orders.gateway';

@Controller('restaurant/tables')
@UseGuards(RestaurantJwtGuard)
export class TablesController {
  constructor(
    private readonly service: TableService,
    private readonly ordersGateway: OrdersGateway,
  ) {}

  @Get()
  findAll(@RestaurantId() restaurantId: string) {
    return this.service.findByRestaurant(restaurantId);
  }

  /** `:id` rotasından önce tanımlanmalı (aksi halde `presence` id sanılır). */
  @Get('presence')
  tablePresence(@RestaurantId() restaurantId: string) {
    return this.ordersGateway.getTablePresenceSnapshot(restaurantId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @RestaurantId() restaurantId: string) {
    return this.service.findOne(id, restaurantId);
  }

  @Post()
  create(@RestaurantId() restaurantId: string, @Body() dto: CreateTableDto) {
    return this.service.create(restaurantId, dto);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @RestaurantId() restaurantId: string,
    @Body() dto: UpdateTableDto,
  ) {
    const updated = await this.service.update(id, restaurantId, dto);
    this.ordersGateway.emitOrdersUpdated(restaurantId);
    return updated;
  }

  @Delete(':id')
  remove(@Param('id') id: string, @RestaurantId() restaurantId: string) {
    return this.service.remove(id, restaurantId);
  }
}
