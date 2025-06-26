import { Test, TestingModule } from '@nestjs/testing';
import { TokenService } from '../token.service';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import * as cryptoUtil from '../../common/crypto.util';

// Mock the decrypt function from crypto.util
jest.mock('../../common/crypto.util', () => ({
  decrypt: jest.fn(),
}));

describe('TokenService', () => {
  let service: TokenService;
  let mockConfigService: Partial<ConfigService>;
  let mockDecrypt: jest.Mock;

  const validEncryptionKey = 'valid-encryption-key';
  const validAccessToken = 'valid-access-token';
  const validEncryptedRefreshToken = 'encrypted-refresh-token';
  const validRefreshToken = 'decrypted-refresh-token';
  
  // Use the real class instance names for cookies
  const accessTokenCookieName = 'dl_token';
  const refreshTokenCookieName = 'dl_rtoken';
  const expiryCookieName = 'dl_expires_at';

  beforeEach(async () => {
    mockDecrypt = cryptoUtil.decrypt as jest.Mock;
    mockDecrypt.mockImplementation((token, key) => {
      if (key !== validEncryptionKey) {
        throw new Error('Invalid encryption key');
      }
      if (token !== validEncryptedRefreshToken) {
        throw new Error('Invalid token format');
      }
      return validRefreshToken;
    });

    mockConfigService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        const config = {
          'DIGILOCKER_COOKIE_ACCESS_TOKEN_NAME': accessTokenCookieName,
          'DIGILOCKER_COOKIE_REFRESH_TOKEN_NAME': refreshTokenCookieName,
          'DIGILOCKER_COOKIE_EXPIRY_NAME': expiryCookieName,
          'CONFIG_ENC_KEY': validEncryptionKey,
        };
        return config[key] || defaultValue;
      }),
    };

    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<TokenService>(TokenService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with config values', () => {
      expect(service).toBeDefined();
      expect(mockConfigService.get).toHaveBeenCalledWith(
        'DIGILOCKER_COOKIE_ACCESS_TOKEN_NAME',
        'dl_token',
      );
      expect(mockConfigService.get).toHaveBeenCalledWith(
        'DIGILOCKER_COOKIE_REFRESH_TOKEN_NAME',
        'dl_rtoken',
      );
      expect(mockConfigService.get).toHaveBeenCalledWith(
        'DIGILOCKER_COOKIE_EXPIRY_NAME',
        'dl_expires_at',
      );
      expect(mockConfigService.get).toHaveBeenCalledWith('CONFIG_ENC_KEY');
    });

    it('should log error when encryption key is missing', async () => {
      // Set up mock to return undefined for encryption key
      mockConfigService.get = jest.fn((key: string, defaultValue?: any) => {
        if (key === 'CONFIG_ENC_KEY') return undefined;
        return defaultValue;
      });

      const loggerErrorSpy = jest.spyOn(Logger.prototype, 'error');
      
      // Re-initialize service with missing key
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          TokenService,
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();
      
      module.get<TokenService>(TokenService); // This triggers the constructor
      
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'CONFIG_ENC_KEY is not defined! Refresh token decryption will fail.',
      );
    });
  });

  describe('getAccessTokenFromRequest', () => {
    it('should return access token from cookies', () => {
      const mockRequest = {
        cookies: {
          [accessTokenCookieName]: validAccessToken,
        },
      } as any;

      const result = service.getAccessTokenFromRequest(mockRequest);
      expect(result).toEqual(validAccessToken);
    });

    it('should return undefined when cookie is not present', () => {
      const mockRequest = { cookies: {} } as any;
      const result = service.getAccessTokenFromRequest(mockRequest);
      expect(result).toBeUndefined();
    });
  });

  describe('getRefreshTokenFromRequest', () => {
    it('should decrypt and return refresh token when valid', () => {
      const mockRequest = {
        cookies: {
          [refreshTokenCookieName]: validEncryptedRefreshToken,
        },
      } as any;

      const result = service.getRefreshTokenFromRequest(mockRequest);
      expect(mockDecrypt).toHaveBeenCalledWith(validEncryptedRefreshToken, validEncryptionKey);
      expect(result).toEqual(validRefreshToken);
    });

    it('should return undefined when refresh token cookie is not present', () => {
      const mockRequest = { cookies: {} } as any;
      const result = service.getRefreshTokenFromRequest(mockRequest);
      expect(result).toBeUndefined();
      expect(mockDecrypt).not.toHaveBeenCalled();
    });

    it('should return undefined when encryption key is missing', async () => {
      // Re-create service with missing encryption key
      mockConfigService.get = jest.fn((key: string, defaultValue?: any) => {
        if (key === 'CONFIG_ENC_KEY') return undefined;
        const config = {
          'DIGILOCKER_COOKIE_ACCESS_TOKEN_NAME': accessTokenCookieName,
          'DIGILOCKER_COOKIE_REFRESH_TOKEN_NAME': refreshTokenCookieName,
          'DIGILOCKER_COOKIE_EXPIRY_NAME': expiryCookieName,
        };
        return config[key] || defaultValue;
      });

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          TokenService,
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      const serviceWithoutKey = module.get<TokenService>(TokenService);
      
      const mockRequest = {
        cookies: {
          [refreshTokenCookieName]: validEncryptedRefreshToken,
        },
      } as any;

      const loggerErrorSpy = jest.spyOn(Logger.prototype, 'error');
      const result = serviceWithoutKey.getRefreshTokenFromRequest(mockRequest);
      
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'Cannot decrypt refresh token: Encryption key is not configured.',
      );
      expect(result).toBeUndefined();
      expect(mockDecrypt).not.toHaveBeenCalled();
    });

    it('should return undefined when decryption fails', () => {
      mockDecrypt.mockImplementationOnce(() => {
        throw new Error('Decryption failed');
      });

      const mockRequest = {
        cookies: {
          [refreshTokenCookieName]: 'invalid-encrypted-token',
        },
      } as any;

      const loggerWarnSpy = jest.spyOn(Logger.prototype, 'warn');
      const result = service.getRefreshTokenFromRequest(mockRequest);
      
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        'Failed to decrypt refresh token: Decryption failed. Returning undefined.',
      );
      expect(result).toBeUndefined();
    });
  });

  describe('getExpiryTimestampFromRequest', () => {
    it('should return parsed timestamp from cookie', () => {
      const timestamp = Date.now() + 3600000; // 1 hour in the future
      const mockRequest = {
        cookies: {
          [expiryCookieName]: timestamp.toString(),
        },
      } as any;

      const result = service.getExpiryTimestampFromRequest(mockRequest);
      expect(result).toEqual(timestamp);
    });

    it('should return undefined when expiry cookie is not present', () => {
      const mockRequest = { cookies: {} } as any;
      const result = service.getExpiryTimestampFromRequest(mockRequest);
      expect(result).toBeUndefined();
    });

    it('should return undefined when expiry value is not a valid number', () => {
      const mockRequest = {
        cookies: {
          [expiryCookieName]: 'not-a-number',
        },
      } as any;

      const result = service.getExpiryTimestampFromRequest(mockRequest);
      expect(result).toBeUndefined();
    });
  });

  describe('isExpired', () => {
    it('should return true when expiry timestamp is in the past', () => {
      const pastTimestamp = Date.now() - 3600000; // 1 hour in the past
      const mockRequest = {
        cookies: {
          [expiryCookieName]: pastTimestamp.toString(),
        },
      } as any;

      const result = service.isExpired(mockRequest);
      expect(result).toBe(true);
    });

    it('should return false when expiry timestamp is in the future', () => {
      const futureTimestamp = Date.now() + 3600000; // 1 hour in the future
      const mockRequest = {
        cookies: {
          [expiryCookieName]: futureTimestamp.toString(),
        },
      } as any;

      const result = service.isExpired(mockRequest);
      expect(result).toBe(false);
    });

    it('should return true when expiry timestamp is undefined', () => {
      const mockRequest = { cookies: {} } as any;
      const result = service.isExpired(mockRequest);
      expect(result).toBe(true);
    });
  });

  describe('secondsLeft', () => {
    it('should return remaining seconds when expiry timestamp is in the future', () => {
      // Mock Date.now to return a fixed value for consistent testing
      const now = 1620000000000; // Some fixed timestamp
      const futureTimestamp = now + 3600000; // 1 hour (3600 seconds) in the future
      jest.spyOn(Date, 'now').mockReturnValue(now);
      
      const mockRequest = {
        cookies: {
          [expiryCookieName]: futureTimestamp.toString(),
        },
      } as any;

      const result = service.secondsLeft(mockRequest);
      expect(result).toBe(3600); // 3600 seconds = 1 hour
    });

    it('should return 0 when expiry timestamp is in the past', () => {
      const pastTimestamp = Date.now() - 3600000; // 1 hour in the past
      const mockRequest = {
        cookies: {
          [expiryCookieName]: pastTimestamp.toString(),
        },
      } as any;

      const result = service.secondsLeft(mockRequest);
      expect(result).toBe(0);
    });

    it('should return 0 when expiry timestamp is undefined', () => {
      const mockRequest = { cookies: {} } as any;
      const result = service.secondsLeft(mockRequest);
      expect(result).toBe(0);
    });
  });
}); 