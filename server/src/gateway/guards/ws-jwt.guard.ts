import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

@Injectable()
export class WsJwtGuard implements CanActivate {
  private readonly logger = new Logger(WsJwtGuard.name);

  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client: Socket = context.switchToWs().getClient();
    const token = this.extractTokenFromHeader(client);

    if (!token) {
      this.logger.warn(`No token found for client ${client.id}`);
      client.disconnect();
      throw new WsException('Unauthorized');
    }

    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET || 'my-super-secret-key',
      });
      client.data.user = payload;
      this.logger.log(`Token verified for client ${client.id}, user: ${payload.username || payload.sub}`);
      return true;
    } catch (error) {
      this.logger.warn(`Token verification failed for client ${client.id}: ${error.message}`);
      client.disconnect();
      throw new WsException('Unauthorized');
    }
  }

  private extractTokenFromHeader(client: Socket): string | undefined {
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
}
