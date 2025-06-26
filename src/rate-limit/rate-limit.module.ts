import { Module, Global, Logger } from '@nestjs/common';
import { ThrottlerModule, ThrottlerModuleOptions } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Global()
@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService): ThrottlerModuleOptions => {
        const logger = new Logger('RateLimitModuleSetup');
        const nodeEnv = configService.get<string>('NODE_ENV');
        
        const throttlerOptions: ThrottlerModuleOptions = {
          throttlers: [{
            ttl: configService.get<number>('THROTTLE_TTL', 60) * 1000,
            limit: configService.get<number>('THROTTLE_LIMIT', 60),
          }],
        };

        if (nodeEnv === 'test' || nodeEnv === 'mock') {
          logger.log(
            `[RateLimitModuleSetup] ${nodeEnv} environment: Throttler using default in-memory storage.`,
          );
        } else {
          const redisUrl = configService.get<string>('REDIS_URL');
          logger.log(
            `[RateLimitModuleSetup] Non-test environment (${nodeEnv}): Throttler attempting to use REDIS_URL: ${redisUrl}`,
          );
          if (!redisUrl) {
            logger.error(
              '[RateLimitModuleSetup] CRITICAL: REDIS_URL is not configured for non-test env. Throttler will use default in-memory storage (RISK OF INCONSISTENCY WITH PRODUCTION BEHAVIOR). Check environment configuration.',
            );
          } else {
            throttlerOptions.storage = new ThrottlerStorageRedisService(redisUrl);
          }
        }
        return throttlerOptions;
      },
    }),
  ],
  // No providers needed here as ThrottlerModule exports ThrottlerGuard
  exports: [ThrottlerModule], // Export ThrottlerModule itself
})
export class RateLimitModule {}
