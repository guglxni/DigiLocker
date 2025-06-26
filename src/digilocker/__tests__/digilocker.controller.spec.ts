import { Test, TestingModule } from '@nestjs/testing';
import { DigilockerController } from '../digilocker.controller';
import { DigilockerService } from '../digilocker.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
// import { AccessTokenGuard } from '../../auth/access-token.guard'; // Not used in this controller directly on methods
import { Logger, StreamableFile, UnauthorizedException } from '@nestjs/common';
import { Request, Response } from 'express';
import { Readable } from 'stream';

// Mock DigilockerService
jest.mock('../digilocker.service');

describe('DigilockerController', () => {
  let controller: DigilockerController;
  let mockDigilockerService: jest.Mocked<DigilockerService>;

  beforeEach(async () => {
    // DigilockerService constructor takes ConfigService, HttpService, MockDataService
    // Since we are fully mocking it, we can pass null or minimal mocks if constructor logic is simple.
    // Or, use jest.fn() for each method individually if not using the class constructor for the mock.
    mockDigilockerService = {
        getIssuedFiles: jest.fn(),
        downloadFile: jest.fn(),
        // Add other methods of DigilockerService here if they are called by the controller
        // For example, if there was a getUserProfile method:
        // getUserProfile: jest.fn(), 
      } as unknown as jest.Mocked<DigilockerService>; // Cast to the mocked type

    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DigilockerController],
      providers: [
        { provide: DigilockerService, useValue: mockDigilockerService },
        { provide: CACHE_MANAGER, useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn() } },
      ],
    })
    .overrideGuard(JwtAuthGuard).useValue({ canActivate: jest.fn((context) => {
        const req = context.switchToHttp().getRequest();
        // Simulate guard adding user to request for testing purposes
        req.user = { accessToken: 'mock-access-token-from-guard' }; 
        return true;
    }) })
    .compile();

    controller = module.get<DigilockerController>(DigilockerController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getIssuedFiles', () => {
    it('should return files if access token is present', async () => {
      const mockFilesResponse = {
        items: [
          {
            id: '1',
            name: 'File1.pdf',
            type: 'file',
            size: '1024',
            date: '2023-01-01',
            mime: 'application/pdf',
            uri: 'doc:/123/File1.pdf',
          },
        ],
        name: 'Test User',
        dob: '01-01-1990',
        gender: 'M',
      };
      mockDigilockerService.getIssuedFiles.mockResolvedValue(mockFilesResponse as any);
      const mockReq = { user: { accessToken: 'mock-access-token' } } as unknown as Request;

      const result = await controller.getIssuedFiles(mockReq);
      expect(mockDigilockerService.getIssuedFiles).toHaveBeenCalledWith(mockReq.user.accessToken);
      expect(result).toEqual(mockFilesResponse);
    });

    it('should throw UnauthorizedException if access token is missing', async () => {
      const mockReq = { user: {} } as unknown as Request; // No accessToken
      await expect(controller.getIssuedFiles(mockReq)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('downloadFile', () => {
    it('should return StreamableFile and set PDF Content-Type', async () => {
      const fileUri = 'dl:/mock/file123.pdf';
      const mockStream = new Readable();
      mockStream.push('pdf-data');
      mockStream.push(null);
      const mockStreamableFile = new StreamableFile(mockStream);
      mockDigilockerService.downloadFile.mockResolvedValue(mockStreamableFile);
      
      const mockReq = { user: { accessToken: 'mock-access-token' } } as unknown as Request;
      // Ensure `res` is properly typed for `setHeader`
      const mockRes = { setHeader: jest.fn() } as unknown as Response;

      const result = await controller.downloadFile(fileUri, mockReq, mockRes);
      
      expect(mockDigilockerService.downloadFile).toHaveBeenCalledWith(fileUri, mockReq.user.accessToken);
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
      expect(result).toBeInstanceOf(StreamableFile);
    });

    it('should set XML Content-Type', async () => {
        const fileUri = 'dl:/mock/file123.xml';
        const mockStream = new Readable();
        mockStream.push('<xml></xml>');
        mockStream.push(null);
        const mockStreamableFile = new StreamableFile(mockStream);
        mockDigilockerService.downloadFile.mockResolvedValue(mockStreamableFile);
        
        const mockReq = { user: { accessToken: 'mock-access-token' } } as unknown as Request;
        const mockRes = { setHeader: jest.fn() } as unknown as Response;
  
        await controller.downloadFile(fileUri, mockReq, mockRes);
        expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'application/xml');
      });

      it('should default to octet-stream Content-Type for unknown extensions', async () => {
        const fileUri = 'dl:/mock/file123.unknown';
        const mockStream = new Readable();
        mockStream.push('data');
        mockStream.push(null);
        const mockStreamableFile = new StreamableFile(mockStream);
        mockDigilockerService.downloadFile.mockResolvedValue(mockStreamableFile);
        
        const mockReq = { user: { accessToken: 'mock-access-token' } } as unknown as Request;
        const mockRes = { setHeader: jest.fn() } as unknown as Response;
  
        await controller.downloadFile(fileUri, mockReq, mockRes);
        expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'application/octet-stream');
      });

      it('should throw UnauthorizedException if access token is missing for downloadFile', async () => {
        const fileUri = 'dl:/mock/file123.pdf';
        const mockReq = { user: {} } as unknown as Request; // No accessToken
        const mockRes = { setHeader: jest.fn() } as unknown as Response;

        await expect(controller.downloadFile(fileUri, mockReq, mockRes)).rejects.toThrow(UnauthorizedException);
      });

      it('should throw Error if URI is missing for downloadFile', async () => {
        const mockReq = { user: { accessToken: 'mock-access-token' } } as unknown as Request;
        const mockRes = { setHeader: jest.fn() } as unknown as Response;
        // Pass undefined for uri
        await expect(controller.downloadFile(undefined as any, mockReq, mockRes)).rejects.toThrow('File URI is required as a query parameter.');
      });
  });
}); 