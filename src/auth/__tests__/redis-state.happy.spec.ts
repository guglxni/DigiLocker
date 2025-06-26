import { Test, TestingModule } from '@nestjs/testing';
import { RedisStateService } from '../redis-state.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Logger } from '@nestjs/common';

describe('RedisStateService - Happy Path', () => {
  let service: RedisStateService;
  let cacheManager: jest.Mocked<Cache>;

  beforeEach(async () => {
    // Create a mock Cache manager
    cacheManager = {
      set: jest.fn(),
      get: jest.fn(),
      del: jest.fn(),
    } as unknown as jest.Mocked<Cache>;

    // Mock Logger
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisStateService,
        {
          provide: CACHE_MANAGER,
          useValue: cacheManager,
        },
      ],
    }).compile();

    service = module.get<RedisStateService>(RedisStateService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createState and validateState', () => {
    it('should create a state and retrieve its data successfully', async () => {
      const testVerifier = 'test-verifier';
      
      // Mock cache.set to return a successful operation
      cacheManager.set.mockResolvedValue(undefined);
      
      // Create a state with the test verifier
      const stateId = await service.createState(testVerifier);
      
      // Verify that state was created with cache.set
      expect(stateId).toBeDefined();
      expect(typeof stateId).toBe('string');
      expect(stateId.length).toBeGreaterThan(0);
      
      // Now mock cache.get to return the state data
      cacheManager.get.mockResolvedValue({ verifier: testVerifier });
      
      // Validate and retrieve the state data
      const stateData = await service.validateState(stateId);
      
      // Verify the retrieved data
      expect(stateData).toBeDefined();
      expect(stateData).toEqual({ verifier: testVerifier });
      
      // Verify that cache.get was called with the correct state key
      expect(cacheManager.get).toHaveBeenCalledWith(stateId);
    });

    it('should create a state without verifier and retrieve it', async () => {
      // Mock cache.set to return a successful operation
      cacheManager.set.mockResolvedValue(undefined);
      
      // Create a state without a verifier
      const stateId = await service.createState();
      
      // Verify that state was created
      expect(stateId).toBeDefined();
      expect(typeof stateId).toBe('string');
      
      // Now mock cache.get to return the state data
      cacheManager.get.mockResolvedValue({});
      
      // Validate and retrieve the state data
      const stateData = await service.validateState(stateId);
      
      // Verify the retrieved data (no verifier)
      expect(stateData).toBeDefined();
      expect(stateData).toEqual({});
    });

    it('should return null after validating the state once', async () => {
      const testVerifier = 'test-verifier';
      
      // Mock cache.set and del to return successful operations
      cacheManager.set.mockResolvedValue(undefined);
      cacheManager.del.mockResolvedValue(true);
      
      // Create a state with the test verifier
      const stateId = await service.createState(testVerifier);
      
      // Mock cache.get to return the state data first time
      cacheManager.get.mockResolvedValueOnce({ verifier: testVerifier });
      
      // First validation should succeed
      const firstResult = await service.validateState(stateId);
      expect(firstResult).toEqual({ verifier: testVerifier });
      
      // Verify the state was deleted after validation
      expect(cacheManager.del).toHaveBeenCalledWith(stateId);
      
      // Mock cache.get to return null for the second attempt (state is already deleted)
      cacheManager.get.mockResolvedValueOnce(null);
      
      // Second validation should fail
      const secondResult = await service.validateState(stateId);
      expect(secondResult).toBeNull();
    });
  });

  describe('generatePKCEVerifier and generatePKCEChallenge', () => {
    it('should generate a valid PKCE verifier', () => {
      const verifier = service.generatePKCEVerifier();
      
      // Verify the verifier format
      expect(verifier).toBeDefined();
      expect(typeof verifier).toBe('string');
      expect(verifier.length).toBeGreaterThanOrEqual(43); // Min length per spec
      expect(verifier.length).toBeLessThanOrEqual(128); // Max length per spec
    });

    it('should generate a valid challenge from a verifier', () => {
      const verifier = 'test-pkce-verifier-value';
      const challenge = service.generatePKCEChallenge(verifier);
      
      // Verify the challenge format
      expect(challenge).toBeDefined();
      expect(typeof challenge).toBe('string');
      expect(challenge.length).toBeGreaterThan(0);
      
      // Verify that different verifiers produce different challenges
      const verifier2 = 'another-pkce-verifier';
      const challenge2 = service.generatePKCEChallenge(verifier2);
      expect(challenge).not.toEqual(challenge2);
    });
  });
}); 