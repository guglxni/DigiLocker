import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ApiSetuService } from './apisetu.service';
import { ApiSetuController } from './apisetu.controller';

@Module({
  imports: [ConfigModule],
  controllers: [ApiSetuController],
  providers: [ApiSetuService],
  exports: [ApiSetuService],
})
export class ApiSetuModule {} 