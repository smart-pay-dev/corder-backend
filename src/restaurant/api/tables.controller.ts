import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { TableService } from '../application/table.service';
import { CreateTableDto } from './dto/create-table.dto';
import { UpdateTableDto } from './dto/update-table.dto';
import { RestaurantJwtGuard } from '../infrastructure/restaurant-jwt.guard';
import { RestaurantId } from '../infrastructure/restaurant-id.decorator';

@Controller('restaurant/tables')
@UseGuards(RestaurantJwtGuard)
export class TablesController {
  constructor(private readonly service: TableService) {}

  @Get()
  findAll(@RestaurantId() restaurantId: string) {
    return this.service.findByRestaurant(restaurantId);
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
  update(
    @Param('id') id: string,
    @RestaurantId() restaurantId: string,
    @Body() dto: UpdateTableDto,
  ) {
    return this.service.update(id, restaurantId, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @RestaurantId() restaurantId: string) {
    return this.service.remove(id, restaurantId);
  }
}
