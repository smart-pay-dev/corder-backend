import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { CashShiftService } from '../application/cash-shift.service';
import { OpenShiftDto } from './dto/open-shift.dto';
import { CloseShiftDto } from './dto/close-shift.dto';
import { RestaurantJwtGuard } from '../infrastructure/restaurant-jwt.guard';
import { RestaurantId } from '../infrastructure/restaurant-id.decorator';
import { RestaurantUser } from '../infrastructure/restaurant-user.decorator';

@Controller('restaurant/shifts')
@UseGuards(RestaurantJwtGuard)
export class ShiftsController {
  constructor(private readonly service: CashShiftService) {}

  @Get('current')
  async getCurrent(@RestaurantId() restaurantId: string) {
    const shift = await this.service.getCurrent(restaurantId);
    if (!shift) return null;
    return this.toDto(shift);
  }

  @Get()
  async list(@RestaurantId() restaurantId: string, @Query('limit') limit?: string) {
    const shifts = await this.service.list(restaurantId, limit ? parseInt(limit, 10) : 50);
    return shifts.map((s) => this.toDto(s));
  }

  @Post()
  async open(
    @RestaurantId() restaurantId: string,
    @RestaurantUser() user: { id: string; name: string },
    @Body() dto: OpenShiftDto,
  ) {
    const shift = await this.service.open(
      restaurantId,
      user.name,
      dto.openingBalance ?? 0,
    );
    return this.toDto(shift);
  }

  @Put(':id/close')
  async close(
    @Param('id') id: string,
    @RestaurantId() restaurantId: string,
    @RestaurantUser() user: { id: string; name: string },
    @Body() dto: CloseShiftDto,
  ) {
    const shift = await this.service.close(
      id,
      restaurantId,
      user.name,
      dto.closingBalance,
      dto.notes,
    );
    return this.toDto(shift);
  }

  private toDto(shift: {
    id: string;
    openedBy: string;
    openedAt: Date;
    closedAt: Date | null;
    closedBy: string | null;
    status: string;
    openingBalance: number;
    closingBalance: number | null;
    notes: string | null;
  }) {
    return {
      id: shift.id,
      openedBy: shift.openedBy,
      openedAt: shift.openedAt,
      closedAt: shift.closedAt,
      closedBy: shift.closedBy,
      status: shift.status,
      openingBalance: Number(shift.openingBalance),
      closingBalance: shift.closingBalance != null ? Number(shift.closingBalance) : null,
      notes: shift.notes,
      // Panel uyumu için ek alanlar (backend'de tek kaynak; panel bunları kullanır)
      cashIn: 0,
      cashOut: 0,
      totalRevenue: 0,
      totalNakit: 0,
      totalKart: 0,
      totalYemekKarti: 0,
      totalMultinet: 0,
      transactionCount: 0,
    };
  }
}
