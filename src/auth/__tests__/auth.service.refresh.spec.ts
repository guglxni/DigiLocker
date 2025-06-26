import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../auth.service';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { MockDataService } from '../../mock/mock-data.service';
import { RedisStateService } from '../redis-state.service';
import { Response } from 'express';
import { Logger } from '@nestjs/common';
import * as cryptoUtil from '../../common/crypto.util';

// Mock the decrypt function from crypto.util
jest.mock('../../common/crypto.util', () => ({
  decrypt: jest.fn(),
}));

describe('AuthService - refreshAccessTokenAndSetCookies', () => {
  let service: AuthService;
  let mockConfigService: Partial<ConfigService>;
  let mockHttpService: Partial<HttpService>;
  let mockMockDataService: Partial<MockDataService>;
  let mockRedisStateService: Partial<RedisStateService>;
  let mockResponse: Partial<Response>;
  let mockDecrypt: jest.Mock;
  
  const encryptionKey = 'valid-encryption-key';
  const validEncryptedRefreshToken = 'valid-encrypted-refresh-token';
  const validDecryptedRefreshToken = 'valid-decrypted-refresh-token';

  beforeEach(async () => {
    // Mock decrypt function
    mockDecrypt = cryptoUtil.decrypt as jest.Mock;
    mockDecrypt.mockImplementation((token, key) => {
      if (token === validEncryptedRefreshToken && key === encryptionKey) {
        return validDecryptedRefreshToken;
      }
      throw new Error('Decryption failed');
    });

    // Mock services
    mockConfigService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        const config = {
          'NODE_ENV': 'development',
          'CONFIG_ENC_KEY': encryptionKey,
          'DIGILOCKER_CLIENT_ID': 'client-id',
          'DIGILOCKER_CLIENT_SECRET': 'client-secret',
          'DIGILOCKER_REDIRECT_URI': 'http://redirect.com/callback',
          'DIGILOCKER_AUTH_URL': 'http://auth.com',
          'DIGILOCKER_TOKEN_URL': 'http://token.com',
          'DIGILOCKER_USERINFO_URL': 'http://userinfo.com',
          'DIGILOCKER_COOKIE_ACCESS_TOKEN_NAME': 'dl_token',
          'DIGILOCKER_COOKIE_REFRESH_TOKEN_NAME': 'dl_rtoken',
          'DIGILOCKER_COOKIE_EXPIRY_NAME': 'dl_expires_at',
          'DIGILOCKER_REFRESH_TOKEN_COOKIE_MAX_AGE_MS': 604800000, // 7 days
        };
        return config[key] !== undefined ? config[key] : defaultValue;
      }),
    };

    // Mock HttpService
    mockHttpService = {
      post: jest.fn(),
    };

    // Mock MockDataService
    mockMockDataService = {
      getMockTokenResponse: jest.fn().mockReturnValue({
        access_token: 'mock-access-token',
        expires_in: 3600,
        refresh_token: 'mock-refresh-token',
        token_type: 'Bearer',
      }),
    };

    // Mock RedisStateService
    mockRedisStateService = {};

    // Mock Response
    mockResponse = {
      cookie: jest.fn(),
      clearCookie: jest.fn(),
    };

    // Mock Logger methods
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});

    // Create testing module
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: HttpService, useValue: mockHttpService },
        { provide: MockDataService, useValue: mockMockDataService },
        { provide: RedisStateService, useValue: mockRedisStateService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return false if no refresh token is provided', async () => {
    const result = await service.refreshAccessTokenAndSetCookies('', mockResponse as Response);
    expect(result).toBe(false);
  });

  it('should return true in test environment and set cookies', async () => {
    // Set NODE_ENV to 'test'
    jest.spyOn(mockConfigService, 'get').mockImplementation((key: string, defaultValue?: any) => {
      if (key === 'NODE_ENV') return 'test';
      // Rest of the config remains the same
      const config = {
        'CONFIG_ENC_KEY': encryptionKey,
        'DIGILOCKER_CLIENT_ID': 'client-id',
        'DIGILOCKER_CLIENT_SECRET': 'client-secret',
        'DIGILOCKER_REDIRECT_URI': 'http://redirect.com/callback',
        'DIGILOCKER_AUTH_URL': 'http://auth.com',
        'DIGILOCKER_TOKEN_URL': 'http://token.com',
        'DIGILOCKER_USERINFO_URL': 'http://userinfo.com',
        'DIGILOCKER_COOKIE_ACCESS_TOKEN_NAME': 'dl_token',
        'DIGILOCKER_COOKIE_REFRESH_TOKEN_NAME': 'dl_rtoken',
        'DIGILOCKER_COOKIE_EXPIRY_NAME': 'dl_expires_at',
        'DIGILOCKER_REFRESH_TOKEN_COOKIE_MAX_AGE_MS': 604800000, // 7 days
      };
      return config[key] !== undefined ? config[key] : defaultValue;
    });

    // The token doesn't need to be decrypted in test mode
    const result = await service.refreshAccessTokenAndSetCookies(validEncryptedRefreshToken, mockResponse as Response);
    
    // Verify the result and mock calls
    expect(result).toBe(true);
    expect(mockResponse.cookie).toHaveBeenCalledTimes(2); // Two cookies set
    expect(mockDecrypt).not.toHaveBeenCalled(); // No decryption in test mode
    
    // Verify that the logger logged the test environment message
    expect(Logger.prototype.log).toHaveBeenCalledWith('Test environment: generating new test token response for E2E tests');
  });

  it('should return true in mock environment and set cookies', async () => {
    // Set NODE_ENV to 'mock'
    jest.spyOn(mockConfigService, 'get').mockImplementation((key: string, defaultValue?: any) => {
      if (key === 'NODE_ENV') return 'mock';
      // Rest of the config remains the same
      const config = {
        'CONFIG_ENC_KEY': encryptionKey,
        'DIGILOCKER_CLIENT_ID': 'client-id',
        'DIGILOCKER_CLIENT_SECRET': 'client-secret',
        'DIGILOCKER_REDIRECT_URI': 'http://redirect.com/callback',
        'DIGILOCKER_AUTH_URL': 'http://auth.com',
        'DIGILOCKER_TOKEN_URL': 'http://token.com',
        'DIGILOCKER_USERINFO_URL': 'http://userinfo.com',
        'DIGILOCKER_COOKIE_ACCESS_TOKEN_NAME': 'dl_token',
        'DIGILOCKER_COOKIE_REFRESH_TOKEN_NAME': 'dl_rtoken',
        'DIGILOCKER_COOKIE_EXPIRY_NAME': 'dl_expires_at',
        'DIGILOCKER_REFRESH_TOKEN_COOKIE_MAX_AGE_MS': 604800000, // 7 days
      };
      return config[key] !== undefined ? config[key] : defaultValue;
    });

    // The token doesn't need to be decrypted in mock mode
    const result = await service.refreshAccessTokenAndSetCookies(validEncryptedRefreshToken, mockResponse as Response);
    
    // Verify the result and mock calls
    expect(result).toBe(true);
    expect(mockResponse.cookie).toHaveBeenCalledTimes(2); // Two cookies set
    expect(mockDecrypt).not.toHaveBeenCalled(); // No decryption in mock mode
    expect(mockMockDataService.getMockTokenResponse).toHaveBeenCalled();
    
    // Verify that the logger logged the mock environment message
    expect(Logger.prototype.log).toHaveBeenCalledWith('Mock refresh token: generating new mock token response');
  });

  it('should return false when decryption fails', async () => {
    // Set NODE_ENV to 'development' (not test or mock)
    jest.spyOn(mockConfigService, 'get').mockImplementation((key: string, defaultValue?: any) => {
      if (key === 'NODE_ENV') return 'development';
      // Rest of the config remains the same
      const config = {
        'CONFIG_ENC_KEY': encryptionKey,
        'DIGILOCKER_CLIENT_ID': 'client-id',
        'DIGILOCKER_CLIENT_SECRET': 'client-secret',
        'DIGILOCKER_REDIRECT_URI': 'http://redirect.com/callback',
        'DIGILOCKER_AUTH_URL': 'http://auth.com',
        'DIGILOCKER_TOKEN_URL': 'http://token.com',
        'DIGILOCKER_USERINFO_URL': 'http://userinfo.com',
        'DIGILOCKER_COOKIE_ACCESS_TOKEN_NAME': 'dl_token',
        'DIGILOCKER_COOKIE_REFRESH_TOKEN_NAME': 'dl_rtoken',
        'DIGILOCKER_COOKIE_EXPIRY_NAME': 'dl_expires_at',
        'DIGILOCKER_REFRESH_TOKEN_COOKIE_MAX_AGE_MS': 604800000, // 7 days
      };
      return config[key] !== undefined ? config[key] : defaultValue;
    });

    // Make the decrypt function throw an error
    mockDecrypt.mockImplementationOnce(() => {
      throw new Error('Decryption failed');
    });

    const invalidToken = 'invalid-encrypted-token';
    const result = await service.refreshAccessTokenAndSetCookies(invalidToken, mockResponse as Response);
    
    // Verify the result and mock calls
    expect(result).toBe(false);
    expect(mockDecrypt).toHaveBeenCalledWith(invalidToken, encryptionKey);
    expect(mockResponse.clearCookie).toHaveBeenCalledTimes(3); // Cookies cleared due to error
    
    // Verify that the logger logged the error
    expect(Logger.prototype.error).toHaveBeenCalledWith('Failed to decrypt refresh token:', 'Decryption failed');
  });
}); 