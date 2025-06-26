import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { RedisStateService } from '../redis-state.service';
import { Cache } from 'cache-manager';
import * as crypto from 'crypto';

// Assuming StoredState is exported from redis-state.service.ts or defined here
interface StoredState {
  verifier?: string;
}

describe('RedisStateService (Unit Tests)', () => {
  let service: RedisStateService;
  let cacheManagerMock: Partial<jest.Mocked<Cache>>;
  let randomBytesSpy: jest.SpyInstance;
  // This will be the exact 32-character hex string expected from createState
  const MOCK_STATE_HEX_STRING = '0123456789abcdef0123456789abcdef'; 

  beforeEach(async () => {
    cacheManagerMock = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisStateService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'NODE_ENV') return 'test';
              return null;
            }),
          },
        },
        {
          provide: CACHE_MANAGER,
          useValue: cacheManagerMock,
        },
      ],
    }).compile();

    service = module.get<RedisStateService>(RedisStateService);
  });

  afterEach(() => {
    if (randomBytesSpy) {
      randomBytesSpy.mockRestore();
    }
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a state (without verifier) and store it in cache', async () => {
    randomBytesSpy = jest.spyOn(crypto, 'randomBytes').mockImplementation((size) => {
      if (size === 16) return Buffer.from(MOCK_STATE_HEX_STRING, 'hex');
      // Fallback for other crypto.randomBytes calls (e.g. in generatePKCEVerifier)
      if (size === 32) return Buffer.from('a'.repeat(64), 'hex'); 
      return crypto.createHash('sha256').update(String(size)).digest().subarray(0, size); // Predictable fallback
    });
    cacheManagerMock.set!.mockResolvedValue(undefined);

    const createdState = await service.createState();
    expect(createdState).toBe(MOCK_STATE_HEX_STRING);
    expect(cacheManagerMock.set!).toHaveBeenCalledWith(
      MOCK_STATE_HEX_STRING,
      { verifier: undefined },
      600000, // Default TTL from service (this.ttlSeconds * 1000)
    );
  });

  it('should create a state (with verifier) and store it in cache', async () => {
    const verifier = 'test-verifier-value-123';
    randomBytesSpy = jest.spyOn(crypto, 'randomBytes').mockImplementation((size) => {
      if (size === 16) return Buffer.from(MOCK_STATE_HEX_STRING, 'hex');
      if (size === 32) return Buffer.from('a'.repeat(64), 'hex');
      return crypto.createHash('sha256').update(String(size)).digest().subarray(0, size);
    });
    cacheManagerMock.set!.mockResolvedValue(undefined);

    const createdState = await service.createState(verifier);
    expect(createdState).toBe(MOCK_STATE_HEX_STRING);
    expect(cacheManagerMock.set!).toHaveBeenCalledWith(
      MOCK_STATE_HEX_STRING,
      { verifier: verifier },
      600000, 
    );
  });

  it('should validate a correct state and return StoredState, then delete it', async () => {
    const state = 'test-state';
    const storedData: StoredState = { verifier: 'test-verifier' };
    cacheManagerMock.get!.mockResolvedValue(storedData);
    cacheManagerMock.del!.mockResolvedValue(true as any);

    const result = await service.validateState(state);
    expect(result).toEqual(storedData);
    expect(cacheManagerMock.get!).toHaveBeenCalledWith(state);
    expect(cacheManagerMock.del!).toHaveBeenCalledWith(state);
  });

  it('should return null if state not found in cache during validation', async () => {
    const state = 'non-existent-state';
    cacheManagerMock.get!.mockResolvedValue(null);

    const result = await service.validateState(state);
    expect(result).toBeNull();
    expect(cacheManagerMock.get!).toHaveBeenCalledWith(state);
    expect(cacheManagerMock.del!).not.toHaveBeenCalled();
  });

  it('should store state with TTL and retrieve it before expiry (mocked)', async () => {
    const verifier = 'test-verifier-ttl-value-456';
    randomBytesSpy = jest.spyOn(crypto, 'randomBytes').mockImplementation((size) => {
        if (size === 16) return Buffer.from(MOCK_STATE_HEX_STRING, 'hex');
        if (size === 32) return Buffer.from('a'.repeat(64), 'hex');
        return crypto.createHash('sha256').update(String(size)).digest().subarray(0, size);
    });
    cacheManagerMock.set!.mockResolvedValue(undefined);
    cacheManagerMock.get!.mockResolvedValue({ verifier: verifier }); 

    await service.createState(verifier);
    const result = await service.validateState(MOCK_STATE_HEX_STRING);

    expect(cacheManagerMock.set!).toHaveBeenCalledWith(
      MOCK_STATE_HEX_STRING,
      { verifier: verifier },
      600000, 
    );
    expect(cacheManagerMock.get!).toHaveBeenCalledWith(MOCK_STATE_HEX_STRING);
    expect(result).toEqual({ verifier: verifier });
  });

  it('generatePKCEVerifier should return a 64-char hex string', () => {
    const verifier = service.generatePKCEVerifier();
    expect(verifier).toMatch(/^[a-f0-9]{64}$/);
    expect(Buffer.from(verifier, 'hex').length).toBe(32);
  });

  it('generatePKCEChallenge should return a base64url string from verifier', () => {
    const verifier = 'testVerifierStringLongEnoughForSHA256Input';
    const challenge = service.generatePKCEChallenge(verifier);
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(challenge.length).toBeGreaterThanOrEqual(43);
  });
});
