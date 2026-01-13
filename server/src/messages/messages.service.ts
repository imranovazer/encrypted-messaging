import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from '../entities/message.entity';
import { User } from '../entities/user.entity';
import { SendMessageDto } from './dto/send-message.dto';
import { ChatGateway } from '../gateway/chat.gateway';
import {
  mapMessageToDto,
  mapMessagesToDto,
  MessageDto,
} from './utils/message-mapper';

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Message)
    private messageRepository: Repository<Message>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @Inject(forwardRef(() => ChatGateway))
    private chatGateway: ChatGateway,
  ) {}

  async sendMessage(
    senderId: string,
    sendMessageDto: SendMessageDto,
  ): Promise<MessageDto> {
    const {
      recipientId,
      encryptedContent,
      encryptedAesKey,
      senderEncryptedAesKey,
      signature,
    } = sendMessageDto;

    const recipient = await this.verifyRecipientExists(recipientId);

    const message = this.messageRepository.create({
      senderId,
      recipientId,
      encryptedContent,
      encryptedAesKey,
      senderEncryptedAesKey: senderEncryptedAesKey ?? null,
      signature: signature ?? null,
    });

    const savedMessage = await this.messageRepository.save(message);
    const messageWithRelations = await this.loadMessageWithRelations(
      savedMessage.id,
    );

    if (messageWithRelations) {
      const messageDto = mapMessageToDto(messageWithRelations);
      await this.chatGateway.emitNewMessage(messageDto);
      return messageDto;
    }

    throw new NotFoundException('Failed to load saved message');
  }

  private async verifyRecipientExists(recipientId: string): Promise<User> {
    const recipient = await this.userRepository.findOne({
      where: { id: recipientId },
    });

    if (!recipient) {
      throw new NotFoundException('Recipient not found');
    }

    return recipient;
  }

  private async loadMessageWithRelations(
    messageId: string,
  ): Promise<Message | null> {
    return this.messageRepository.findOne({
      where: { id: messageId },
      relations: ['sender', 'recipient'],
    });
  }

  async getMessages(
    userId: string,
    otherUserId?: string,
  ): Promise<MessageDto[]> {
    const queryBuilder = this.messageRepository
      .createQueryBuilder('message')
      .leftJoinAndSelect('message.sender', 'sender')
      .leftJoinAndSelect('message.recipient', 'recipient')
      .where('(message.senderId = :userId OR message.recipientId = :userId)', {
        userId,
      })
      .orderBy('message.timestamp', 'ASC');

    if (otherUserId) {
      queryBuilder.andWhere(
        '(message.senderId = :otherUserId OR message.recipientId = :otherUserId)',
        { otherUserId },
      );
    }

    const messages = await queryBuilder.getMany();
    return mapMessagesToDto(messages);
  }

  async getConversation(userId: string, otherUserId: string) {
    // Verify other user exists
    const otherUser = await this.userRepository.findOne({
      where: { id: otherUserId },
    });

    if (!otherUser) {
      throw new NotFoundException('User not found');
    }

    return this.getMessages(userId, otherUserId);
  }

  async getMessageById(messageId: string, userId: string): Promise<MessageDto> {
    const message = await this.messageRepository.findOne({
      where: { id: messageId },
      relations: ['sender', 'recipient'],
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.senderId !== userId && message.recipientId !== userId) {
      throw new ForbiddenException('You do not have access to this message');
    }

    return mapMessageToDto(message);
  }
}
