import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
import { Message } from '../entities/message.entity';
import { User } from '../entities/user.entity';
import { ChatModule } from '../gateway/chat.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Message, User]),
    forwardRef(() => ChatModule),
  ],
  controllers: [MessagesController],
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagesModule {}
