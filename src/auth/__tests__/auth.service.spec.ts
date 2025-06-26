import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../auth.service';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { MockDataService } from '../../mock/mock-data.service';
import { RedisStateService } from '../redis-state.service';
import { Response, Request } from 'express';
import { Logger, BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as cryptoUtil from '../../common/crypto.util';

// Mock utilities and services
jest.mock('../../common/crypto.util', () => ({
  decrypt: jest.fn(),
  encrypt: jest.fn(),
}));
jest.mock('../redis-state.service');

describe('AuthService', () => {
  let service: AuthService;
  let mockConfigService: Partial<ConfigService>;
  let mockHttpService: Partial<HttpService>;
  let mockMockDataService: Partial<MockDataService>;
  let mockRedisStateService: RedisStateService;
  let mockResponse: Partial<Response>;
  let mockRequest: Partial<Request>;

  const encryptionKey = 'test-encryption-key';
  const mockAccessTokenName = 'dl_token';
  const mockRefreshTokenName = 'dl_rtoken';
  const mockExpiryCookieName = 'dl_expires_at';

  beforeEach(async () => {
    mockConfigService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        const config = {
          NODE_ENV: 'test', // Default to test environment
          CONFIG_ENC_KEY: encryptionKey,
          DIGILOCKER_COOKIE_ACCESS_TOKEN_NAME: mockAccessTokenName,
          DIGILOCKER_COOKIE_REFRESH_TOKEN_NAME: mockRefreshTokenName,
          DIGILOCKER_COOKIE_EXPIRY_NAME: mockExpiryCookieName,
          DIGILOCKER_REFRESH_TOKEN_COOKIE_MAX_AGE_MS: 604800000, // 7 days
          // Add other necessary config values
          DIGILOCKER_CLIENT_ID: 'mock_client_id',
          DIGILOCKER_CLIENT_SECRET: 'mock_client_secret',
          DIGILOCKER_REDIRECT_URI: 'http://localhost:3003/auth/callback',
          DIGILOCKER_AUTH_URL: 'http://mockauth.com',
          DIGILOCKER_TOKEN_URL: 'http://mocktoken.com',
          DIGILOCKER_USERINFO_URL: 'http://mockuserinfo.com',

        };
        return config[key] !== undefined ? config[key] : defaultValue;
      }),
    };

    mockHttpService = {
      post: jest.fn(),
      get: jest.fn(),
    };

    mockMockDataService = {
      getMockTokenResponse: jest.fn().mockReturnValue({
        access_token: 'mock-access-token',
        expires_in: 3600,
        refresh_token: 'mock-refresh-token',
      }),
      getMockUserProfile: jest.fn().mockReturnValue({
        sub: 'mock-user-id',
        name: 'Mock User',
      }),
      getMockIssuedDocuments: jest.fn(),
      getMockFileBuffer: jest.fn(),
    };
    
    // Create a proper mock for Cache to pass to RedisStateService constructor
    const mockCacheManager = {
        get: jest.fn(),
        set: jest.fn(),
        del: jest.fn(),
        store: {
            keys: jest.fn(), // if you use store.keys()
            ttl: jest.fn(), // if you use store.ttl()
            // mset, mget, mdel etc. if needed
        }
      } as unknown as jest.Mocked<import('cache-manager').Cache>; // Type assertion

    // Use the mocked RedisStateService
    mockRedisStateService = new RedisStateService(mockCacheManager) as jest.Mocked<RedisStateService>;
    // Setup mock implementations for RedisStateService methods
    (mockRedisStateService.validateState as jest.Mock) = jest.fn();
    (mockRedisStateService.createState as jest.Mock) = jest.fn();
    (mockRedisStateService.generatePKCEChallenge as jest.Mock) = jest.fn();
    (mockRedisStateService.generatePKCEVerifier as jest.Mock) = jest.fn();


    mockResponse = {
      cookie: jest.fn(),
      clearCookie: jest.fn(),
      redirect: jest.fn(),
      json: jest.fn().mockReturnThis(), // For chaining
      status: jest.fn().mockReturnThis(), // For chaining
    };

    mockRequest = {
      cookies: {},
    } as Partial<Request>;
    
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    (cryptoUtil.encrypt as jest.Mock).mockImplementation((text) => `encrypted-${text}`);


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

  describe('handleCallback', () => {
    it('should return 200 and set cookies when NODE_ENV is test and state is valid', async () => {
      const validState = 'valid-state';
      const testCode = 'test-code';
      (mockRedisStateService.validateState as jest.Mock).mockResolvedValueOnce({ verifier: 'test-verifier' });

      await service.handleCallback(testCode, validState, mockRequest as Request, mockResponse as Response);

      expect(mockRedisStateService.validateState).toHaveBeenCalledWith(validState);
      expect(mockResponse.cookie).toHaveBeenCalledTimes(3); // access_token, expiry, refresh_token
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Test login successful, cookies set.',
          token: expect.objectContaining({
            access_token: expect.stringContaining('test_access_token_'),
            expires_in: 900,
            refresh_token: expect.stringContaining('test_refresh_token_'),
          }),
        }),
      );
    });

    it('should throw BadRequestException for invalid/expired state', async () => {
      const invalidState = 'invalid-state';
      const testCode = 'test-code';
      (mockRedisStateService.validateState as jest.Mock).mockResolvedValueOnce(null);

      await expect(
        service.handleCallback(testCode, invalidState, mockRequest as Request, mockResponse as Response),
      ).rejects.toThrow(BadRequestException);
      expect(mockRedisStateService.validateState).toHaveBeenCalledWith(invalidState);
      expect(mockResponse.cookie).not.toHaveBeenCalled();
    });
  });

  describe('getUser', () => {
    it('should return test user profile in test environment', async () => {
      const mockAccessToken = 'test-access-token';
      // ConfigService mock already defaults to NODE_ENV: 'test'
      const userProfile = await service.getUser(mockAccessToken);

      expect(userProfile).toEqual({
        sub: 'test_user_id_123',
        name: 'Test E2E User',
        email: 'test@example.com',
        test_env: true,
      });
    });

    it('should throw UnauthorizedException if no access token is provided', async () => {
       await expect(service.getUser('')).rejects.toThrow(UnauthorizedException);
    });
  });
}); 