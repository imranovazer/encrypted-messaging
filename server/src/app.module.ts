import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { User } from './entities/user.entity';
import { Message } from './entities/message.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT, 10) || 5432,
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_DATABASE || 'encrypted_messaging',
      entities: [User, Message],
      synchronize: process.env.NODE_ENV !== 'production', // Auto-create tables in development
    }),
    TypeOrmModule.forFeature([User, Message]),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
