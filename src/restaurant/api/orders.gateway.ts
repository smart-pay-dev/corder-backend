import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RestaurantTokenPayload } from '../application/restaurant-auth.service';
import { RestaurantEntity } from '../../platform/domain/restaurant.entity';

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

  /** restaurantId -> (tableId -> kilit) — yalnızca JWT (terminal/panel) oturumları. */
  private readonly tableLocks = new Map<
    string,
    Map<string, { staffId: string; staffName: string; socketId: string }>
  >();

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @InjectRepository(RestaurantEntity)
    private readonly restaurantRepo: Repository<RestaurantEntity>,
  ) {}

  private getInner(restaurantId: string): Map<string, { staffId: string; staffName: string; socketId: string }> {
    let m = this.tableLocks.get(restaurantId);
    if (!m) {
      m = new Map();
      this.tableLocks.set(restaurantId, m);
    }
    return m;
  }

  private removeSocketFromRestaurant(restaurantId: string, socketId: string): void {
    const inner = this.tableLocks.get(restaurantId);
    if (!inner) return;
    for (const [tid, v] of [...inner.entries()]) {
      if (v.socketId === socketId) inner.delete(tid);
    }
    if (inner.size === 0) this.tableLocks.delete(restaurantId);
  }

  private getTablePresencePayload(restaurantId: string): Record<string, { staffId: string; staffName: string }> {
    const inner = this.tableLocks.get(restaurantId);
    const payload: Record<string, { staffId: string; staffName: string }> = {};
    if (inner) {
      for (const [tid, v] of inner) {
        payload[tid] = { staffId: v.staffId, staffName: v.staffName };
      }
    }
    return payload;
  }

  private broadcastTablePresence(restaurantId: string): void {
    const payload = this.getTablePresencePayload(restaurantId);
    this.server.to(getRestaurantRoom(restaurantId)).emit('tables:presence', payload);
  }

  /** HTTP yedek: WebSocket kaçırılsa bile terminal masada kimin olduğunu görsün. */
  getTablePresenceSnapshot(restaurantId: string): Record<string, { staffId: string; staffName: string }> {
    return this.getTablePresencePayload(restaurantId);
  }

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
      client.emit('tables:presence', this.getTablePresencePayload(payload.restaurantId));
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

  handleDisconnect(client: Socket): void {
    const rid = client.data?.restaurantId as string | undefined;
    if (rid && client.data?.authType === 'jwt') {
      this.removeSocketFromRestaurant(rid, client.id);
      this.broadcastTablePresence(rid);
    }
  }

  /** Terminal: bir garson masada (detay / menü / sepet / taşıma / adisyon) iken diğer cihazlara yansır. */
  @SubscribeMessage('table:focus')
  handleTableFocus(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { tableId?: string; staffId?: string; staffName?: string },
  ): { ok: boolean; holderName?: string } {
    if (client.data?.authType !== 'jwt') return { ok: true };
    const restaurantId = client.data.restaurantId as string;
    const tableId = body?.tableId?.trim();
    const staffId = body?.staffId?.trim();
    const staffName = (body?.staffName ?? '').trim() || 'Garson';
    if (!tableId || !staffId) return { ok: false };
    const inner = this.getInner(restaurantId);
    const existing = inner.get(tableId);
    if (existing && existing.socketId !== client.id) {
      return { ok: false, holderName: existing.staffName };
    }
    this.removeSocketFromRestaurant(restaurantId, client.id);
    inner.set(tableId, { staffId, staffName, socketId: client.id });
    this.broadcastTablePresence(restaurantId);
    return { ok: true };
  }

  @SubscribeMessage('table:blur')
  handleTableBlur(@ConnectedSocket() client: Socket): { ok: boolean } {
    if (client.data?.authType !== 'jwt') return { ok: true };
    const restaurantId = client.data.restaurantId as string;
    this.removeSocketFromRestaurant(restaurantId, client.id);
    this.broadcastTablePresence(restaurantId);
    return { ok: true };
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
