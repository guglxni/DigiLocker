import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { TokenService } from './token.service';
import { AuthService } from './auth.service';
import * as jwt from 'jsonwebtoken'; // For mock mode JWT verification

@Injectable()
export class AccessTokenGuard implements CanActivate {
  private readonly isMockMode: boolean;
  private readonly jwtSecret: string;
  private readonly logger = new Logger(AccessTokenGuard.name);

  constructor(
    private readonly tokenService: TokenService,
    private readonly authService: AuthService, // For token refresh logic
    private readonly configService: ConfigService,
  ) {
    this.isMockMode =
      this.configService.get<string>('NODE_ENV') !== 'production' &&
      this.configService.get<string>('DIGILOCKER_CLIENT_ID') ===
        'mock-client-id';
    this.jwtSecret = this.configService.get<string>(
      'JWT_SECRET',
      'default-secret',
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    const accessToken = this.tokenService.getAccessTokenFromRequest(request);

    if (this.isMockMode) {
      if (!accessToken) {
        throw new UnauthorizedException('Mock Mode: No access token found.');
      }
      try {
        const decoded = jwt.verify(accessToken, this.jwtSecret);
        request['user'] = decoded; // Attach payload to request
        return true;
      } catch (_error: any) {
        // In mock mode, if JWT verification fails, we don't attempt refresh.
        // This assumes mock tokens are self-contained and don't have a refresh mechanism.
        throw new UnauthorizedException('Mock Mode: Invalid or expired token.');
      }
    }

    // Real (non-mock) mode
    if (!accessToken) {
      throw new UnauthorizedException('Access token not found.');
    }

    const isTokenExpired = this.tokenService.isExpired(request);

    if (isTokenExpired) {
      const refreshToken =
        this.tokenService.getRefreshTokenFromRequest(request);
      if (!refreshToken) {
        throw new UnauthorizedException(
          'Access token expired and no refresh token found.',
        );
      }

      try {
        // The authService.refreshAccessTokenAndSetCookies method will handle:
        // 1. Calling DigiLocker to get a new access_token and refresh_token.
        // 2. Setting the new cookies (dl_token, dl_rtoken, dl_expires_at).
        // 3. Returning the new accessToken or a success indicator.
        // It needs access to the `response` object to set cookies.
        const refreshedSuccessfully =
          await this.authService.refreshAccessTokenAndSetCookies(
            refreshToken,
            response,
          );

        if (!refreshedSuccessfully) {
          throw new UnauthorizedException('Failed to refresh access token.');
        }
        // After successful refresh, the new token is in the cookie.
        // The request can proceed.
        // We might want to re-validate the new token or simply trust the refresh was successful
        // For now, we assume success means the new token is valid.
        // If the refresh process also returns the user payload, we can attach it.
        // For opaque tokens, there's no payload to attach directly from the token.
        // We might need a separate call to /userinfo if req.user is needed immediately after refresh.
        // For now, we'll just allow access.
        try {
          const currentToken = this.tokenService.getAccessTokenFromRequest(request);
          if (!currentToken) {
            this.logger.warn('[AccessTokenGuard] Unable to retrieve token after validation/refresh in real mode.');
            throw new UnauthorizedException('Unable to retrieve token post-validation.');
          }
          const userInfo = await this.authService.getUser(currentToken); // Fetch user info
          request['user'] = userInfo; // Populate req.user
          this.logger.log('[AccessTokenGuard] req.user populated in real mode.');
          return true;
        } catch (error) {
          this.logger.error('[AccessTokenGuard] Failed to fetch/set user info in real mode after token validation/refresh', error.stack);
          // If error is already Unauthorized, rethrow it, otherwise wrap it.
          if (error instanceof UnauthorizedException) throw error;
          throw new UnauthorizedException('Could not retrieve user details to complete authentication.');
        }
      } catch (error) {
        // Clear potentially compromised/invalid cookies if refresh fails catastrophically
        // await this.authService.clearAuthCookies(response); // Consider this
        if (error instanceof UnauthorizedException) {
          throw error; // Re-throw if it's already an UnauthorizedException
        }
        throw new UnauthorizedException(
          'Session expired. Please log in again.',
        );
      }
    }

    // If token is present and not expired (in real mode), allow access.
    // For opaque tokens, we don't have a payload to attach to req.user here.
    // req.user would be populated by specific routes calling userinfo endpoints.
    return true;
  }
}
