import { IsString, IsNotEmpty, IsUUID, IsOptional } from 'class-validator';

export class SendMessageDto {
  @IsUUID()
  @IsNotEmpty()
  recipientId: string;

  @IsString()
  @IsNotEmpty()
  encryptedContent: string;

  @IsString()
  @IsNotEmpty()
  encryptedAesKey: string;

  @IsString()
  @IsOptional()
  senderEncryptedAesKey?: string;
}
