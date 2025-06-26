import {
  Injectable,
  Logger,
  InternalServerErrorException,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosError, AxiosResponse } from 'axios';
import { MockDataService } from '../mock/mock-data.service';
import { DigiLockerUserProfile } from './interfaces/user-profile.interface';
import { DigiLockerIssuedFilesResponse } from './interfaces/issued-files.interface';
import { Readable } from 'stream';

@Injectable()
export class DigilockerService {
  private readonly logger = new Logger(DigilockerService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly mockDataService: MockDataService,
  ) {}

  private getApiHeaders(
    accessToken: string,
    accept: string = 'application/json',
  ) {
    return {
      Authorization: `Bearer ${accessToken}`,
      Accept: accept,
    };
  }

  async getUserProfile(accessToken: string): Promise<DigiLockerUserProfile> {
    if (this.configService.get<string>('NODE_ENV') === 'mock') {
      this.logger.log('Mock getUserProfile: returning mock user profile');
      return this.mockDataService.getMockUserProfile();
    }

    const userInfoUrl = this.configService.get<string>(
      'DIGILOCKER_USERINFO_URL',
    ) as string;
    this.logger.log(`Fetching user profile from: ${userInfoUrl}`);

    try {
      const response: AxiosResponse<DigiLockerUserProfile> =
        await firstValueFrom(
          this.httpService.get(userInfoUrl, {
            headers: this.getApiHeaders(accessToken),
          }),
        );
      this.logger.log('User profile received successfully');
      return response.data;
    } catch (error) {
      this.handleApiError(error, 'fetching user profile');
    }
  }

  async getIssuedFiles(
    accessToken: string,
  ): Promise<DigiLockerIssuedFilesResponse> {
    if (this.configService.get<string>('NODE_ENV') === 'mock') {
      this.logger.log('Mock getIssuedFiles: returning mock issued files data');
      return this.mockDataService.getMockIssuedDocuments() as unknown as DigiLockerIssuedFilesResponse;
    }

    const apiBaseUrl = this.configService.get<string>(
      'DIGILOCKER_API_BASE_URL',
    ) as string;
    const issuedFilesUrl = `${apiBaseUrl}/files/issued`;
    this.logger.log(`Fetching issued files from: ${issuedFilesUrl}`);

    try {
      const response: AxiosResponse<DigiLockerIssuedFilesResponse> =
        await firstValueFrom(
          this.httpService.get(issuedFilesUrl, {
            headers: this.getApiHeaders(accessToken),
          }),
        );
      this.logger.log('Issued files received successfully');
      return response.data;
    } catch (error) {
      this.handleApiError(error, 'fetching issued files');
    }
  }

  async downloadFile(
    fileUri: string,
    accessToken: string,
  ): Promise<StreamableFile> {
    if (this.configService.get<string>('NODE_ENV') === 'mock') {
      this.logger.log(`Mock downloadFile for URI: ${fileUri}`);
      const mockPdfBuffer = this.mockDataService.getMockFileBuffer(fileUri);
      const stream = new Readable();
      stream.push(mockPdfBuffer);
      stream.push(null);
      return new StreamableFile(stream);
    }

    const apiBaseUrl = this.configService.get<string>(
      'DIGILOCKER_API_BASE_URL',
    ) as string;
    const encodedUri = encodeURIComponent(
      fileUri.startsWith('dl:/') ? fileUri.substring(4) : fileUri,
    );
    const downloadUrl = `${apiBaseUrl}/files/file/${encodedUri}`;

    this.logger.log(
      `Downloading file from: ${downloadUrl} for URI: ${fileUri}`,
    );

    try {
      const response: AxiosResponse<Readable> = await firstValueFrom(
        this.httpService.get(downloadUrl, {
          headers: this.getApiHeaders(accessToken, 'application/pdf'),
          responseType: 'stream',
        }),
      );
      this.logger.log('File stream received successfully');
      return new StreamableFile(response.data);
    } catch (error) {
      this.handleApiError(error, `downloading file with URI ${fileUri}`);
    }
  }

  private handleApiError(error: AxiosError, context: string): never {
    this.logger.error(`Error ${context}: ${error.message}`, error.stack);
    if (error.response) {
      this.logger.error(`Error response status: ${error.response.status}`);
      this.logger.error(`Error response data:`, error.response.data);
      if (error.response.status === 404) {
        throw new NotFoundException(
          `DigiLocker API error (${context}): Resource not found.`,
        );
      }
      throw new InternalServerErrorException(
        `DigiLocker API error (${context}): ${error.response.status} - ${JSON.stringify(error.response.data)}`,
      );
    }
    throw new InternalServerErrorException(
      `DigiLocker API request failed (${context}): ${error.message}`,
    );
  }
}
