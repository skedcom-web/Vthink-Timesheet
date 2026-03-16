import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { MailerService } from './mailer.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports:     [PrismaModule],
  controllers: [UsersController],
  providers:   [UsersService, MailerService],
  exports:     [UsersService],
})
export class UsersModule {}
