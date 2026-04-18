import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RestaurantTokenPayload } from '../application/restaurant-auth.service';
import { RestaurantEntity } from '../../platform/domain/restaurant.entity';
import { TableService } from '../application/table.service';

function getRestaurantRoom(restaurantId: string) {
  return `restaurant:${restaurantId}`;
}

@WebSocketGateway({
  cors: { origin: true },
  path: '/ws',
})
@Injectable()
export class OrdersGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly tableService: TableService,
    @InjectRepository(RestaurantEntity)
    private readonly restaurantRepo: Repository<RestaurantEntity>,
  ) {}

  async handleConnection(client: Socket) {
    const token =
      client.handshake.auth?.token || client.handshake.headers?.authorization?.replace?.('Bearer ', '');
    if (!token) {
      client.disconnect(true);
      return;
    }
    try {
      const secret = this.config.get<string>('JWT_SECRET');
      const payload = this.jwt.verify<RestaurantTokenPayload>(token, { secret });
      if (payload.type !== 'restaurant' || !payload.restaurantId) {
        client.disconnect(true);
        return;
      }
      client.data.restaurantId = payload.restaurantId;
      client.data.authType = 'jwt';
      client.join(getRestaurantRoom(payload.restaurantId));
      const map = await this.tableService.buildSessionPresenceMap(payload.restaurantId);
      client.emit('tables:presence', map);
      return;
    } catch {
      // JWT değilse statik print-agent token kontrolüne düş.
    }

    const restaurant = await this.restaurantRepo.findOne({ where: { printAgentToken: token } });
    if (!restaurant) {
      client.disconnect(true);
      return;
    }
    client.data.restaurantId = restaurant.id;
    client.data.authType = 'print-agent-token';
    client.join(getRestaurantRoom(restaurant.id));
  }

  handleDisconnect(_client: Socket): void {
    /* Garson kilidi artık DB’de; soket düşünce otomatik kalkmaz (kasadaki checkout gibi). */
  }

  async emitTableSessionPresence(restaurantId: string): Promise<void> {
    const payload = await this.tableService.buildSessionPresenceMap(restaurantId);
    this.server.to(getRestaurantRoom(restaurantId)).emit('tables:presence', payload);
  }

  emitOrderCreated(restaurantId: string, order: Record<string, unknown>) {
    this.server.to(getRestaurantRoom(restaurantId)).emit('order:created', order);
  }

  emitOrdersMoved(
    restaurantId: string,
    payload: { fromTableId: string; toTableId: string },
  ) {
    this.server.to(getRestaurantRoom(restaurantId)).emit('orders:moved', payload);
  }

  /** Genel sipariş güncellemesi (hesap kapatma, taşıma, iptal vb.) – tüm client’lar refetch yapar */
  emitOrdersUpdated(restaurantId: string) {
    this.server.to(getRestaurantRoom(restaurantId)).emit('orders:updated');
  }

  /** Fiş / adisyon yazdırma – print-agent `order.print_job` dinler */
  emitPrintJob(
    restaurantId: string,
    payload: {
      type: 'order.print_job';
      jobId: string;
      restaurantId: string;
      printType: 'receipt';
      createdAt: string;
      receiptMode?: 'consolidated' | 'split';
      /** Konsolide kasa özetinde false (satır birleştirme, not yok); tekil adisyon / split’te true. */
      includeLineNotes?: boolean;
      order: {
        tableName: string;
        waiterName: string;
        items: {
          productName: string;
          quantity: number;
          price: number;
          note?: string;
          productId?: string;
          categoryId?: string;
        }[];
        total: number;
      };
    },
  ) {
    this.server.to(getRestaurantRoom(restaurantId)).emit('order.print_job', payload);
  }
}
