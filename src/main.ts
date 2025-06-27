import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  const bootstrapLogger = new Logger('Bootstrap');
  bootstrapLogger.log(`[main.ts] Starting DigiLocker Demo - Environment: ${process.env.NODE_ENV || 'sandbox'}`);

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Enable CORS for frontend communication
  app.enableCors({
    origin: [
      'http://localhost:3000', 
      'http://localhost:3007',
      /^https:\/\/.*\.app\.github\.dev$/,  // Allow Codespace URLs
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Serve static files for demo pages
  app.useStaticAssets(join(__dirname, '..', 'public'));

  // Essential middleware
  app.use(cookieParser());
  
  // Request validation
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
  }));

  // API Documentation
  const config = new DocumentBuilder()
    .setTitle('DigiLocker Demo API')
    .setDescription('Core DigiLocker integration with live Setu sandbox')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = 3007;
  await app.listen(port, '0.0.0.0');
  
  bootstrapLogger.log(`🚀 DigiLocker Demo running on: http://localhost:${port}`);
  bootstrapLogger.log(`📚 API Documentation: http://localhost:${port}/docs`);
  bootstrapLogger.log(`✅ Live Setu sandbox integration active`);
}

bootstrap().catch(console.error);
