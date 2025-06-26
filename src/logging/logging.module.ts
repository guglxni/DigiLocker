import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const isDevelopment =
          configService.get<string>('NODE_ENV') === 'development';
        
        // Map NestJS log levels to Pino log levels
        const nestLogLevel = configService.get<string>('LOG_LEVEL', 'log');
        let pinoLevel = 'info'; // Default mapping for 'log'
        
        // Map NestJS log levels to Pino levels
        switch (nestLogLevel) {
          case 'log':
            pinoLevel = 'info';
            break;
          case 'error':
            pinoLevel = 'error';
            break;
          case 'warn':
            pinoLevel = 'warn';
            break;
          case 'debug':
            pinoLevel = 'debug';
            break;
          case 'verbose':
            pinoLevel = 'trace';
            break;
          default:
            pinoLevel = 'info'; // Safe default
        }
        
        return {
          pinoHttp: {
            level: pinoLevel,
            transport: isDevelopment
              ? {
                  target: 'pino-pretty',
                  options: { colorize: true, singleLine: true },
                }
              : undefined,
            // Other pino-http options can be added here
            // For example, to add custom serializers or redact paths:
            // serializers: {
            //   req: (req) => ({
            //     method: req.method,
            //     url: req.url,
            //     // Do not log sensitive headers
            //     headers: undefined,
            //   }),
            //   res: (res) => ({
            //     statusCode: res.statusCode,
            //   }),
            // },
            // redact: ['req.headers.authorization', 'req.headers.cookie'],
          },
        };
      },
    }),
  ],
  exports: [LoggerModule], // Export LoggerModule so AppLogger is available globally
})
export class LoggingModule {}
