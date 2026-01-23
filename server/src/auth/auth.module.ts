import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { User } from '../entities/user.entity';
import { RefreshToken } from '../entities/refresh-token.entity';

const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '15m';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, RefreshToken]),
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'my-super-secret-key',
      signOptions: {
        expiresIn: jwtExpiresIn as any,
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
