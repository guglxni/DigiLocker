import { Test, TestingModule } from '@nestjs/testing';
import { MockDataService } from '../mock-data.service';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

describe('MockDataService', () => {
  let service: MockDataService;

  beforeEach(async () => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MockDataService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'DIGILOCKER_CLIENT_ID') return 'mock_client_id';
              if (key === 'DIGILOCKER_REDIRECT_URI') return 'http://localhost:3003/auth/callback';
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<MockDataService>(MockDataService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getMockTokenResponse', () => {
    it('should return an object containing access_token, refresh_token, and expires_in', () => {
      const tokenResponse = service.getMockTokenResponse();
      expect(tokenResponse).toBeDefined();
      expect(tokenResponse).toHaveProperty('access_token');
      expect(tokenResponse).toHaveProperty('refresh_token');
      expect(tokenResponse).toHaveProperty('expires_in');
      expect(typeof tokenResponse.access_token).toBe('string');
      expect(typeof tokenResponse.refresh_token).toBe('string');
      expect(typeof tokenResponse.expires_in).toBe('number');
    });
  });

  describe('getMockUserProfile', () => {
    it('should return an object containing sub and name', () => {
      const userProfile = service.getMockUserProfile();
      expect(userProfile).toBeDefined();
      expect(userProfile).toHaveProperty('sub');
      expect(userProfile).toHaveProperty('name');
      expect(typeof userProfile.sub).toBe('string');
      expect(typeof userProfile.name).toBe('string');
    });
  });
  
  describe('getMockIssuedDocuments', () => {
    it('should return an object with items array and user details', () => {
      const response = service.getMockIssuedDocuments();
      expect(response).toBeDefined();
      expect(response).toHaveProperty('items');
      expect(Array.isArray(response.items)).toBe(true);
      expect(response).toHaveProperty('name');
      expect(response).toHaveProperty('dob');
      expect(response).toHaveProperty('gender');
      if (response.items.length > 0) {
        const firstItem = response.items[0];
        expect(firstItem).toHaveProperty('name');
        expect(firstItem).toHaveProperty('type');
        // expect(firstItem).toHaveProperty('size'); // Size is string
        expect(firstItem).toHaveProperty('date');
        expect(firstItem).toHaveProperty('uri');
        // expect(firstItem).toHaveProperty('doctype'); // doctype is not in this structure, mime is
        expect(firstItem).toHaveProperty('mime');
      }
    });
  });

  describe('getMockFileBuffer', () => {
    it('should return a Buffer representing mock file content for a known URI', () => {
      const mockDocs = service.getMockIssuedDocuments();
      if (!mockDocs || mockDocs.items.length === 0) {
        console.warn('Skipping getMockFileBuffer test as no mock documents are available.');
        return;
      }
      const testFileUri = mockDocs.items[0].uri;
      const buffer = service.getMockFileBuffer(testFileUri);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);

      const contentString = buffer.toString();
      if (mockDocs.items[0].mime === 'application/pdf') {
        expect(contentString).toContain('%PDF');
      } else if (mockDocs.items[0].mime === 'application/xml') {
        expect(contentString).toContain('<?xml');
      }
    });

    it('should return a generic PDF buffer for an unknown URI', () => {
      const buffer = service.getMockFileBuffer('unknown-uri-does-not-exist');
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
      expect(buffer.toString()).toContain('%PDF'); // Default is PDF
    });
  });

}); 