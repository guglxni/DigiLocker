import { JwtAuthGuard } from '../jwt-auth.guard';
import {
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { Request } from 'express';

// Mock the jsonwebtoken library
jest.mock('jsonwebtoken');

// Helper to create a mock ExecutionContext
const createMockExecutionContext = (
  request: Partial<Request>,
): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  }) as unknown as ExecutionContext;

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let mockConfigService: jest.Mocked<Partial<ConfigService>>;
  const mockJwtSecret = 'test-secret';
  const mockUserPayload = { userId: 1, username: 'testuser' };

  beforeEach(() => {
    mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'JWT_SECRET') return mockJwtSecret;
        if (key === 'isMock') return () => false; // Default to not mock mode
        return undefined;
      }),
    };
    guard = new JwtAuthGuard(mockConfigService as ConfigService);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {}); // Suppress error logs in tests
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {}); // Suppress warn logs
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Token Extraction and Validation', () => {
    it('should allow access with a valid Bearer token in header', async () => {
      const token = 'valid-bearer-token';
      const mockRequest = {
        headers: { authorization: `Bearer ${token}` },
        cookies: {},
      } as Partial<Request>;
      const mockContext = createMockExecutionContext(mockRequest);
      (jwt.verify as jest.Mock).mockReturnValue(mockUserPayload);

      const canActivate = await guard.canActivate(mockContext);

      expect(canActivate).toBe(true);
      expect(jwt.verify).toHaveBeenCalledWith(token, mockJwtSecret);
      expect(mockRequest['user']).toEqual(mockUserPayload);
    });

    it('should allow access with a valid token in dl_token cookie (fallback)', async () => {
      const token = 'valid-cookie-token';
      const mockRequest = {
        headers: {},
        cookies: { dl_token: token },
      } as Partial<Request>;
      const mockContext = createMockExecutionContext(mockRequest);
      (jwt.verify as jest.Mock).mockReturnValue(mockUserPayload);

      const canActivate = await guard.canActivate(mockContext);

      expect(canActivate).toBe(true);
      expect(jwt.verify).toHaveBeenCalledWith(token, mockJwtSecret);
      expect(mockRequest['user']).toEqual(mockUserPayload);
    });

    it('should prioritize Bearer token over cookie token', async () => {
      const bearerToken = 'priority-bearer-token';
      const cookieToken = 'secondary-cookie-token';
      const mockRequest = {
        headers: { authorization: `Bearer ${bearerToken}` },
        cookies: { dl_token: cookieToken },
      } as Partial<Request>;
      const mockContext = createMockExecutionContext(mockRequest);
      (jwt.verify as jest.Mock).mockReturnValue(mockUserPayload);

      await guard.canActivate(mockContext);
      expect(jwt.verify).toHaveBeenCalledWith(bearerToken, mockJwtSecret);
      expect(jwt.verify).not.toHaveBeenCalledWith(cookieToken, mockJwtSecret);
    });
  });

  describe('Error Handling', () => {
    it('should throw UnauthorizedException if no token is provided', async () => {
      const mockRequest = { headers: {}, cookies: {} } as Partial<Request>;
      const mockContext = createMockExecutionContext(mockRequest);

      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        new UnauthorizedException('Token not found'),
      );
    });

    it('should throw UnauthorizedException if JWT_SECRET is not configured', async () => {
      mockConfigService.get = jest.fn((key: string) => {
        if (key === 'isMock') return () => false; // isMock will be called first
        if (key === 'JWT_SECRET') return undefined; // JWT_SECRET is specifically undefined
        return 'some-other-value'; // Default for any other keys if they were to be called
      });
      guard = new JwtAuthGuard(mockConfigService as ConfigService);
      const mockRequest = {
        headers: { authorization: 'Bearer some-token' },
        cookies: {},
      } as Partial<Request>;
      const mockContext = createMockExecutionContext(mockRequest);

      await expect(guard.canActivate(mockContext)).rejects.toThrowError(
        'Authentication configuration error',
      );
    });

    it('should throw UnauthorizedException for an expired token', async () => {
      const token = 'expired-token';
      const mockRequest = {
        headers: { authorization: `Bearer ${token}` },
      } as Partial<Request>;
      const mockContext = createMockExecutionContext(mockRequest);
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new jwt.TokenExpiredError('jwt expired', new Date());
      });

      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        new UnauthorizedException('Token expired'),
      );
    });

    it('should throw UnauthorizedException for an invalid token (e.g., bad signature)', async () => {
      const token = 'invalid-signature-token';
      const mockRequest = {
        headers: { authorization: `Bearer ${token}` },
      } as Partial<Request>;
      const mockContext = createMockExecutionContext(mockRequest);
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new jwt.JsonWebTokenError('invalid signature');
      });

      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        new UnauthorizedException('Invalid token'),
      );
    });
  });

  describe('Mock Mode', () => {
    it('should allow access and set mock user if in mock mode and no token is present', async () => {
      mockConfigService.get = jest.fn((key: string) => {
        if (key === 'isMock') return () => true;
        if (key === 'JWT_SECRET') return 'mock-secret-for-this-test'; // Provide a JWT_SECRET for this test
        return undefined;
      });
      guard = new JwtAuthGuard(mockConfigService as ConfigService);

      const mockRequest = { headers: {}, cookies: {} } as Partial<Request>;
      const mockContext = createMockExecutionContext(mockRequest);

      const canActivate = await guard.canActivate(mockContext);
      expect(canActivate).toBe(true);
      expect(mockRequest['user']).toEqual({
        mock: true,
        reason: 'No token in mock mode',
      });
      expect(jwt.verify).not.toHaveBeenCalled();
    });

    it('should still validate token if present, even in mock mode', async () => {
      mockConfigService.get = jest.fn((key: string) => {
        if (key === 'isMock') return () => true;
        if (key === 'JWT_SECRET') return mockJwtSecret;
        return undefined;
      });
      guard = new JwtAuthGuard(mockConfigService as ConfigService); // Re-init with new mock

      const token = 'valid-token-in-mock-mode';
      const mockRequest = {
        headers: { authorization: `Bearer ${token}` },
        cookies: {},
      } as Partial<Request>;
      const mockContext = createMockExecutionContext(mockRequest);
      (jwt.verify as jest.Mock).mockReturnValue(mockUserPayload);

      const canActivate = await guard.canActivate(mockContext);
      expect(canActivate).toBe(true);
      expect(jwt.verify).toHaveBeenCalledWith(token, mockJwtSecret);
      expect(mockRequest['user']).toEqual(mockUserPayload);
    });
  });
});
