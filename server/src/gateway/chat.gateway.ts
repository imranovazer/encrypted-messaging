import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private userSockets = new Map<string, string>(); // userId -> socketId

  constructor(private jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const token = this.extractToken(client);
      
      if (!token) {
        this.logger.warn(`Client ${client.id} connected without token`);
        client.disconnect();
        return;
      }

      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
      });

      client.data.user = payload;
      const userId = payload.sub || payload.userId;
      
      if (!userId) {
        this.logger.error(`Client ${client.id} connected but no user ID in token payload`);
        client.disconnect();
        return;
      }

      this.userSockets.set(userId, client.id);
      this.logger.log(`Client connected: ${client.id} (User: ${payload.username || 'unknown'}, ID: ${userId})`);
      
      // Join a room for the user
      client.join(`user:${userId}`);
    } catch (error) {
      this.logger.error(`Authentication failed for client ${client.id}: ${error.message}`);
      client.disconnect();
    }
  }

  private extractToken(client: Socket): string | undefined {
    const authHeader = client.handshake.headers.authorization;
    if (authHeader) {
      const [type, token] = authHeader.split(' ') ?? [];
      if (type === 'Bearer' && token) {
        return token;
      }
    }

    const auth = client.handshake.auth;
    if (auth && auth.token) {
      return auth.token;
    }

    return undefined;
  }

  handleDisconnect(client: Socket) {
    const user = client.data.user;
    if (user) {
      const userId = user.sub || user.userId;
      if (userId) {
        this.userSockets.delete(userId);
        this.logger.log(`Client disconnected: ${client.id} (User: ${user.username || 'unknown'})`);
      }
    }
  }

  @SubscribeMessage('join-conversation')
  handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string },
  ) {
    const user = client.data.user;
    if (user && data.userId) {
      const currentUserId = user.sub || user.userId;
      if (currentUserId) {
        // Join a room for the conversation
        const roomName = this.getConversationRoom(currentUserId, data.userId);
        client.join(roomName);
        this.logger.log(`User ${user.username || currentUserId} joined conversation with ${data.userId}`);
      }
    }
  }

  @SubscribeMessage('leave-conversation')
  handleLeaveConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string },
  ) {
    const user = client.data.user;
    if (user && data.userId) {
      const currentUserId = user.sub || user.userId;
      if (currentUserId) {
        const roomName = this.getConversationRoom(currentUserId, data.userId);
        client.leave(roomName);
        this.logger.log(`User ${user.username || currentUserId} left conversation with ${data.userId}`);
      }
    }
  }

  // Method to emit new message to recipient
  async emitNewMessage(message: any) {
    this.logger.log(`Emitting new message: ${message.id} from ${message.senderId} to ${message.recipientId}`);
    
    // Emit to recipient's user room
    this.server.to(`user:${message.recipientId}`).emit('new-message', message);
    
    // Also emit to conversation room
    const roomName = this.getConversationRoom(message.senderId, message.recipientId);
    this.server.to(roomName).emit('new-message', message);
    
    // Also emit to sender's user room (so sender sees their own message via WebSocket)
    this.server.to(`user:${message.senderId}`).emit('new-message', message);
    
    this.logger.log(`New message emitted to rooms: user:${message.recipientId}, user:${message.senderId}, ${roomName}`);
  }

  // Helper to get consistent room name for a conversation
  private getConversationRoom(userId1: string, userId2: string): string {
    // Sort IDs to ensure consistent room name regardless of order
    const sorted = [userId1, userId2].sort();
    return `conversation:${sorted[0]}:${sorted[1]}`;
  }
}
