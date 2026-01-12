import { Injectable, NotFoundException, ForbiddenException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from '../entities/message.entity';
import { User } from '../entities/user.entity';
import { SendMessageDto } from './dto/send-message.dto';
import { ChatGateway } from '../gateway/chat.gateway';

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

  async sendMessage(senderId: string, sendMessageDto: SendMessageDto) {
    const { recipientId, encryptedContent, encryptedAesKey, signature } = sendMessageDto;

    // Verify recipient exists
    const recipient = await this.userRepository.findOne({
      where: { id: recipientId },
    });

    if (!recipient) {
      throw new NotFoundException('Recipient not found');
    }

    // Create and save message
    const message = this.messageRepository.create({
      senderId,
      recipientId,
      encryptedContent,
      encryptedAesKey,
      signature: signature || null,
    });

    const savedMessage = await this.messageRepository.save(message);

    // Load relations for emitting
    const messageWithRelations = await this.messageRepository.findOne({
      where: { id: savedMessage.id },
      relations: ['sender', 'recipient'],
    });

    // Emit new message event to recipient via WebSocket
    if (messageWithRelations) {
      const messagePayload = {
        id: messageWithRelations.id,
        senderId: messageWithRelations.senderId,
        recipientId: messageWithRelations.recipientId,
        sender: {
          id: messageWithRelations.sender.id,
          username: messageWithRelations.sender.username,
        },
        recipient: {
          id: messageWithRelations.recipient.id,
          username: messageWithRelations.recipient.username,
        },
        encryptedContent: messageWithRelations.encryptedContent,
        encryptedAesKey: messageWithRelations.encryptedAesKey,
        signature: messageWithRelations.signature,
        timestamp: messageWithRelations.timestamp,
      };
      await this.chatGateway.emitNewMessage(messagePayload);
    }

    return savedMessage;
  }

  async getMessages(userId: string, otherUserId?: string) {
    const queryBuilder = this.messageRepository
      .createQueryBuilder('message')
      .leftJoinAndSelect('message.sender', 'sender')
      .leftJoinAndSelect('message.recipient', 'recipient')
      .where(
        '(message.senderId = :userId OR message.recipientId = :userId)',
        { userId },
      )
      .orderBy('message.timestamp', 'ASC');

    if (otherUserId) {
      queryBuilder.andWhere(
        '(message.senderId = :otherUserId OR message.recipientId = :otherUserId)',
        { otherUserId },
      );
    }

    const messages = await queryBuilder.getMany();

    // Return messages with only necessary fields (no password hashes)
    return messages.map((msg) => ({
      id: msg.id,
      senderId: msg.senderId,
      recipientId: msg.recipientId,
      sender: {
        id: msg.sender.id,
        username: msg.sender.username,
      },
      recipient: {
        id: msg.recipient.id,
        username: msg.recipient.username,
      },
      encryptedContent: msg.encryptedContent,
      encryptedAesKey: msg.encryptedAesKey,
      signature: msg.signature,
      timestamp: msg.timestamp,
    }));
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

  async getMessageById(messageId: string, userId: string) {
    const message = await this.messageRepository.findOne({
      where: { id: messageId },
      relations: ['sender', 'recipient'],
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    // Verify user is either sender or recipient
    if (message.senderId !== userId && message.recipientId !== userId) {
      throw new ForbiddenException('You do not have access to this message');
    }

    return {
      id: message.id,
      senderId: message.senderId,
      recipientId: message.recipientId,
      sender: {
        id: message.sender.id,
        username: message.sender.username,
      },
      recipient: {
        id: message.recipient.id,
        username: message.recipient.username,
      },
      encryptedContent: message.encryptedContent,
      encryptedAesKey: message.encryptedAesKey,
      signature: message.signature,
      timestamp: message.timestamp,
    };
  }
}
