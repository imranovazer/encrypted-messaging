import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { User } from '../entities/user.entity';
import { RefreshToken } from '../entities/refresh-token.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { BCRYPT_SALT_ROUNDS, REFRESH_TOKEN_EXPIRES_IN_DAYS } from '../common/constants';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(RefreshToken)
    private refreshTokenRepository: Repository<RefreshToken>,
    private jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto) {
    const { username, password, publicKey, encryptedPrivateKeyBackup } =
      registerDto;

    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: { username },
    });

    if (existingUser) {
      throw new ConflictException('Username already exists');
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    // Create user
    const user = this.userRepository.create({
      username,
      passwordHash,
      publicKey,
      encryptedPrivateKeyBackup: encryptedPrivateKeyBackup ?? null,
    });

    await this.userRepository.save(user);

    return await this.generateAuthResponse(user);
  }

  async login(loginDto: LoginDto) {
    const { username, password } = loginDto;

    const user = await this.userRepository.findOne({
      where: { username },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return await this.generateAuthResponse(user);
  }

  private async generateAuthResponse(user: User) {
    const payload = { sub: user.id, username: user.username };
    const accessToken = this.jwtService.sign(payload);

    await this.revokeUserRefreshTokens(user.id);

    const refreshTokenValue = crypto.randomBytes(64).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRES_IN_DAYS);

    const refreshToken = this.refreshTokenRepository.create({
      token: refreshTokenValue,
      userId: user.id,
      expiresAt,
    });

    await this.refreshTokenRepository.save(refreshToken);

    return {
      accessToken,
      refreshToken: refreshTokenValue,
      user: {
        id: user.id,
        username: user.username,
        publicKey: user.publicKey,
        encryptedPrivateKeyBackup: user.encryptedPrivateKeyBackup ?? undefined,
      },
    };
  }

  async refreshAccessToken(refreshTokenValue: string) {
    const refreshToken = await this.refreshTokenRepository.findOne({
      where: { token: refreshTokenValue },
      relations: ['user'],
    });

    if (!refreshToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (refreshToken.expiresAt < new Date()) {
      await this.refreshTokenRepository.remove(refreshToken);
      throw new UnauthorizedException('Refresh token expired');
    }

    const user = await this.userRepository.findOne({
      where: { id: refreshToken.userId },
    });

    if (!user) {
      await this.refreshTokenRepository.remove(refreshToken);
      throw new NotFoundException('User not found');
    }

    const payload = { sub: user.id, username: user.username };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        username: user.username,
        publicKey: user.publicKey,
      },
    };
  }

  async restoreKeys(userId: string, password: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.encryptedPrivateKeyBackup) {
      throw new BadRequestException(
        'No key backup found. You registered before this feature existed.',
      );
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid password');
    }

    return {
      encryptedPrivateKeyBackup: user.encryptedPrivateKeyBackup,
      publicKey: user.publicKey,
    };
  }

  async revokeRefreshToken(refreshTokenValue: string) {
    const refreshToken = await this.refreshTokenRepository.findOne({
      where: { token: refreshTokenValue },
    });

    if (refreshToken) {
      await this.refreshTokenRepository.remove(refreshToken);
    }
  }

  private async revokeUserRefreshTokens(userId: string) {
    await this.refreshTokenRepository.delete({ userId });
  }
}
