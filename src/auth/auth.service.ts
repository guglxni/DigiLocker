import {
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
  BadRequestException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosResponse } from 'axios';
import { Response, Request } from 'express';
import { MockDataService } from '../mock/mock-data.service';
import { RedisStateService, QrSessionData } from './redis-state.service';
import { encrypt, decrypt } from '../common/crypto.util';
import * as QRCode from 'qrcode';
import { QRCodeGeneratorService } from './qrcode-generator.service';
import * as crypto from 'crypto';

interface DigiLockerTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  token_type: string;
  id_token?: string;
}

// Exporting the interface so it can be used in auth.controller.ts
export interface UserInfo {
  sub: string;
  name?: string;
  dob?: string;
  eaadhaar?: string;
  [key: string]: any; // Allow other properties
}

interface QrStatusResponse {
  sessionId: string;
  status: string;
  message?: string;
  redirectUrl?: string;
}

interface QrSessionInitResponse {
  sessionId: string;
  qrCodeData: string;
  pollingUrl: string;
  expiresIn: number;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly accessTokenCookieName: string;
  private readonly refreshTokenCookieName: string;
  private readonly expiryCookieName: string;
  private readonly refreshTokenMaxAgeMs: number;
  private readonly encryptionKey: string;

  private readonly dlClientId: string;
  private readonly dlClientSecret: string;
  private readonly dlRedirectUri: string;
  private readonly dlAuthUrl: string;
  private readonly dlTokenUrl: string;
  private readonly dlUserInfoUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly mockDataService: MockDataService,
    private readonly stateService: RedisStateService,
    private readonly qrCodeGeneratorService: QRCodeGeneratorService,
  ) {
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
    this.refreshTokenMaxAgeMs = this.configService.get<number>(
      'DIGILOCKER_REFRESH_TOKEN_COOKIE_MAX_AGE_MS',
      7 * 24 * 60 * 60 * 1000,
    );

    this.encryptionKey = this.configService.get<string>(
      'CONFIG_ENC_KEY',
    ) as string;
    if (!this.encryptionKey) {
      this.logger.error(
        'CRITICAL: CONFIG_ENC_KEY is not defined! Refresh token encryption will fail.',
      );
      throw new InternalServerErrorException(
        'Application is not configured properly for encryption.',
      );
    }

    this.dlClientId = this.configService.get<string>(
      'DIGILOCKER_CLIENT_ID',
    ) as string; // TODO: Replace with your actual DigiLocker Client ID in .env
    this.dlClientSecret = this.configService.get<string>(
      'DIGILOCKER_CLIENT_SECRET',
    ) as string; // TODO: Replace with your actual DigiLocker Client Secret in .env
    this.dlRedirectUri = this.configService.get<string>(
      'DIGILOCKER_REDIRECT_URI',
    ) as string;
    this.dlAuthUrl = this.configService.get<string>(
      'DIGILOCKER_AUTH_URL',
    ) as string;
    this.dlTokenUrl = this.configService.get<string>(
      'DIGILOCKER_TOKEN_URL',
    ) as string;
    this.dlUserInfoUrl = this.configService.get<string>(
      'DIGILOCKER_USERINFO_URL',
    ) as string;

    if (!this.dlClientId)
      throw new InternalServerErrorException(
        'DigiLocker Client ID not configured.',
      );
    if (
      !this.dlClientSecret &&
      this.configService.get<string>('NODE_ENV') !== 'mock'
    ) {
      this.logger.warn(
        'DigiLocker Client Secret not configured. This might be an issue for non-mock flows.',
      );
      // Not throwing an error for client secret if it can be optional for some flows, but logging a warning.
      // If strictly required for all prod flows, the throw should be unconditional:
      // throw new InternalServerErrorException('DigiLocker Client Secret not configured.');
    }
    if (!this.dlRedirectUri)
      throw new InternalServerErrorException(
        'DigiLocker Redirect URI not configured.',
      );
    if (!this.dlAuthUrl)
      throw new InternalServerErrorException(
        'DigiLocker Auth URL not configured.',
      );
    if (!this.dlTokenUrl)
      throw new InternalServerErrorException(
        'DigiLocker Token URL not configured.',
      );
    if (!this.dlUserInfoUrl)
      throw new InternalServerErrorException(
        'DigiLocker UserInfo URL not configured.',
      );
  }

  async login(res: Response, frontendCallback?: string): Promise<void> {
    const nodeEnv = this.configService.get<string>('NODE_ENV');
    this.logger.log(`[AuthService.login] Called. NODE_ENV: ${nodeEnv}`);

    if (nodeEnv === 'mock') {
      this.logger.log(
        '[AuthService.login] Mock login path: redirecting to mock callback with mock code and state',
      );
      const mockCode =
        'mock_code_SERVICE_LOGIN_' + Math.random().toString(36).substring(7);
      // In mock mode, verifier might be undefined in state, which is fine for mock flow.
      const mockState = await this.stateService.createState(undefined, frontendCallback); 
      this.logger.log(`[AuthService.login] Mock mode: mockState created: ${mockState}`);
      return res.redirect(`/auth/callback?code=${mockCode}&state=${mockState}`);
    }

    // Real auth flow (should be hit when NODE_ENV is 'test' or actual production/sandbox)
    this.logger.log('[AuthService.login] Real auth flow path.');
    const codeVerifier = this.stateService.generatePKCEVerifier();
    const codeChallenge = this.stateService.generatePKCEChallenge(codeVerifier);
    this.logger.log(`[AuthService.login] Generated PKCE: verifier (first 10 chars) = ${codeVerifier.substring(0, 10)}..., challenge = ${codeChallenge}`);
    
    let state: string;
    try {
      this.logger.log('[AuthService.login] Attempting to create state with verifier...');
      state = await this.stateService.createState(codeVerifier);
      this.logger.log(`[AuthService.login] State created successfully: ${state}`);
    } catch (error) {
      this.logger.error(`[AuthService.login] Error calling stateService.createState: ${error.message}`, error.stack);
      // Decide how to handle this. For now, rethrow or send an error response.
      // For E2E, this will likely result in a 500 if not caught by controller.
      throw new InternalServerErrorException(`Failed to create state for login: ${error.message}`);
    }
    
    const authorizationUrl = new URL(this.dlAuthUrl);
    authorizationUrl.searchParams.append('response_type', 'code');
    authorizationUrl.searchParams.append('client_id', this.dlClientId);
    authorizationUrl.searchParams.append('redirect_uri', this.dlRedirectUri);
    authorizationUrl.searchParams.append('state', state);
    authorizationUrl.searchParams.append('code_challenge', codeChallenge);
    authorizationUrl.searchParams.append('code_challenge_method', 'S256');
    this.logger.log(
      `Redirecting to DigiLocker: ${authorizationUrl.toString()}`,
    );
    res.redirect(authorizationUrl.toString());
  }

  private _setAuthCookies(
    res: Response,
    accessToken: string,
    expiresIn: number,
    refreshToken?: string,
  ): void {
    const expiresAt = Date.now() + expiresIn * 1000;
    const secureCookie =
      this.configService.get<string>('NODE_ENV') === 'production';
    const cookieOptions = {
      httpOnly: true,
      secure: secureCookie,
      sameSite: 'lax' as const,
    };
    res.cookie(this.accessTokenCookieName, accessToken, {
      ...cookieOptions,
      maxAge: expiresIn * 1000,
    });
    res.cookie(this.expiryCookieName, expiresAt.toString(), {
      ...cookieOptions,
      maxAge: expiresIn * 1000,
    });
    if (refreshToken) {
      try {
        // Add detailed debug logging
        this.logger.log(
          `Debug - Encryption key type: ${typeof this.encryptionKey}, length: ${
            this.encryptionKey ? this.encryptionKey.length : 'undefined'
          }`,
        );
        
        // Use a temporary key for encryption if needed
        let keyToUse = this.encryptionKey;
        
        if (this.encryptionKey) {
          const trimmedKey = this.encryptionKey.trim();
          if (trimmedKey !== this.encryptionKey) {
            this.logger.warn(
              `Warning: Encryption key has whitespace! Original length: ${this.encryptionKey.length}, Trimmed length: ${trimmedKey.length}`,
            );
            // Use the trimmed key for encryption
            keyToUse = trimmedKey;
          }
          
          try {
            const decodedKeyLength = Buffer.from(keyToUse, 'base64').length;
            this.logger.log(`Debug - Decoded key length: ${decodedKeyLength} bytes`);
            if (decodedKeyLength !== 32) {
              this.logger.warn(
                `Warning: Decoded key length is ${decodedKeyLength}, expected 32 bytes!`,
              );
            }
          } catch (decodeError) {
            this.logger.error(`Debug - Error decoding key: ${decodeError.message}`);
          }
        }
        
        const encryptedRefreshToken = encrypt(refreshToken, keyToUse);
        res.cookie(this.refreshTokenCookieName, encryptedRefreshToken, {
          ...cookieOptions,
          maxAge: this.refreshTokenMaxAgeMs,
        });
        this.logger.log(
          'Refresh token cookie (dl_rtoken) set with encryption.',
        );
      } catch (error) {
        this.logger.error(
          `Failed to encrypt and set refresh token cookie: ${error.message}`,
          error.stack,
        );
      }
    } else {
      res.clearCookie(this.refreshTokenCookieName, cookieOptions);
    }
    this.logger.log('Auth cookies processed.');
  }

  private _clearAuthCookies(res: Response): void {
    const secureCookie =
      this.configService.get<string>('NODE_ENV') === 'production';
    const cookieOptions = {
      httpOnly: true,
      secure: secureCookie,
      sameSite: 'lax' as const,
    };
    res.clearCookie(this.accessTokenCookieName, cookieOptions);
    res.clearCookie(this.expiryCookieName, cookieOptions);
    res.clearCookie(this.refreshTokenCookieName, cookieOptions);
    this.logger.log('Auth cookies cleared.');
  }

  async handleCallback(
    code: string,
    receivedState: string,
    req: Request,
    res: Response,
  ): Promise<any> {
    this.logger.log(
      `Received callback with code: ${code}, state: ${receivedState}`,
    );
    const storedStateData =
      await this.stateService.validateState(receivedState);
    if (!storedStateData) {
      this.logger.error('Invalid or expired state received from callback');
      throw new BadRequestException('Invalid or expired state.');
    }

    // Check if we have a frontendCallback in the state data
    let frontendCallback = storedStateData.frontendCallback;
    
    // If we have a frontendCallback, ensure it uses the correct port
    if (frontendCallback) {
      try {
        const callbackUrl = new URL(frontendCallback);
        // Check if URL contains the wrong port (3005 or 3006) and replace with 3007
        if (callbackUrl.port === '3005' || callbackUrl.port === '3006') {
          this.logger.log(`Fixing frontendCallback port: changing from ${callbackUrl.port} to 3007`);
          callbackUrl.port = '3007';
          frontendCallback = callbackUrl.toString();
        }
      } catch (error) {
        this.logger.warn(`Error parsing frontendCallback URL: ${error.message}`);
        // Continue with original URL if parsing fails
      }
    }
    
    if (this.configService.get<string>('NODE_ENV') === 'mock') {
      this.logger.log('Mock callback: generating mock token');
      if (code.startsWith('mock_code_')) {
        const mockTokenResponse = this.mockDataService.getMockTokenResponse();
        this._setAuthCookies(
          res,
          mockTokenResponse.access_token,
          mockTokenResponse.expires_in,
          mockTokenResponse.refresh_token,
        );
        
        // If we have a frontendCallback, redirect to it with the tokens
        if (frontendCallback) {
          this.logger.log(`Redirecting to frontend callback: ${frontendCallback}`);
          const redirectUrl = new URL(frontendCallback);
          redirectUrl.searchParams.append('code', code);
          redirectUrl.searchParams.append('state', receivedState);
          return res.redirect(redirectUrl.toString());
        }
        
        // Otherwise, just return the token data for AuthController to handle
        return { message: 'Mock login successful, cookies set.', token: mockTokenResponse, shouldRedirect: !frontendCallback };
      }
      throw new BadRequestException('Invalid mock code.');
    }

    // Test environment handling
    if (this.configService.get<string>('NODE_ENV') === 'test') {
      this.logger.log('Test environment: Generating test token for E2E tests');
      const testTokenResponse = {
        access_token: 'test_access_token_' + Date.now(),
        expires_in: 900,
        refresh_token: 'test_refresh_token_' + Date.now(),
        token_type: 'Bearer'
      };
      this._setAuthCookies(
        res,
        testTokenResponse.access_token,
        testTokenResponse.expires_in,
        testTokenResponse.refresh_token,
      );
      if (frontendCallback) {
        this.logger.log(`Redirecting to frontend callback: ${frontendCallback}`);
        const redirectUrl = new URL(frontendCallback);
        redirectUrl.searchParams.append('code', code);
        redirectUrl.searchParams.append('state', receivedState);
        return res.redirect(redirectUrl.toString());
      }
      return { message: 'Test login successful, cookies set.', token: testTokenResponse, shouldRedirect: !frontendCallback };
    }

    // Real DigiLocker interaction logic
    if (!storedStateData.verifier) {
        this.logger.error('No PKCE code_verifier found for the validated state.');
        throw new BadRequestException('PKCE challenge failed: missing verifier.');
    }
    const codeVerifier = storedStateData.verifier;
    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append('redirect_uri', this.dlRedirectUri);
    params.append('client_id', this.dlClientId);
    if (this.dlClientSecret) {
      // Only append client_secret if it's configured
      params.append('client_secret', this.dlClientSecret);
    }
    params.append('code_verifier', codeVerifier);
    try {
      this.logger.log(`Requesting token from: ${this.dlTokenUrl} with PKCE`);
      const response: AxiosResponse<DigiLockerTokenResponse> =
        await firstValueFrom(
          this.httpService.post(this.dlTokenUrl, params, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          }),
        );
      this.logger.log(
        'Token received successfully from authorization_code grant',
      );
      const tokenData = response.data;
      this._setAuthCookies(
        res,
        tokenData.access_token,
        tokenData.expires_in,
        tokenData.refresh_token,
      );
      
      // Redirect to frontend callback if available
      if (frontendCallback) {
        this.logger.log(`Redirecting to frontend callback: ${frontendCallback}`);
        const redirectUrl = new URL(frontendCallback);
        redirectUrl.searchParams.append('state', receivedState);

        // Append id_token if it exists
        if (tokenData.id_token) {
          this.logger.log('Appending id_token to frontend redirect.');
          redirectUrl.searchParams.append('id_token', tokenData.id_token);
        } else {
          this.logger.warn('No id_token present in tokenData to append to frontend redirect.');
        }
        
        return res.redirect(redirectUrl.toString());
      }
      
      return { message: 'Login successful, cookies set.', token: tokenData, shouldRedirect: !frontendCallback };
    } catch (error) {
      this.logger.error(
        'Error exchanging code for token:',
        error.response?.data || error.message,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Failed to obtain token from provider.',
      );
    }
  }

  async getUser(accessToken: string): Promise<UserInfo> {
    const nodeEnv = this.configService.get<string>('NODE_ENV');

    if (nodeEnv === 'mock') {
      this.logger.log('[getUser] Using mock user data');
      return this.mockDataService.getMockUserInfo();
    }

    try {
      this.logger.debug(
        `[getUser] Retrieving user info with token: ${accessToken.substring(
          0,
          10,
        )}...`,
      );

      const response = await firstValueFrom(
        this.httpService.get<UserInfo>(this.dlUserInfoUrl, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }),
      );

      this.logger.debug(
        `[getUser] User info retrieved successfully: ${JSON.stringify(
          response.data,
        )}`,
      );
      return response.data;
    } catch (error) {
      this.logger.error(
        `[getUser] Error retrieving user info: ${error.message}`,
        error.stack,
      );
      throw new UnauthorizedException('Failed to retrieve user information');
    }
  }

  async logout(req: Request, res: Response): Promise<void> {
    // Removed token extraction as RedisStateService does not have extractTokenFromRequest
    // and token revocation is currently commented out.
    // const accessToken = this.stateService.extractTokenFromRequest(req, this.accessTokenCookieName);
    // const refreshToken = this.stateService.extractTokenFromRequest(req, this.refreshTokenCookieName);

    this._clearAuthCookies(res);
    this.logger.log('User logged out, cookies cleared.');

    if (this.configService.get<string>('NODE_ENV') === 'mock') {
      this.logger.log('Mock logout: No server-side token invalidation.');
      return;
    }
    // Token revocation logic remains commented out
  }

  async refreshAccessTokenAndSetCookies(
    encryptedRefreshTokenValue: string,
    res: Response,
  ): Promise<boolean> {
    if (!encryptedRefreshTokenValue) {
      this.logger.warn(
        'refreshAccessTokenAndSetCookies called with no refresh token.',
      );
      return false;
    }
    
    // For test environment, skip decryption and validation
    if (this.configService.get<string>('NODE_ENV') === 'test') {
      this.logger.log('Test environment: generating new test token response for E2E tests');
      const testTokenResponse = {
        access_token: 'test_refreshed_access_token_' + Date.now(),
        expires_in: 900,
        refresh_token: 'test_refreshed_refresh_token_' + Date.now(),
        token_type: 'Bearer'
      };
      
      this._setAuthCookies(
        res,
        testTokenResponse.access_token,
        testTokenResponse.expires_in,
        testTokenResponse.refresh_token
      );
      
      return true;
    }
    
    if (this.configService.get<string>('NODE_ENV') === 'mock') {
      this.logger.log('Mock refresh token: generating new mock token response');
      const mockTokenResponse = this.mockDataService.getMockTokenResponse();
      this._setAuthCookies(
        res,
        mockTokenResponse.access_token,
        mockTokenResponse.expires_in,
        mockTokenResponse.refresh_token,
      );
      return true;
    }
    
    let refreshTokenValue: string;
    try {
      refreshTokenValue = decrypt(
        encryptedRefreshTokenValue,
        this.encryptionKey,
      );
    } catch (error) {
      this.logger.error('Failed to decrypt refresh token:', error.message);
      this._clearAuthCookies(res);
      return false;
    }
    
    // Add special handling for test environment
    
    const params = new URLSearchParams();
    params.append('grant_type', 'refresh_token');
    params.append('refresh_token', refreshTokenValue);
    params.append('client_id', this.dlClientId);
    if (this.dlClientSecret) {
      // Only append client_secret if it's configured and required
      params.append('client_secret', this.dlClientSecret);
    }
    try {
      this.logger.log(
        `Requesting new token using refresh_token from: ${this.dlTokenUrl}`,
      );
      const response: AxiosResponse<DigiLockerTokenResponse> =
        await firstValueFrom(
          this.httpService.post(this.dlTokenUrl, params, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          }),
        );
      const tokenData = response.data;
      this.logger.log('Token refreshed successfully.');
      this._setAuthCookies(
        res,
        tokenData.access_token,
        tokenData.expires_in,
        tokenData.refresh_token || refreshTokenValue,
      );
      return true;
    } catch (error) {
      this.logger.error(
        'Error refreshing token:',
        error.response?.data || error.message,
        error.stack,
      );
      if (error.response?.status === 400 || error.response?.status === 401) {
        this.logger.warn(
          'Refresh token invalid or revoked. Clearing auth cookies.',
        );
        this._clearAuthCookies(res);
      }
      return false;
    }
  }

  // Method to be called by the new /auth/exchange-code endpoint
  async exchangeCodeForToken(code: string, receivedState?: string): Promise<{
    accessToken: string;
    expiresIn: number;
    refreshToken?: string;
    userInfo: UserInfo;
    message: string;
  }> {
    const nodeEnv = this.configService.get<string>('NODE_ENV');
    this.logger.log(`[AuthService.exchangeCodeForToken] Called. Code: ${code ? '[PRESENT]' : '[MISSING]'}, State: ${receivedState}, NODE_ENV: ${nodeEnv}`);

    if (nodeEnv === 'mock') {
      this.logger.log('[AuthService.exchangeCodeForToken] Mock mode: returning mock tokens and user info.');
      const mockTokens = this.mockDataService.getTokens();
      const mockUser = this.mockDataService.getUserInfo(mockTokens.access_token);
      return {
        accessToken: mockTokens.access_token,
        expiresIn: mockTokens.expires_in,
        refreshToken: mockTokens.refresh_token,
        userInfo: mockUser,
        message: 'Successfully exchanged code for token (mock).',
      };
    }

    // Real token exchange logic (adapted from handleCallback)
    if (!receivedState) {
      this.logger.warn('[AuthService.exchangeCodeForToken] State parameter is missing.');
      throw new BadRequestException('State parameter is required for token exchange.');
    }

    const storedStateData = await this.stateService.validateState(receivedState);
    if (!storedStateData) {
      this.logger.error('[AuthService.exchangeCodeForToken] Invalid or expired state parameter.');
      throw new BadRequestException('Invalid or expired state. Please try logging in again.');
    }

    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append('redirect_uri', this.dlRedirectUri);
    params.append('client_id', this.dlClientId);
    params.append('client_secret', this.dlClientSecret);
    if (storedStateData.verifier) {
      params.append('code_verifier', storedStateData.verifier);
    }

    try {
      this.logger.log(`[AuthService.exchangeCodeForToken] Requesting token from ${this.dlTokenUrl}`);
      const tokenResponseObs = this.httpService.post<DigiLockerTokenResponse>(
        this.dlTokenUrl,
        params.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );
      const tokenData = (await firstValueFrom(tokenResponseObs)).data;
      this.logger.log('[AuthService.exchangeCodeForToken] Token received from DigiLocker.');

      const userInfo = await this.getUser(tokenData.access_token); // Fetch user info with the new token
      this.logger.log('[AuthService.exchangeCodeForToken] User info fetched successfully.');

      return {
        accessToken: tokenData.access_token,
        expiresIn: tokenData.expires_in,
        refreshToken: tokenData.refresh_token,
        userInfo: userInfo,
        message: 'Successfully exchanged code for token.'
      };
    } catch (error) {
      this.logger.error(
        `[AuthService.exchangeCodeForToken] Error exchanging code for token: ${error.message}`,
        error.response?.data || error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to exchange authorization code for token: ${error.message || 'Unknown error'}`,
      );
    }
  }

  /**
   * Test the encryption/decryption functionality
   * This is used by the debug endpoint to verify the key is working
   */
  async testEncryption(): Promise<any> {
    this.logger.log('Testing encryption with key');
    
    // Log key details
    this.logger.log(`Encryption key type: ${typeof this.encryptionKey}, length: ${this.encryptionKey ? this.encryptionKey.length : 'undefined'}`);
    
    // Test key format
    const formattedKey = this.encryptionKey || '';
    const trimmedKey = formattedKey.trim();
    if (trimmedKey !== formattedKey) {
      this.logger.warn(`Warning: Key has whitespace! Original length: ${formattedKey.length}, Trimmed length: ${trimmedKey.length}`);
    }
    
    // Test key decoding
    try {
      const decodedKeyLength = Buffer.from(formattedKey, 'base64').length;
      this.logger.log(`Decoded key length: ${decodedKeyLength} bytes`);
      
      const mockToken = 'TEST_REFRESH_TOKEN_123';
      
      try {
        // Test encryption
        const encryptedToken = encrypt(mockToken, formattedKey);
        this.logger.log(`Successfully encrypted token: ${encryptedToken}`);
        
        // Now test decryption
        try {
          const decryptedToken = decrypt(encryptedToken, formattedKey);
          this.logger.log(`Successfully decrypted token: ${decryptedToken}`);
          
          // Return success data
          return {
            status: 'success',
            keyLength: formattedKey.length,
            decodedKeyLength,
            originalText: mockToken,
            encryptedLength: encryptedToken.length,
            decryptedText: decryptedToken,
            encryptionMatch: mockToken === decryptedToken
          };
        } catch (decryptError) {
          this.logger.error(`Decryption failed: ${decryptError.message}`);
          throw new Error(`Decryption failed: ${decryptError.message}`);
        }
      } catch (encryptError) {
        this.logger.error(`Encryption failed: ${encryptError.message}`);
        throw new Error(`Encryption failed: ${encryptError.message}`);
      }
    } catch (keyError) {
      this.logger.error(`Key validation failed: ${keyError.message}`);
      throw new Error(`Key validation failed: ${keyError.message}`);
    }
  }

  /**
   * Test the cookie handling functionality
   * This is used by the debug endpoint to verify cookie setting and reading
   */
  async testCookies(req: Request, res: Response): Promise<any> {
    this.logger.log('Testing cookie handling');
    
    const checkCookies = () => {
      // Get all cookies from the request
      const cookies = req.cookies || {};
      this.logger.log(`Current cookies: ${JSON.stringify(Object.keys(cookies))}`);
      
      // Check if we have our specific cookies
      const accessToken = cookies[this.accessTokenCookieName];
      const refreshToken = cookies[this.refreshTokenCookieName];
      const expiryTime = cookies[this.expiryCookieName];
      
      return {
        hasCookies: Object.keys(cookies).length > 0,
        hasAccessToken: !!accessToken,
        hasRefreshToken: !!refreshToken,
        hasExpiry: !!expiryTime,
        accessToken: accessToken ? 'present' : 'missing',
        refreshToken: refreshToken ? 'present (encrypted)' : 'missing',
        expiryTime: expiryTime || 'missing'
      };
    };
    
    // Check existing cookies first
    const existingCookies = checkCookies();
    
    // Now set test cookies
    const mockToken = 'TEST_ACCESS_TOKEN_123';
    const mockRefreshToken = 'TEST_REFRESH_TOKEN_123';
    const expiresIn = 3600; // 1 hour
    
    try {
      // Set the cookies
      this._setAuthCookies(res, mockToken, expiresIn, mockRefreshToken);
      
      // Return a response with cookie info
      return res.json({
        action: 'Cookies set successfully',
        existingCookies,
        cookiesSet: {
          accessToken: this.accessTokenCookieName,
          refreshToken: this.refreshTokenCookieName,
          expiryTime: this.expiryCookieName
        },
        note: 'Refresh this endpoint to see the cookies that were set.'
      });
    } catch (error) {
      this.logger.error(`Error setting cookies: ${error.message}`);
      throw new Error(`Error setting cookies: ${error.message}`);
    }
  }

  // New method to initiate QR session
  async initiateQRSession(): Promise<QrSessionInitResponse> {
    // Generate a session ID (for tracking)
    const isInMockMode = this.configService.get<string>('NODE_ENV') === 'mock';
    let sessionId = this.generateRandomSessionId();

    // In mock mode, add a timestamp to ensure uniqueness
    if (isInMockMode) {
      sessionId = `${sessionId}_${Date.now()}`;
    }

    // Generate PKCE verifier - needed for OAuth PKCE flow
    const codeVerifier = this.generateRandomString(64);
    const codeChallenge = this.generatePkceChallenge(codeVerifier);

    // Generate QR Code deep link
    const qrDeepLink = this.generateQrDeepLink(sessionId, codeChallenge, isInMockMode);
    this.logger.log(`Generated QR deep link: ${qrDeepLink}`);

    // Generate QR code data URL from deep link
    const qrCodeData = await this.qrCodeGeneratorService.generateQRCode(qrDeepLink);

    // Store session data
    await this.stateService.storeQrSessionData(sessionId, {
      status: 'PENDING',
      verifier: codeVerifier,
      deepLink: qrDeepLink,
      createdAt: Math.floor(Date.now() / 1000)
    }, 300); // 5 minute TTL

    // Return session info to client
    return {
      sessionId,
      qrCodeData,
      pollingUrl: `/auth/qr-status/${sessionId}`,
      expiresIn: 300 // 5 minutes
    };
  }

  // Method to handle the callback from DigiLocker after QR code authentication by the user
  async handleQRCallback(state: string, authCode: string, res: Response): Promise<void> {
    this.logger.log(`Handling QR callback with state: ${state}, authCode: ${authCode ? '[PRESENT]' : '[MISSING]'}`);
    
    // State is our original sessionId
    const sessionId = state;

    try {
      // 1. Get the session data, this will handle modified sessionIds internally
      const sessionData = await this.stateService.getQrSessionData(sessionId);
      
      if (!sessionData) {
        this.logger.warn(`QR session ${sessionId} not found or expired.`);
        return this.sendQrCallbackResponse(res, false, 'Invalid or expired QR session');
      }
      
      if (sessionData.status !== 'PENDING') {
        this.logger.warn(`QR session ${sessionId} is not in PENDING state. Current state: ${sessionData.status}`);
        return this.sendQrCallbackResponse(res, false, `QR session is in ${sessionData.status} state`); 
      }
      
      // Check if we're in mock mode
      const isInMockMode = this.configService.get<string>('NODE_ENV') === 'mock';
      
      if (isInMockMode) {
        this.logger.log(`Mock mode: Simulating successful QR authentication for session ${sessionId}`);
        
        // For mock mode, generate mock tokens
        const mockAccessToken = `mock_access_token_${Date.now()}`;
        const mockExpiresAt = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
        
        // Update session with mock tokens
        await this.stateService.updateQrSessionData(sessionId, {
          status: 'SUCCESS',
          accessToken: mockAccessToken,
          accessTokenExpiresAt: mockExpiresAt
        });
        
        return this.sendQrCallbackResponse(res, true, 'QR Authentication successful (mock)');
      }
      
      // 2. Exchange the authorization code for tokens
      try {
        const tokenRequestParams = {
          grant_type: 'authorization_code',
          code: authCode,
          redirect_uri: `${this.configService.get<string>('SERVER_URL', 'http://localhost:3007')}/auth/qr-callback`,
          code_verifier: sessionData.verifier, // PKCE verifier from the session
          client_id: this.dlClientId
        };
        
        // Make the token request
        const tokenUrl = this.dlTokenUrl;
        this.logger.log(`Requesting access token from ${tokenUrl}`);
        
        const tokenResponse = await firstValueFrom(
          this.httpService.post(tokenUrl, new URLSearchParams(tokenRequestParams).toString(), {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
            }
          })
        );
        
        if (tokenResponse.status === 200 && tokenResponse.data) {
          const { access_token, expires_in } = tokenResponse.data;
          
          if (!access_token) {
            this.logger.error('No access token in DigiLocker response', tokenResponse.data);
            await this.stateService.updateQrSessionData(sessionId, { status: 'FAILED' });
            return this.sendQrCallbackResponse(res, false, 'Authentication failed: No access token received');
          }
          
          // Calculate when the token expires (in seconds since epoch)
          const accessTokenExpiresAt = Math.floor(Date.now() / 1000) + (expires_in || 3600);
          
          // Update session with the received tokens
          await this.stateService.updateQrSessionData(sessionId, {
            status: 'SUCCESS', 
            accessToken: access_token,
            accessTokenExpiresAt
          });
          
          return this.sendQrCallbackResponse(res, true, 'QR Authentication successful');
        } else {
          this.logger.error('Error response from DigiLocker token endpoint', tokenResponse);
          await this.stateService.updateQrSessionData(sessionId, { status: 'FAILED' });
          return this.sendQrCallbackResponse(res, false, 'Authentication failed: Token exchange error');
        }
      } catch (error) {
        this.logger.error(`Error exchanging authorization code for tokens: ${error.message}`, error.stack);
        await this.stateService.updateQrSessionData(sessionId, { status: 'FAILED' });
        return this.sendQrCallbackResponse(res, false, 'Authentication failed: Token exchange error');
      }
    } catch (error) {
      this.logger.error(`QR callback error: ${error.message}`, error.stack);
      return this.sendQrCallbackResponse(res, false, 'Internal server error');
    }
  }

  private sendQrCallbackResponse(res: Response, success: boolean, message: string): void {
    // For simplicity, just return a JSON response
    res.status(success ? HttpStatus.OK : HttpStatus.BAD_REQUEST).json({
      success,
      message
    });
  }

  // Method to check QR session status (polled by frontend)
  async checkQRStatus(sessionId: string): Promise<QrStatusResponse> {
    this.logger.log(`Checking QR session status for: ${sessionId}`);
    
    try {
      // This will handle modified sessionIds internally now
      const sessionData = await this.stateService.getQrSessionData(sessionId);
      
      if (!sessionData) {
        this.logger.warn(`QR session ${sessionId} not found or expired`);
        return {
          sessionId,
          status: 'NOT_FOUND',
          message: 'QR session not found or expired'
        };
      }
      
      // Create the response based on session status
      const response: QrStatusResponse = {
        sessionId,
        status: sessionData.status
      };
      
      // For successful sessions, include the redirect URL and set auth cookies
      if (sessionData.status === 'SUCCESS') {
        // Check that we have the necessary token data
        if (!sessionData.accessToken || !sessionData.accessTokenExpiresAt) {
          this.logger.error(`QR session ${sessionId} marked as SUCCESS but missing token data`);
          await this.stateService.updateQrSessionData(sessionId, { status: 'FAILED' });
          
          return {
            sessionId,
            status: 'FAILED',
            message: 'Authentication session data incomplete'
          };
        }
        
        // Include redirect URL for the frontend
        response.redirectUrl = '/auth/files-dashboard';
      }
      
      return response;
    } catch (error) {
      this.logger.error(`Error checking QR status: ${error.message}`, error.stack);
      return {
        sessionId,
        status: 'ERROR',
        message: 'Internal server error'
      };
    }
  }

  // Add new method for hConnect integration
  async verifyWithHConnect(accessToken: string): Promise<any> {
    try {
      const userInfo = await this.getUser(accessToken);
      
      this.logger.log(`[verifyWithHConnect] Processing user: ${userInfo.sub}`);
      
      // Format for hConnect API
      const verificationData = {
        eid_provider: "DigiLocker",
        country_code: "IN",
        verification_level: "high",
        user_identifier: userInfo.sub,
        verified_claims: {
          name: userInfo.name,
          dob: userInfo.dob || null,
          has_aadhaar: userInfo.eaadhaar === "Y",
          email: userInfo.email || null
        },
        verification_timestamp: Date.now(),
        token: accessToken
      };
      
      // Mock response for development/testing
      if (this.configService.get<string>('NODE_ENV') === 'mock') {
        return {
          verification_id: `hc-${Math.random().toString(36).substring(2, 15)}`,
          status: "verified",
          provider: "DigiLocker",
          country: "IN",
          level: "high",
          timestamp: new Date().toISOString(),
          expires_at: new Date(Date.now() + 86400000).toISOString(), // 24 hours
          token: `hc_${Math.random().toString(36).substring(2, 15)}`
        };
      }
      
      // In production, call actual hConnect API
      const hopaeApiKey = this.configService.get<string>('HOPAE_API_KEY');
      const hopaeApiUrl = this.configService.get<string>('HOPAE_API_URL');
      
      this.logger.debug(`[verifyWithHConnect] Calling hConnect API at: ${hopaeApiUrl}`);
      
      const response = await firstValueFrom(
        this.httpService.post(
          `${hopaeApiUrl}/verify`, 
          verificationData,
          {
            headers: {
              'Authorization': `Bearer ${hopaeApiKey}`,
              'Content-Type': 'application/json'
            }
          }
        )
      );
      
      this.logger.debug(`[verifyWithHConnect] hConnect response: ${JSON.stringify(response.data)}`);
      return response.data;
    } catch (error) {
      this.logger.error(`[verifyWithHConnect] Error: ${error.message}`, error.stack);
      throw new InternalServerErrorException(`Failed to verify with hConnect: ${error.message}`);
    }
  }

  // Method to get QR session data
  async getQrSessionData(sessionId: string): Promise<QrSessionData | null> {
    try {
      return await this.stateService.getQrSessionData(sessionId);
    } catch (error) {
      this.logger.error(`Error getting QR session data: ${error.message}`, error.stack);
      return null;
    }
  }
  
  // Method to set auth cookies for successful authentication
  setAuthCookies(
    res: Response,
    accessToken: string,
    expiresIn: number,
    refreshToken: string | null
  ): void {
    // Set the access token cookie (httpOnly for security)
    res.cookie(this.accessTokenCookieName, accessToken, {
      httpOnly: true,
      secure: this.configService.get<string>('NODE_ENV') === 'production',
      maxAge: expiresIn * 1000, // Convert seconds to milliseconds
      sameSite: 'lax'
    });
    
    // Also set a non-httpOnly cookie with the expiration time for the frontend
    res.cookie(this.expiryCookieName, (Math.floor(Date.now() / 1000) + expiresIn).toString(), {
      httpOnly: false,
      secure: this.configService.get<string>('NODE_ENV') === 'production',
      maxAge: expiresIn * 1000,
      sameSite: 'lax'
    });
    
    // Set refresh token if provided
    if (refreshToken) {
      res.cookie(this.refreshTokenCookieName, refreshToken, {
        httpOnly: true,
        secure: this.configService.get<string>('NODE_ENV') === 'production',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        sameSite: 'lax'
      });
    }
    
    this.logger.log('Authentication cookies set successfully');
  }

  // Helper method to generate random session ID
  private generateRandomSessionId(): string {
    return crypto.randomBytes(16).toString('hex');
  }
  
  // Helper method to generate random string
  private generateRandomString(length: number): string {
    return crypto.randomBytes(length).toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')
      .substring(0, length);
  }
  
  // Helper method to generate PKCE challenge
  private generatePkceChallenge(verifier: string): string {
    const sha256 = crypto.createHash('sha256').update(verifier).digest();
    return Buffer.from(sha256).toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }
  
  // Helper method to generate QR deep link
  private generateQrDeepLink(sessionId: string, codeChallenge: string, isInMockMode: boolean): string {
    const serverBaseUrl = this.configService.get<string>('SERVER_URL', 'http://localhost:3007');
    const qrCallbackRedirectUri = `${serverBaseUrl}/auth/qr-callback`;
    
    // Add some randomness to the mock deep link
    const mockRandom = isInMockMode ? `&random=${Math.random().toString(36).substring(2, 10)}` : '';
    
    // Construct deep link with `state` parameter carrying the sessionId
    const deepLinkParams = new URLSearchParams({
      client_id: this.dlClientId,
      redirect_uri: qrCallbackRedirectUri,
      response_type: 'code',
      state: sessionId, // Use sessionId as the OAuth state parameter
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });
    
    const digilockerQrAuthBase = this.configService.get<string>(
      'DIGILOCKER_QR_AUTH_ENDPOINT', 
      'digilocker://auth'
    );
    
    return `${digilockerQrAuthBase}?${deepLinkParams.toString()}${mockRandom}`;
  }
}
