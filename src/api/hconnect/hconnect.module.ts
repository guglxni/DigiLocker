import { Module } from '@nestjs/common';
import { HConnectController } from './hconnect.controller';
import { AuthModule } from '../../auth/auth.module';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    AuthModule,
    HttpModule,
    ConfigModule
  ],
  controllers: [HConnectController],
  providers: [],
})
export class HConnectModule {} 