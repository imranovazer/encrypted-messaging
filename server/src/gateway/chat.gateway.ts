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
import { UseGuards, Logger } from '@nestjs/common';
import { WsJwtGuard } from './guards/ws-jwt.guard';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  },
  namespace: '/chat',
})
@UseGuards(WsJwtGuard)
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private userSockets = new Map<string, string>(); // userId -> socketId

  async handleConnection(client: Socket) {
    const user = client.data.user;
    if (user) {
      this.userSockets.set(user.sub, client.id);
      this.logger.log(`Client connected: ${client.id} (User: ${user.username})`);
      
      // Join a room for the user
      client.join(`user:${user.sub}`);
    }
  }

  handleDisconnect(client: Socket) {
    const user = client.data.user;
    if (user) {
      this.userSockets.delete(user.sub);
      this.logger.log(`Client disconnected: ${client.id} (User: ${user.username})`);
    }
  }

  @SubscribeMessage('join-conversation')
  handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string },
  ) {
    const user = client.data.user;
    if (user && data.userId) {
      // Join a room for the conversation
      const roomName = this.getConversationRoom(user.sub, data.userId);
      client.join(roomName);
      this.logger.log(`User ${user.username} joined conversation with ${data.userId}`);
    }
  }

  @SubscribeMessage('leave-conversation')
  handleLeaveConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string },
  ) {
    const user = client.data.user;
    if (user && data.userId) {
      const roomName = this.getConversationRoom(user.sub, data.userId);
      client.leave(roomName);
      this.logger.log(`User ${user.username} left conversation with ${data.userId}`);
    }
  }

  // Method to emit new message to recipient
  async emitNewMessage(message: any) {
    // Emit to recipient's user room
    this.server.to(`user:${message.recipientId}`).emit('new-message', message);
    
    // Also emit to conversation room
    const roomName = this.getConversationRoom(message.senderId, message.recipientId);
    this.server.to(roomName).emit('new-message', message);
    
    this.logger.log(`New message emitted to recipient ${message.recipientId}`);
  }

  // Helper to get consistent room name for a conversation
  private getConversationRoom(userId1: string, userId2: string): string {
    // Sort IDs to ensure consistent room name regardless of order
    const sorted = [userId1, userId2].sort();
    return `conversation:${sorted[0]}:${sorted[1]}`;
  }
}
