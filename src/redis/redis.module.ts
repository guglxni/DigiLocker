import { Global, Module, Logger } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Global()
@Module({
  imports: [
    CacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const logger = new Logger('CacheModuleSetup');
        logger.log('Using in-memory cache for simplified setup');
        
        return {
          ttl: 600000, // 10 minutes
        };
      },
    }),
  ],
  providers: [
    {
      provide: 'REDIS_CLIENT',
      useFactory: (configService: ConfigService) => {
        const logger = new Logger('RedisProvider');
        logger.log('Using mock Redis client for simplified setup');
        
        // Simple mock Redis client
        return {
          get: async () => null,
          set: async () => 'OK',
          del: async () => 1,
          exists: async () => 0,
        };
      },
      inject: [ConfigService],
    },
  ],
  exports: [CacheModule, 'REDIS_CLIENT'],
})
export class RedisModule {}
