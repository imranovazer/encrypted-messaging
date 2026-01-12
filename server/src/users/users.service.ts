import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async findById(id: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id },
      select: ['id', 'username', 'publicKey', 'createdAt'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async findByUsername(username: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { username },
      select: ['id', 'username', 'publicKey', 'createdAt'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async getPublicKey(userId: string): Promise<string> {
    const user = await this.findById(userId);
    return user.publicKey;
  }

  async getAllUsers(excludeUserId: string): Promise<User[]> {
    return this.userRepository
      .createQueryBuilder('user')
      .where('user.id != :excludeUserId', { excludeUserId })
      .select(['user.id', 'user.username', 'user.publicKey', 'user.createdAt'])
      .getMany();
  }

  async findAll(): Promise<User[]> {
    return this.userRepository.find({
      select: ['id', 'username', 'publicKey', 'createdAt'],
    });
  }
}
