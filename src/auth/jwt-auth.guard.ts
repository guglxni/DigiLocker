import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger, // For logging missing JWT_SECRET
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { Request } from 'express';

interface JwtPayload {
  // Define the expected structure of your JWT payload
  sub?: string; // Standard subject claim
  username?: string;
  // Add other claims you expect, e.g., roles, iat, exp
  iat?: number;
  exp?: number;
  [key: string]: any; // Allow other properties
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(private readonly configService: ConfigService) {}

  // eslint-disable-next-line @typescript-eslint/require-await
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Moved JWT_SECRET check to the absolute beginning
    const jwtSecret = this.configService.get<string>('JWT_SECRET');
    if (!jwtSecret) {
      this.logger.error(
        'CRITICAL: JWT_SECRET is not configured. Cannot validate any JWTs.',
      );
      throw new UnauthorizedException('Authentication configuration error');
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: JwtPayload }>();
    const token = this.extractToken(request);

    // Safely get and call isMock
    const isMockFn = this.configService.get<() => boolean>('isMock');
    const isMock = typeof isMockFn === 'function' ? isMockFn() : false;

    if (isMock && !token) {
      request.user = { mock: true, reason: 'No token in mock mode' };
      this.logger.warn('Mock mode: Access granted without token validation.');
      return true;
    }

    if (!token) {
      this.logger.warn('Token not found in request.');
      throw new UnauthorizedException('Token not found');
    }

    try {
      const payload = jwt.verify(token, jwtSecret) as JwtPayload;
      request.user = payload;
      return true;
    } catch (error: any) {
      if (error instanceof jwt.TokenExpiredError) {
        this.logger.warn(`Token expired: ${error.message}`);
        throw new UnauthorizedException('Token expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        this.logger.warn(`Invalid token: ${error.message}`);
        throw new UnauthorizedException('Invalid token');
      }
      // For other errors
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown authentication error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Unexpected error during token verification: ${errorMessage}`,
        errorStack,
      );
      throw new UnauthorizedException('Authentication failed');
    }
  }

  private extractToken(request: Request): string | undefined {
    const authHeader = request.headers?.authorization;
    if (authHeader) {
      const [type, tokenValue] = authHeader.split(' ') ?? [];
      if (type === 'Bearer' && tokenValue) {
        return tokenValue;
      }
    }

    if (request.cookies && typeof request.cookies.dl_token === 'string') {
      return request.cookies.dl_token;
    }

    return undefined;
  }
}
