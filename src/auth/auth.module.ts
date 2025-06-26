import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { MockDataModule } from '../mock/mock-data.module';
import { RedisStateService } from './redis-state.service';
import { TokenService } from './token.service';
import { AccessTokenGuard } from './access-token.guard';
import { MockDataService } from '../mock/mock-data.service';
import { QRCodeGeneratorService } from './qrcode-generator.service';

@Module({
  imports: [
    HttpModule,
    MockDataModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    MockDataService,
    RedisStateService,
    TokenService,
    AccessTokenGuard, // Added guard to providers
    QRCodeGeneratorService,
    // AccessTokenGuard, // Will be uncommented when guard is created
  ],
  exports: [AuthService, TokenService, AccessTokenGuard, RedisStateService], // Export guard if used globally or by other modules
})
export class AuthModule {}
