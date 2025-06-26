import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { decrypt } from '../common/crypto.util';

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);
  private readonly accessTokenCookieName: string;
  private readonly refreshTokenCookieName: string;
  private readonly expiryCookieName: string;
  private readonly encryptionKey: string;

  constructor(private readonly configService: ConfigService) {
    this.accessTokenCookieName = this.configService.get<string>(
      'DIGILOCKER_COOKIE_ACCESS_TOKEN_NAME',
      'dl_token',
    );
    this.refreshTokenCookieName = this.configService.get<string>(
      'DIGILOCKER_COOKIE_REFRESH_TOKEN_NAME',
      'dl_rtoken',
    );
    this.expiryCookieName = this.configService.get<string>(
      'DIGILOCKER_COOKIE_EXPIRY_NAME',
      'dl_expires_at',
    );
    this.encryptionKey = this.configService.get<string>(
      'CONFIG_ENC_KEY',
    ) as string;
    if (!this.encryptionKey) {
      this.logger.error(
        'CONFIG_ENC_KEY is not defined! Refresh token decryption will fail.',
      );
    }
  }

  getAccessTokenFromRequest(req: Request): string | undefined {
    return req.cookies[this.accessTokenCookieName];
  }

  getRefreshTokenFromRequest(req: Request): string | undefined {
    const encryptedRefreshToken = req.cookies[this.refreshTokenCookieName];
    if (!encryptedRefreshToken) {
      return undefined;
    }

    if (!this.encryptionKey) {
      this.logger.error(
        'Cannot decrypt refresh token: Encryption key is not configured.',
      );
      return undefined;
    }

    try {
      const decryptedToken = decrypt(encryptedRefreshToken, this.encryptionKey);
      return decryptedToken;
    } catch (error) {
      this.logger.warn(
        `Failed to decrypt refresh token: ${error.message}. Returning undefined.`,
      );
      return undefined;
    }
  }

  getExpiryTimestampFromRequest(req: Request): number | undefined {
    const expiryValue = req.cookies[this.expiryCookieName];
    if (!expiryValue) {
      return undefined;
    }
    const timestamp = parseInt(expiryValue, 10);
    return isNaN(timestamp) ? undefined : timestamp;
  }

  isExpired(req: Request): boolean {
    const expiryTimestamp = this.getExpiryTimestampFromRequest(req);
    if (expiryTimestamp === undefined) {
      return true;
    }
    return Date.now() >= expiryTimestamp;
  }

  secondsLeft(req: Request): number {
    const expiryTimestamp = this.getExpiryTimestampFromRequest(req);
    if (expiryTimestamp === undefined) {
      return 0;
    }
    const now = Date.now();
    if (now >= expiryTimestamp) {
      return 0;
    }
    return Math.floor((expiryTimestamp - now) / 1000);
  }

  // Helper method to set cookies, will be used by auth.controller.ts
  // response object (res) will be needed to set cookies
  // This is a conceptual placement; might be better in auth.service.ts or controller
  // For now, let's assume auth.controller will handle cookie setting directly
  // or call a method in AuthService that uses this.

  // Example of how cookies would be set (conceptual)
  // setAuthCookies(
  //   res: Response,
  //   accessToken: string,
  //   refreshToken: string,
  //   expiresIn: number, // seconds
  // ) {
  //   const expiresAt = Date.now() + expiresIn * 1000;
  //   const cookieOptions = {
  //     httpOnly: true,
  //     secure: this.configService.get('NODE_ENV') === 'production', // Use secure cookies in production
  //     sameSite: 'lax', // Or 'strict'
  //     // path: '/', // Set cookie path if necessary
  //   };

  //   res.cookie(this.accessTokenCookieName, accessToken, cookieOptions);
  //   res.cookie(this.expiryCookieName, expiresAt.toString(), cookieOptions);

  //   // Refresh token cookie might have a longer expiry
  //   const refreshTokenMaxAge = this.configService.get<number>('DIGILOCKER_REFRESH_TOKEN_COOKIE_MAX_AGE_MS', 7 * 24 * 60 * 60 * 1000); // 7 days
  //   res.cookie(this.refreshTokenCookieName, refreshToken, {
  //     ...cookieOptions,
  //     maxAge: refreshTokenMaxAge,
  //     // Add encryption for refresh token cookie if not already handled
  //   });
  // }

  // clearAuthCookies(res: Response) {
  //   const cookieOptions = {
  //     httpOnly: true,
  //     secure: this.configService.get('NODE_ENV') === 'production',
  //     sameSite: 'lax',
  //     // path: '/',
  //   };
  //   res.clearCookie(this.accessTokenCookieName, cookieOptions);
  //   res.clearCookie(this.expiryCookieName, cookieOptions);
  //   res.clearCookie(this.refreshTokenCookieName, cookieOptions);
  // }
}
