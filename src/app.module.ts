import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import configuration from './config/configuration';
import { AuthModule } from './auth/auth.module';
import { DigilockerModule } from './digilocker/digilocker.module';
import { RedisModule } from './redis/redis.module';
import { HealthModule } from './health/health.module';
import { MockDataModule } from './mock/mock-data.module';
import { ApiSetuModule } from './apisetu/apisetu.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [configuration],
      isGlobal: true,
      cache: true,
      ignoreEnvFile: true,
    }),
    RedisModule,
    AuthModule,
    DigilockerModule,
    HealthModule,
    MockDataModule,
    ApiSetuModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
