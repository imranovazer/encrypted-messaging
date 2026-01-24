import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  username: string;

  @Column()
  passwordHash: string;

  @Column('text')
  publicKey: string;

  @Column('text', { nullable: true })
  encryptedPrivateKeyBackup: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
