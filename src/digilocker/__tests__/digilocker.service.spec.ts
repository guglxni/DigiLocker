import { Test, TestingModule } from '@nestjs/testing';
import { DigilockerService } from '../digilocker.service';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
// TokenService is not directly used by DigilockerService, so importing its mock might be unnecessary unless other tested methods rely on it.
// import { TokenService } from '../../auth/token.service'; 
import { MockDataService } from '../../mock/mock-data.service';
import { Logger, StreamableFile, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Readable } from 'stream';
import { AxiosError, AxiosResponse } from 'axios';
import { DigiLockerIssuedFilesResponse, DigiLockerIssuedFile } from '../interfaces/issued-files.interface';
import { DigiLockerUserProfile } from '../interfaces/user-profile.interface';
import { of } from 'rxjs';


// Mock dependencies
// jest.mock('@nestjs/config'); // We will provide a mock implementation directly
// jest.mock('@nestjs/axios'); // We will provide a mock implementation directly
// jest.mock('../../auth/token.service'); // Not used directly
// jest.mock('../../mock/mock-data.service'); // We will provide a mock implementation directly

describe('DigilockerService', () => {
  let service: DigilockerService;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockHttpService: jest.Mocked<HttpService>;
  // let mockTokenService: jest.Mocked<TokenService>; // Not used
  let mockMockDataService: jest.Mocked<MockDataService>;

  beforeEach(async () => {
    // Mock ConfigService instance
    const configServiceMockInstance = {
      get: jest.fn(),
    } as unknown as jest.Mocked<ConfigService>;

    // Mock MockDataService instance with actual method names
    const mockDataServiceMockInstance = {
      getMockIssuedDocuments: jest.fn(),
      getMockFileBuffer: jest.fn(),
      getMockUserProfile: jest.fn(),
      getMockTokenResponse: jest.fn(), // Though not directly used in DigilockerService, keep if other tests might rely on the full mock
    } as unknown as jest.Mocked<MockDataService>;
    
    const httpServiceMockInstance = {
        get: jest.fn(),
        post: jest.fn(),
    } as unknown as jest.Mocked<HttpService>

    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DigilockerService,
        { provide: ConfigService, useValue: configServiceMockInstance },
        { provide: HttpService, useValue: httpServiceMockInstance },
        // { provide: TokenService, useValue: { getAccessTokenFromRequest: jest.fn() } }, // Not used
        { provide: MockDataService, useValue: mockDataServiceMockInstance },
      ],
    }).compile();

    service = module.get<DigilockerService>(DigilockerService);
    mockConfigService = module.get(ConfigService);
    mockHttpService = module.get(HttpService);
    // mockTokenService = module.get(TokenService); // Not used
    mockMockDataService = module.get(MockDataService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // Removed the 'isMock' describe block as DigilockerService does not have an isMock method.
  // Tests will now directly set NODE_ENV via ConfigService mock.

  describe('getIssuedFiles', () => {
    const mockAccessToken = 'mock-token';
    it('should return mock documents from MockDataService when NODE_ENV is "mock"', async () => {
      mockConfigService.get.mockImplementation((key: string) => (key === 'NODE_ENV' ? 'mock' : undefined));
      const expectedResponse: DigiLockerIssuedFilesResponse = { 
        items: [{ name: 'Doc1', type: 'file', size: '10', date: 'date', mime: 'mime', uri: 'uri' }], 
        name: 'User', 
        dob: 'dob', 
        gender: 'G' 
      };
      mockMockDataService.getMockIssuedDocuments.mockReturnValue(expectedResponse as any); 

      const result = await service.getIssuedFiles(mockAccessToken);

      expect(mockMockDataService.getMockIssuedDocuments).toHaveBeenCalledTimes(1);
      expect(mockHttpService.get).not.toHaveBeenCalled();
      expect(result).toEqual(expectedResponse);
    });

    it('should call httpService when NODE_ENV is "development"', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'NODE_ENV') return 'development';
        if (key === 'DIGILOCKER_API_BASE_URL') return 'http://realapi.com';
        return undefined;
      });
      const expectedResponseData: DigiLockerIssuedFilesResponse = { 
        items: [{ name: 'RealDoc', type: 'file', size: '20', date: 'realdate', mime: 'realmime', uri: 'realuri' }], 
        name: 'RealUser', 
        dob: 'realdob', 
        gender: 'R' 
      };
      const mockAxiosResponse: AxiosResponse<DigiLockerIssuedFilesResponse> = {
        data: expectedResponseData,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any, // Use 'as any' for config if its full structure isn't critical for the test
      };
      mockHttpService.get.mockReturnValue(of(mockAxiosResponse));
      
      const result = await service.getIssuedFiles(mockAccessToken);

      expect(mockHttpService.get).toHaveBeenCalledTimes(1);
      expect(mockMockDataService.getMockIssuedDocuments).not.toHaveBeenCalled();
      expect(result).toEqual(expectedResponseData);
    });
  });

  describe('downloadFile', () => {
    const mockAccessToken = 'mock-token';
    const fileUri = 'dl:/mock/file.pdf';
    it('should return StreamableFile from MockDataService when NODE_ENV is "mock"', async () => {
      mockConfigService.get.mockImplementation((key: string) => (key === 'NODE_ENV' ? 'mock' : undefined));
      const mockBuffer = Buffer.from('mock-pdf-content');
      mockMockDataService.getMockFileBuffer.mockReturnValue(mockBuffer);

      const result = await service.downloadFile(fileUri, mockAccessToken);

      expect(mockMockDataService.getMockFileBuffer).toHaveBeenCalledWith(fileUri);
      expect(mockHttpService.get).not.toHaveBeenCalled();
      expect(result).toBeInstanceOf(StreamableFile);
      const stream = result.getStream();
      const content = await new Promise<string>((resolve, reject) => {
        let data = '';
        stream.on('data', chunk => data += chunk);
        stream.on('end', () => resolve(data));
        stream.on('error', err => reject(err));
      });
      expect(content).toBe('mock-pdf-content');
    });
    
    it('should call httpService and return StreamableFile when NODE_ENV is "development"', async () => {
        mockConfigService.get.mockImplementation((key: string) => {
            if (key === 'NODE_ENV') return 'development';
            if (key === 'DIGILOCKER_API_BASE_URL') return 'http://realapi.com';
            return undefined;
          });
        const mockStreamData = Buffer.from('real-file-content');
        const readableStream = new Readable();
        readableStream.push(mockStreamData);
        readableStream.push(null);
        
        const mockAxiosResponse: AxiosResponse<Readable> = {
            data: readableStream,
            status: 200,
            statusText: 'OK',
            headers: {},
            config: { responseType: 'stream'} as any, // Use 'as any' for config
          };
        mockHttpService.get.mockReturnValue(of(mockAxiosResponse));

        const result = await service.downloadFile(fileUri, mockAccessToken);
        expect(mockHttpService.get).toHaveBeenCalledTimes(1);
        expect(mockMockDataService.getMockFileBuffer).not.toHaveBeenCalled();
        expect(result).toBeInstanceOf(StreamableFile);

        const stream = result.getStream();
        const content = await new Promise<Buffer>((resolve, reject) => {
            const chunks: Buffer[] = [];
            stream.on('data', chunk => chunks.push(chunk));
            stream.on('end', () => resolve(Buffer.concat(chunks)));
            stream.on('error', err => reject(err));
        });
        expect(content.toString()).toBe('real-file-content');
    });
  });

  describe('getUserProfile', () => {
    const mockAccessToken = 'mock-token';
    it('should return mock user profile from MockDataService when NODE_ENV is "mock"', async () => {
      mockConfigService.get.mockImplementation((key: string) => (key === 'NODE_ENV' ? 'mock' : undefined));
      const expectedProfile: DigiLockerUserProfile = { sub: 'mocksub', name: 'Mock User', dob: '01/01/1990', gender: 'M' };
      mockMockDataService.getMockUserProfile.mockReturnValue(expectedProfile);

      const result = await service.getUserProfile(mockAccessToken);
      expect(mockMockDataService.getMockUserProfile).toHaveBeenCalledTimes(1);
      expect(mockHttpService.get).not.toHaveBeenCalled();
      expect(result).toEqual(expectedProfile);
    });

    it('should call httpService and return user profile when NODE_ENV is "development"', async () => {
        mockConfigService.get.mockImplementation((key: string) => {
            if (key === 'NODE_ENV') return 'development';
            if (key === 'DIGILOCKER_USERINFO_URL') return 'http://realuserinfo.com';
            return undefined;
          });
        const expectedProfileData: DigiLockerUserProfile = { sub: 'realsub', name: 'Real User', dob: '02/02/1992', gender: 'F' };
        const mockAxiosResponse: AxiosResponse<DigiLockerUserProfile> = {
            data: expectedProfileData,
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {} as any, // Use 'as any' for config
          };
        mockHttpService.get.mockReturnValue(of(mockAxiosResponse));

        const result = await service.getUserProfile(mockAccessToken);
        expect(mockHttpService.get).toHaveBeenCalledTimes(1);
        expect(mockMockDataService.getMockUserProfile).not.toHaveBeenCalled();
        expect(result).toEqual(expectedProfileData);
    });
  });
  
  describe('handleApiError', () => {
    const consoleErrorSpy = jest.spyOn(Logger.prototype, 'error');

    it('should throw NotFoundException for 404 error', () => {
        const error = {
            isAxiosError: true,
            message: 'Request failed with status code 404',
            response: { status: 404, data: { message: 'Not Found' } },
        } as AxiosError;
        // Accessing private method for testing purposes. This is generally discouraged.
        expect(() => (service as any).handleApiError(error, 'testing 404')).toThrow(NotFoundException);
        expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException for other response errors', () => {
        const error = {
            isAxiosError: true,
            message: 'Request failed with status code 500',
            response: { status: 500, data: { message: 'Server Error' } },
        } as AxiosError;
        expect(() => (service as any).handleApiError(error, 'testing 500')).toThrow(InternalServerErrorException);
        expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException for non-response errors', () => {
        const error = {
            isAxiosError: true,
            message: 'Network Error',
        } as AxiosError;
        expect(() => (service as any).handleApiError(error, 'testing network error')).toThrow(InternalServerErrorException);
        expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });
}); 