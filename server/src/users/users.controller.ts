import { Controller, Get, Param, UseGuards, Request } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async getCurrentUser(@Request() req) {
    return this.usersService.findById(req.user.userId);
  }

  @Get(':id')
  async getUserById(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Get(':id/public-key')
  async getPublicKey(@Param('id') id: string) {
    const publicKey = await this.usersService.getPublicKey(id);
    return { publicKey };
  }

  @Get()
  async getAllUsers(@Request() req) {
    // Return all users except the current user
    return this.usersService.findAll();
  }
}
