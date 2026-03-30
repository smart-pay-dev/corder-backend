import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { RestaurantService } from '../application/restaurant.service';
import { CreateRestaurantDto } from './dto/create-restaurant.dto';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto';
import { PlatformJwtGuard } from '../infrastructure/platform-jwt.guard';

@Controller('platform/restaurants')
@UseGuards(PlatformJwtGuard)
export class RestaurantsController {
  constructor(private readonly service: RestaurantService) {}

  @Get()
  async findAll() {
    const list = await this.service.findAll();
    return list.map((r) => {
      const { terminalPasswordHash, ...rest } = r;
      return rest;
    });
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const r = await this.service.findOne(id);
    const { terminalPasswordHash, ...rest } = r;
    return rest;
  }

  @Post()
  create(@Body() dto: CreateRestaurantDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateRestaurantDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
