import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import { SendMessageDto } from './dto/send-message.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post()
  async sendMessage(@Request() req, @Body() sendMessageDto: SendMessageDto) {
    return this.messagesService.sendMessage(req.user.userId, sendMessageDto);
  }

  @Get()
  async getMessages(@Request() req) {
    return this.messagesService.getMessages(req.user.userId);
  }

  @Get('conversation/:userId')
  async getConversation(@Request() req, @Param('userId') userId: string) {
    return this.messagesService.getConversation(req.user.userId, userId);
  }

  @Get(':id')
  async getMessageById(@Request() req, @Param('id') id: string) {
    return this.messagesService.getMessageById(id, req.user.userId);
  }
}
