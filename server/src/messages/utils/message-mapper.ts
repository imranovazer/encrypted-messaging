import { Message } from '../../entities/message.entity';

export interface MessageDto {
  id: string;
  senderId: string;
  recipientId: string;
  sender: {
    id: string;
    username: string;
  };
  recipient: {
    id: string;
    username: string;
  };
  encryptedContent: string;
  encryptedAesKey: string;
  senderEncryptedAesKey: string | null;
  signature: string | null;
  timestamp: Date;
}

export function mapMessageToDto(message: Message): MessageDto {
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
    senderEncryptedAesKey: message.senderEncryptedAesKey,
    signature: message.signature,
    timestamp: message.timestamp,
  };
}

export function mapMessagesToDto(messages: Message[]): MessageDto[] {
  return messages.map(mapMessageToDto);
}
