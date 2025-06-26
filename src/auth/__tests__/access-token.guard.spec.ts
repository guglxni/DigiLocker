import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AccessTokenGuard } from '../access-token.guard';
import { TokenService } from '../token.service';
import { AuthService } from '../auth.service';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { Request, Response } from 'express';

describe('AccessTokenGuard', () => {
  let guard: AccessTokenGuard;
  let mockTokenService: jest.Mocked<Partial<TokenService>>;
  let mockAuthService: jest.Mocked<Partial<AuthService>>;
  let mockConfigService: jest.Mocked<Partial<ConfigService>>;

  beforeEach(() => {
    mockTokenService = {
      getAccessTokenFromRequest: jest.fn(),
      isExpired: jest.fn(),
      getRefreshTokenFromRequest: jest.fn(),
    };

    mockAuthService = {
      refreshAccessTokenAndSetCookies: jest.fn(),
    };

    mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'NODE_ENV') return 'development';
        if (key === 'DIGILOCKER_CLIENT_ID') return 'mock-client-id';
        if (key === 'JWT_SECRET') return 'test-secret';
        return undefined;
      }),
    } as jest.Mocked<Partial<ConfigService>>;

    guard = new AccessTokenGuard(
      mockTokenService as any as TokenService,
      mockAuthService as any as AuthService,
      mockConfigService as any as ConfigService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should allow access if token is valid', async () => {
    const originalGet = mockConfigService.get;
    mockConfigService.get = jest.fn((key: string) => {
      if (key === 'NODE_ENV') return 'production';
      if (key === 'DIGILOCKER_CLIENT_ID') return 'mock-client-id';
      if (key === 'JWT_SECRET') return 'test-secret';
      return undefined;
    });
    guard = new AccessTokenGuard(
      mockTokenService as any as TokenService,
      mockAuthService as any as AuthService,
      mockConfigService as any as ConfigService,
    );

    (mockTokenService.getAccessTokenFromRequest as jest.Mock).mockReturnValue(
      'valid-token',
    );
    (mockTokenService.isExpired as jest.Mock).mockReturnValue(false);
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () =>
          ({ cookies: { dl_token: 'valid-token' } }) as unknown as Request,
        getResponse: () => ({}) as Response,
      }),
    } as unknown as ExecutionContext;

    const canActivate = await guard.canActivate(mockContext);
    expect(canActivate).toBe(true);
    expect(mockTokenService.getAccessTokenFromRequest).toHaveBeenCalled();
    expect(mockTokenService.isExpired).toHaveBeenCalledWith(
      expect.objectContaining({ cookies: { dl_token: 'valid-token' } }),
    );

    mockConfigService.get = originalGet;
  });

  it('should throw UnauthorizedException if no token is found', async () => {
    (mockTokenService.getAccessTokenFromRequest as jest.Mock).mockReturnValue(
      null,
    );
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({ cookies: {} }) as unknown as Request,
        getResponse: () => ({}) as Response,
      }),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(mockContext)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should throw UnauthorizedException if token is expired', async () => {
    (mockTokenService.getAccessTokenFromRequest as jest.Mock).mockReturnValue(
      'expired-token',
    );
    (mockTokenService.isExpired as jest.Mock).mockResolvedValue(true);
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () =>
          ({ cookies: { dl_token: 'expired-token' } }) as unknown as Request,
        getResponse: () => ({}) as Response,
      }),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(mockContext)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should allow access in mock mode even if token is invalid (as per original guard logic)', async () => {
    (mockTokenService.getAccessTokenFromRequest as jest.Mock).mockReturnValue(
      null,
    );
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({ cookies: {} }) as unknown as Request,
        getResponse: () => ({}) as Response,
      }),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(mockContext)).rejects.toThrow(
      'Mock Mode: No access token found.',
    );
  });

  describe('Mock Mode Behavior', () => {
    beforeEach(() => {
      mockConfigService.get = jest.fn((key: string) => {
        if (key === 'NODE_ENV') return 'development';
        if (key === 'DIGILOCKER_CLIENT_ID') return 'mock-client-id';
        if (key === 'JWT_SECRET') return 'test-secret-for-mock';
        return undefined;
      });
      guard = new AccessTokenGuard(
        mockTokenService as any as TokenService,
        mockAuthService as any as AuthService,
        mockConfigService as any as ConfigService,
      );
    });

    it('should verify token using JWT in mock mode and attach user if token exists', async () => {
      const mockToken = 'mock-access-token';
      const mockDecodedPayload = { userId: 'mockUser', mock: true };
      (mockTokenService.getAccessTokenFromRequest as jest.Mock).mockReturnValue(
        mockToken,
      );
      jest.spyOn(jwt, 'verify').mockReturnValue(mockDecodedPayload as any);

      const mockRequest = {
        cookies: { dl_token: mockToken },
      } as unknown as Request;
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
          getResponse: () => ({}) as Response,
        }),
      } as unknown as ExecutionContext;

      expect(await guard.canActivate(mockContext)).toBe(true);
      expect(jwt.verify).toHaveBeenCalledWith(
        mockToken,
        'test-secret-for-mock',
      );
      expect(mockRequest['user']).toEqual(mockDecodedPayload);
    });

    it('should throw if no token in mock mode', async () => {
      (mockTokenService.getAccessTokenFromRequest as jest.Mock).mockReturnValue(
        undefined,
      );
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({}) as unknown as Request,
          getResponse: () => ({}) as Response,
        }),
      } as unknown as ExecutionContext;
      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        new UnauthorizedException('Mock Mode: No access token found.'),
      );
    });

    it('should throw if token is invalid in mock mode (jwt.verify throws)', async () => {
      const mockToken = 'invalid-mock-token';
      (mockTokenService.getAccessTokenFromRequest as jest.Mock).mockReturnValue(
        mockToken,
      );
      jest.spyOn(jwt, 'verify').mockImplementation(() => {
        throw new jwt.JsonWebTokenError('jwt verify error');
      });

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () =>
            ({ cookies: { dl_token: mockToken } }) as unknown as Request,
          getResponse: () => ({}) as Response,
        }),
      } as unknown as ExecutionContext;

      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        new UnauthorizedException('Mock Mode: Invalid or expired token.'),
      );
    });
  });

  describe('Non-Mock Mode Behavior', () => {
    beforeEach(() => {
      mockConfigService.get = jest.fn((key: string) => {
        if (key === 'NODE_ENV') return 'production';
        if (key === 'DIGILOCKER_CLIENT_ID') return 'real-client-id';
        if (key === 'JWT_SECRET') return 'test-secret-real';
        return undefined;
      });
      guard = new AccessTokenGuard(
        mockTokenService as any as TokenService,
        mockAuthService as any as AuthService,
        mockConfigService as any as ConfigService,
      );
    });

    it('should allow access if token is present and not expired', async () => {
      (mockTokenService.getAccessTokenFromRequest as jest.Mock).mockReturnValue(
        'valid-real-token',
      );
      (mockTokenService.isExpired as jest.Mock).mockReturnValue(false);
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({}) as unknown as Request,
          getResponse: () => ({}) as Response,
        }),
      } as unknown as ExecutionContext;
      expect(await guard.canActivate(mockContext)).toBe(true);
    });

    it('should throw if no token and not in mock mode', async () => {
      (mockTokenService.getAccessTokenFromRequest as jest.Mock).mockReturnValue(
        undefined,
      );
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({}) as unknown as Request,
          getResponse: () => ({}) as Response,
        }),
      } as unknown as ExecutionContext;
      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        new UnauthorizedException('Access token not found.'),
      );
    });

    it('should attempt token refresh if token is expired and refresh token exists', async () => {
      (mockTokenService.getAccessTokenFromRequest as jest.Mock).mockReturnValue(
        'expired-real-token',
      );
      (mockTokenService.isExpired as jest.Mock).mockReturnValue(true);
      (
        mockTokenService.getRefreshTokenFromRequest as jest.Mock
      ).mockReturnValue('valid-refresh-token');
      (
        mockAuthService.refreshAccessTokenAndSetCookies as jest.Mock
      ).mockResolvedValue(true);

      const mockResponse = {} as Response;
      const mockRequest = {} as unknown as Request;

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
          getResponse: () => mockResponse,
        }),
      } as unknown as ExecutionContext;
      expect(await guard.canActivate(mockContext)).toBe(true);
      expect(
        mockAuthService.refreshAccessTokenAndSetCookies,
      ).toHaveBeenCalledWith('valid-refresh-token', mockResponse);
    });

    it('should throw if token is expired, refresh token exists, but refresh fails', async () => {
      (mockTokenService.getAccessTokenFromRequest as jest.Mock).mockReturnValue(
        'expired-real-token',
      );
      (mockTokenService.isExpired as jest.Mock).mockReturnValue(true);
      (
        mockTokenService.getRefreshTokenFromRequest as jest.Mock
      ).mockReturnValue('valid-refresh-token');
      (
        mockAuthService.refreshAccessTokenAndSetCookies as jest.Mock
      ).mockResolvedValue(false);
      const mockResponse = {} as Response;
      const mockRequest = {} as unknown as Request;
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
          getResponse: () => mockResponse,
        }),
      } as unknown as ExecutionContext;
      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        new UnauthorizedException('Failed to refresh access token.'),
      );
    });

    it('should throw if token is expired and no refresh token exists', async () => {
      (mockTokenService.getAccessTokenFromRequest as jest.Mock).mockReturnValue(
        'expired-real-token',
      );
      (mockTokenService.isExpired as jest.Mock).mockReturnValue(true);
      (
        mockTokenService.getRefreshTokenFromRequest as jest.Mock
      ).mockReturnValue(undefined);
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({}) as unknown as Request,
          getResponse: () => ({}) as Response,
        }),
      } as unknown as ExecutionContext;
      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        new UnauthorizedException(
          'Access token expired and no refresh token found.',
        ),
      );
    });
  });
});
