import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Injectable } from '@nestjs/common';
import { RestaurantTokenPayload } from '../application/restaurant-auth.service';

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
  ) {}

  handleConnection(client: import('socket.io').Socket) {
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
      client.join(getRestaurantRoom(payload.restaurantId));
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(_client: import('socket.io').Socket) {}

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
}
