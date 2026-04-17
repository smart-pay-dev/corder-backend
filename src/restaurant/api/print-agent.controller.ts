import { Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { OrderService } from '../application/order.service';
import { PrintAgentGuard, type PrintAgentRequest } from '../infrastructure/print-agent.guard';

/**
 * Print-agent (Windows) HTTP yedek kanalı: WebSocket kopsa bile mutfak fişi kaçmasın.
 * Kimlik: `Authorization: Bearer` = restoran `print_agent_token`.
 */
@Controller('restaurant/print-agent')
@UseGuards(PrintAgentGuard)
export class PrintAgentController {
  constructor(private readonly orders: OrderService) {}

  @Get('pending-kitchen-orders')
  pendingKitchen(@Req() req: PrintAgentRequest) {
    return this.orders.findPendingKitchenPrints(req.printAgentRestaurantId);
  }

  @Patch('orders/:orderId/kitchen-printed')
  kitchenPrinted(@Param('orderId') orderId: string, @Req() req: PrintAgentRequest) {
    return this.orders.markKitchenTicketPrinted(req.printAgentRestaurantId, orderId);
  }
}
