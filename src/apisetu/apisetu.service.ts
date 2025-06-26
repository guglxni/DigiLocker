import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import axios, { AxiosResponse } from 'axios';
import {
  CreateDigiLockerRequestDto,
  DigiLockerRequestResponse,
  DigiLockerStatusResponse,
  FetchDocumentDto,
  DocumentResponse,
  AadhaarDataResponse,
  DocumentsListResponse,
  AvailableDocument,
  AccessToken,
  AuthTokenResponse,
  AccessTokenOpenId,
  StoredRequest,
} from './dto/apisetu-request.dto';

@Injectable()
export class ApiSetuService {
  private readonly logger = new Logger(ApiSetuService.name);
  private readonly mockRequests = new Map<string, StoredRequest>();
  private readonly nodeEnv: string;

  constructor(private readonly configService: ConfigService) {
    this.nodeEnv = this.configService.get<string>('NODE_ENV') || 'development';
    
    // Setup cleanup interval for expired requests
    setInterval(() => {
      this.cleanupExpiredRequests();
    }, 5 * 60 * 1000); // Run every 5 minutes
  }

  /**
   * Generate a unique trace ID for request tracking
   */
  private generateTraceId(): string {
    return uuidv4();
  }

  /**
   * Step 1: Create DigiLocker request with Setu API (with fallback for demo)
   */
  async createDigiLockerRequest(
    dto: CreateDigiLockerRequestDto,
  ): Promise<DigiLockerRequestResponse> {
    const startTime = Date.now();
    const traceId = this.generateTraceId();
    this.logger.log(`[${traceId}] Creating DigiLocker request`);

    try {
      // FOR COMPLIANCE: Always attempt real Setu API first
      const setuResponse = await this.callSetuAPI('POST', '/api/digilocker/', {
        redirectUrl: dto.redirectUrl,
        documents: ['AADHAAR'],
      });

      const duration = Date.now() - startTime;
      this.logger.log(`[${traceId}] DigiLocker request created successfully in ${duration}ms`);

      // Store the request for status tracking
      const request: StoredRequest = {
        id: setuResponse.id,
        status: setuResponse.status,
        validUpto: setuResponse.validUpto,
        url: setuResponse.url,
        redirectUrl: dto.redirectUrl,
        createdAt: new Date(),
        traceId,
      };
      this.mockRequests.set(setuResponse.id, request);

      return {
        id: setuResponse.id,
        url: setuResponse.url,
        status: setuResponse.status,
        validUpto: setuResponse.validUpto,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Enhanced error logging with console.error for debugging
      const errorDetails = {
        status: error.response?.status,
        statusText: error.response?.statusText,
        errorData: error.response?.data,
        message: error.message,
        fullError: error.toString(),
        stack: error.stack?.split('\n').slice(0, 3).join('\n')
      };
      
      console.error(`[SETU API ERROR] POST /api/digilocker/:`, JSON.stringify(errorDetails, null, 2));
      this.logger.error(`[${traceId}] Failed to create DigiLocker request in ${duration}ms`, errorDetails);
      
      // Re-throw the error to maintain real API behavior
      throw new BadRequestException(error.response?.data?.message || 'Failed to create DigiLocker request');
    }
  }

  /**
   * Step 2: Check request status and handle token exchange
   */
  async getDigiLockerRequestStatus(
    requestId: string,
  ): Promise<DigiLockerStatusResponse> {
    const startTime = Date.now();
    this.logger.log(`[STATUS] Getting status for DigiLocker request: ${requestId}`);

    try {
      // FOR COMPLIANCE: Use real Setu API
      const setuResponse = await this.callSetuAPI('GET', `/api/digilocker/${requestId}/status`);

      const duration = Date.now() - startTime;
      this.logger.log(`[STATUS] Status check completed in ${duration}ms`);

      // Update local storage with real status
      const request = this.mockRequests.get(requestId);
      if (request) {
        request.status = setuResponse.status;
        if (setuResponse.digilockerUserDetails) {
          request.userDetails = {
            digilockerId: setuResponse.digilockerUserDetails.digilockerId,
            email: setuResponse.digilockerUserDetails.email,
            phoneNumber: setuResponse.digilockerUserDetails.phoneNumber,
          };
        }
        this.mockRequests.set(requestId, request);
      }

      return {
        id: setuResponse.id,
        status: setuResponse.status,
        validUpto: setuResponse.validUpto,
        traceId: setuResponse.traceId,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`[STATUS] Failed to get status in ${duration}ms`, error);
      throw new BadRequestException('Failed to get request status');
    }
  }



  /**
   * Get list of all available documents from real Setu API
   */
  async getAvailableDocuments(): Promise<DocumentsListResponse> {
    const startTime = Date.now();
    this.logger.log(`[DOCUMENTS] Fetching available documents list`);

    try {
      // FOR COMPLIANCE: Use real Setu API
      const setuResponse = await this.callSetuAPI('GET', '/api/digilocker/documents');

      const duration = Date.now() - startTime;
      this.logger.log(`[DOCUMENTS] Documents list fetched successfully in ${duration}ms`);

      return setuResponse;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`[DOCUMENTS] Failed to fetch documents list in ${duration}ms`, error);
      throw new BadRequestException('Failed to fetch available documents');
    }
  }

  /**
   * Fetch a document from DigiLocker using real Setu API
   */
  async fetchDocument(
    requestId: string,
    dto: any, // You can define proper DTO interface for document fetch
  ): Promise<any> {
    const startTime = Date.now();
    this.logger.log(`[DOCUMENT] Fetching document for request: ${requestId}`);

    try {
      // FOR COMPLIANCE: Use real Setu API
      const setuResponse = await this.callSetuAPI('POST', `/api/digilocker/${requestId}/document`, dto);

      const duration = Date.now() - startTime;
      this.logger.log(`[DOCUMENT] Document fetched successfully in ${duration}ms`);

      return setuResponse;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`[DOCUMENT] Failed to fetch document in ${duration}ms`, error);
      throw new BadRequestException('Failed to fetch document');
    }
  }

  /**
   * Fetch Aadhaar data (requires authentication)
   */
  async fetchAadhaarData(requestId: string): Promise<AadhaarDataResponse> {
    const startTime = Date.now();
    this.logger.log(`[AADHAAR] Fetching Aadhaar data for request: ${requestId}`);

    try {
      // FOR COMPLIANCE: Use real Setu API
      const setuResponse = await this.callSetuAPI('GET', `/api/digilocker/${requestId}/aadhaar`);

      const duration = Date.now() - startTime;
      this.logger.log(`[AADHAAR] Aadhaar data fetched successfully in ${duration}ms`);

      return {
        id: setuResponse.id,
        status: setuResponse.status,
        aadhaar: setuResponse.aadhaar, // Real Aadhaar data from Setu
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`[AADHAAR] Failed to fetch Aadhaar data in ${duration}ms`, error);
      throw new BadRequestException('Failed to fetch Aadhaar data');
    }
  }

  /**
   * Revoke DigiLocker request using real Setu API
   */
  async revokeDigiLockerRequest(requestId: string): Promise<{ success: boolean }> {
    const startTime = Date.now();
    this.logger.log(`[REVOKE] Revoking DigiLocker request: ${requestId}`);

    try {
      // FOR COMPLIANCE: Use real Setu API
      const setuResponse = await this.callSetuAPI('GET', `/api/digilocker/${requestId}/revoke`);

      // Also remove from local storage
      this.mockRequests.delete(requestId);

      const duration = Date.now() - startTime;
      this.logger.log(`[REVOKE] DigiLocker request revoked successfully in ${duration}ms`);

      return setuResponse;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`[REVOKE] Failed to revoke DigiLocker request in ${duration}ms`, error);
      throw new BadRequestException('Failed to revoke DigiLocker request');
    }
  }

  /**
   * Health check endpoint
   */
  async healthCheck(): Promise<{ status: string; timestamp: string; environment: string; version: string }> {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: this.nodeEnv,
      version: '1.0.0'
    };
  }

  /**
   * Cleanup expired requests
   */
  cleanupExpiredRequests(): void {
    const now = new Date();
    let cleanedCount = 0;

    for (const [requestId, request] of this.mockRequests.entries()) {
      if (now > new Date(request.validUpto)) {
        this.mockRequests.delete(requestId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.log(`Cleaned up ${cleanedCount} expired requests`);
    }
  }

  /**
   * Call real Setu API with proper authentication
   */
  private async callSetuAPI(method: string, endpoint: string, data?: any): Promise<any> {
    const baseUrl = this.configService.get<string>('SETU_DIGILOCKER_BASE_URL');
    const clientId = this.configService.get<string>('SETU_CLIENT_ID');
    const clientSecret = this.configService.get<string>('SETU_CLIENT_SECRET');
    const productInstanceId = this.configService.get<string>('SETU_PRODUCT_INSTANCE_ID');

    const url = `${baseUrl}${endpoint}`;
    
    const headers = {
      'Content-Type': 'application/json',
      'x-client-id': clientId,
      'x-client-secret': clientSecret,
      'x-product-instance-id': productInstanceId,
    };

    this.logger.debug(`[SETU API] ${method} ${url}`, { headers: { ...headers, 'x-client-secret': '[REDACTED]' } });

    try {
      let response: AxiosResponse;
      
      switch (method.toUpperCase()) {
        case 'GET':
          response = await axios.get(url, { headers });
          break;
        case 'POST':
          response = await axios.post(url, data, { headers });
          break;
        case 'PUT':
          response = await axios.put(url, data, { headers });
          break;
        case 'DELETE':
          response = await axios.delete(url, { headers });
          break;
        default:
          throw new Error(`Unsupported HTTP method: ${method}`);
      }

      this.logger.debug(`[SETU API] ${method} ${url} - ${response.status}`, {
        status: response.status,
        responseSize: JSON.stringify(response.data).length
      });

      return response.data;
    } catch (error) {
      // Enhanced error logging with console.error for debugging
      const errorDetails = {
        status: error.response?.status,
        statusText: error.response?.statusText,
        errorData: error.response?.data,
        message: error.message,
        fullError: error.toString(),
        stack: error.stack?.split('\n').slice(0, 3).join('\n')
      };
      
      console.error(`[SETU API ERROR] ${method} ${url}:`, JSON.stringify(errorDetails, null, 2));
      
      this.logger.error(`[SETU API] ${method} ${url} - Error`, errorDetails);
      
      // Re-throw with appropriate status code
      if (error.response?.status === 400) {
        throw new BadRequestException(error.response.data?.message || 'Invalid request');
      } else if (error.response?.status === 401) {
        throw new BadRequestException('Authentication failed - check credentials');
      } else if (error.response?.status === 404) {
        throw new BadRequestException('Resource not found');
      } else {
        throw new BadRequestException('External API error');
      }
    }
  }
} 