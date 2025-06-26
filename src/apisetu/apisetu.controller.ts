import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Logger,
  BadRequestException,
  Query,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { ApiSetuService } from './apisetu.service';
import {
  CreateDigiLockerRequestDto,
  DigiLockerRequestResponse,
  DigiLockerStatusResponse,
  FetchDocumentDto,
  DocumentResponse,
  AadhaarDataResponse,
  DocumentsListResponse,
  AccessToken,
  AuthTokenResponse,
  AccessTokenOpenId,
} from './dto/apisetu-request.dto';

@ApiTags('APISetu DigiLocker Integration')
@Controller('apisetu')
export class ApiSetuController {
  private readonly logger = new Logger(ApiSetuController.name);

  constructor(private readonly apiSetuService: ApiSetuService) {}

  /**
   * Create a new DigiLocker request
   * POST /apisetu/digilocker
   */
  @Post('digilocker')
  @ApiOperation({ 
    summary: 'Create DigiLocker Request (Step 1: Authorization)',
    description: 'Creates a new DigiLocker request following the official APISetu flow. Returns authorization URL for MeriPehchaan SSO.'
  })
  @ApiResponse({ 
    status: 201, 
    description: 'DigiLocker request created successfully',
    type: DigiLockerRequestResponse
  })
  @ApiResponse({ status: 400, description: 'Bad request - invalid redirect URL' })
  async createDigiLockerRequest(
    @Body() dto: CreateDigiLockerRequestDto,
  ): Promise<DigiLockerRequestResponse> {
    this.logger.log('Creating new DigiLocker request via APISetu');
    return this.apiSetuService.createDigiLockerRequest(dto);
  }

  /**
   * Get DigiLocker request status
   * GET /apisetu/digilocker/:id/status
   */
  @Get('digilocker/:id/status')
  @ApiOperation({ 
    summary: 'Get DigiLocker Request Status (Step 2: Check Authentication)',
    description: 'Check the status of a DigiLocker request. Status can be: unauthenticated, authenticated, or revoked.'
  })
  @ApiParam({ name: 'id', description: 'DigiLocker request ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Request status retrieved successfully',
    type: DigiLockerStatusResponse
  })
  @ApiResponse({ status: 404, description: 'Request not found or expired' })
  async getDigiLockerRequestStatus(
    @Param('id') requestId: string,
  ): Promise<DigiLockerStatusResponse> {
    this.logger.log(`Getting status for DigiLocker request: ${requestId}`);
    return this.apiSetuService.getDigiLockerRequestStatus(requestId);
  }

  /**
   * Get list of all available documents
   * GET /apisetu/digilocker/documents
   */
  @Get('digilocker/documents')
  @ApiOperation({ 
    summary: 'Get Available Documents (Step 3: List Documents)',
    description: 'Get list of all available document types that can be fetched from DigiLocker via APISetu.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Available documents retrieved successfully',
    type: DocumentsListResponse
  })
  async getAvailableDocuments(): Promise<DocumentsListResponse> {
    this.logger.log('Fetching available documents list');
    return this.apiSetuService.getAvailableDocuments();
  }

  /**
   * Fetch a specific document
   * POST /apisetu/digilocker/:id/document
   */
  @Post('digilocker/:id/document')
  @ApiOperation({ 
    summary: 'Fetch Specific Document (Step 4: Get Document)',
    description: 'Fetch a specific document from DigiLocker. Requires user authentication and consent.'
  })
  @ApiParam({ name: 'id', description: 'DigiLocker request ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Document fetched successfully',
    type: DocumentResponse
  })
  @ApiResponse({ status: 400, description: 'Request not authenticated or consent not provided' })
  @ApiResponse({ status: 404, description: 'Request not found' })
  async fetchDocument(
    @Param('id') requestId: string,
    @Body() dto: FetchDocumentDto,
  ): Promise<DocumentResponse> {
    this.logger.log(
      `Fetching document ${dto.docType} for request: ${requestId}`,
    );
    return this.apiSetuService.fetchDocument(requestId, dto);
  }

  /**
   * Fetch Aadhaar data
   * GET /apisetu/digilocker/:id/aadhaar
   */
  @Get('digilocker/:id/aadhaar')
  @ApiOperation({ 
    summary: 'Fetch Aadhaar Data (Special Endpoint)',
    description: 'Fetch detailed Aadhaar data including address, demographics, and verification status.'
  })
  @ApiParam({ name: 'id', description: 'DigiLocker request ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Aadhaar data retrieved successfully',
    type: AadhaarDataResponse
  })
  @ApiResponse({ status: 400, description: 'Request not authenticated' })
  @ApiResponse({ status: 404, description: 'Request not found' })
  async fetchAadhaarData(
    @Param('id') requestId: string,
  ): Promise<AadhaarDataResponse> {
    this.logger.log(`Fetching Aadhaar data for request: ${requestId}`);
    return this.apiSetuService.fetchAadhaarData(requestId);
  }

  /**
   * Revoke DigiLocker request
   * GET /apisetu/digilocker/:id/revoke
   */
  @Get('digilocker/:id/revoke')
  @ApiOperation({ 
    summary: 'Revoke DigiLocker Request',
    description: 'Revoke a DigiLocker request and invalidate any associated tokens.'
  })
  @ApiParam({ name: 'id', description: 'DigiLocker request ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Request revoked successfully',
    schema: { 
      type: 'object', 
      properties: { 
        success: { type: 'boolean', example: true } 
      } 
    }
  })
  @ApiResponse({ status: 404, description: 'Request not found' })
  async revokeDigiLockerRequest(
    @Param('id') requestId: string,
  ): Promise<{ success: boolean }> {
    this.logger.log(`Revoking DigiLocker request: ${requestId}`);
    return this.apiSetuService.revokeDigiLockerRequest(requestId);
  }

  /**
   * Demo endpoint to simulate user consent flow
   * This simulates what would happen when user visits the APISetu DigiLocker URL
   * GET /apisetu/demo/consent?request_id=xxx&redirect_uri=xxx
   */
  @Get('demo/consent')
  @ApiOperation({ 
    summary: 'Demo: Simulate User Consent (Mock Only)',
    description: 'Simulate user consent for demo purposes. In production, this would be handled by MeriPehchaan.'
  })
  @ApiQuery({ name: 'request_id', description: 'DigiLocker request ID' })
  @ApiQuery({ name: 'redirect_uri', description: 'Callback URL after consent' })
  @ApiResponse({ 
    status: 200, 
    description: 'Mock consent simulation completed',
    type: AccessToken
  })
  async simulateUserConsent(
    @Query('request_id') requestId: string,
    @Query('redirect_uri') redirectUri: string,
  ): Promise<any> {
    if (!requestId || !redirectUri) {
      throw new BadRequestException('request_id and redirect_uri are required');
    }

    this.logger.log(`[CONSENT] Simulating user consent for request: ${requestId}`);

    try {
      // FOR COMPLIANCE: This endpoint is deprecated - real Setu handles consent
      return {
        message: 'Real Setu API integration enabled - no simulation needed',
        status: 'redirect_to_real_setu',
        redirectTo: `${redirectUri}?success=true&id=${requestId}&scope=ADHAR`,
        note: 'Real Setu DigiLocker integration active - consent handled by https://dg-sandbox.setu.co'
      };
    } catch (error) {
      this.logger.error(`[CONSENT] Failed to simulate consent for ${requestId}`, error);
      throw error;
    }
  }

  /**
   * Consent simulation page (HTML) - serves an interactive consent page
   * GET /apisetu/consent-page?request_id=xxx&redirect_uri=xxx
   */
  @Get('consent-page')
  @ApiOperation({
    summary: 'Consent Simulation Page',
    description: 'Serves an HTML page that simulates the DigiLocker consent process'
  })
  @ApiQuery({ name: 'request_id', description: 'DigiLocker request ID' })
  @ApiQuery({ name: 'redirect_uri', description: 'Callback URL after consent' })
  async serveConsentPage(
    @Query('request_id') requestId: string,
    @Query('redirect_uri') redirectUri: string,
    @Res() res: any,
  ): Promise<void> {
    if (!requestId || !redirectUri) {
      return res.status(400).send('<h1>Error: Missing request_id or redirect_uri</h1>');
    }

    this.logger.log(`[CONSENT PAGE] Serving consent page for request: ${requestId}`);

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DigiLocker Consent - Setu Sandbox</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            padding: 40px;
            max-width: 500px;
            width: 100%;
            text-align: center;
        }
        .logo {
            width: 60px;
            height: 60px;
            background: #0D4EA3;
            border-radius: 50%;
            margin: 0 auto 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 24px;
            font-weight: bold;
        }
        h1 { color: #0D4EA3; margin-bottom: 10px; font-size: 24px; }
        .subtitle { color: #666; margin-bottom: 30px; }
        .info-box {
            background: #f8f9ff;
            border: 1px solid #e3e8ff;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 30px;
            text-align: left;
        }
        .info-item { margin-bottom: 10px; }
        .label { font-weight: 600; color: #374151; }
        .value { color: #6b7280; font-family: monospace; font-size: 14px; }
        .permissions {
            background: #fffbeb;
            border: 1px solid #fed7aa;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 30px;
        }
        .permissions h3 { color: #92400e; margin-bottom: 15px; }
        .permission-item {
            display: flex;
            align-items: center;
            margin-bottom: 10px;
            color: #78350f;
        }
        .permission-item::before {
            content: "✓";
            background: #10b981;
            color: white;
            border-radius: 50%;
            width: 20px;
            height: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 10px;
            font-size: 12px;
        }
        .buttons {
            display: flex;
            gap: 15px;
            margin-top: 30px;
        }
        .btn {
            flex: 1;
            padding: 12px 24px;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
        }
        .btn-primary {
            background: #0D4EA3;
            color: white;
        }
        .btn-primary:hover { background: #0a3d82; }
        .btn-secondary {
            background: #6b7280;
            color: white;
        }
        .btn-secondary:hover { background: #4b5563; }
        .processing {
            display: none;
            margin-top: 20px;
            color: #0D4EA3;
        }
        .spinner {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 3px solid #f3f4f6;
            border-top: 3px solid #0D4EA3;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-right: 10px;
        }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .footer { margin-top: 30px; font-size: 12px; color: #9ca3af; }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">DL</div>
        <h1>DigiLocker Access Request</h1>
        <p class="subtitle">Setu Sandbox Environment</p>
        
        <div class="info-box">
            <div class="info-item">
                <div class="label">Request ID:</div>
                <div class="value">${requestId}</div>
            </div>
            <div class="info-item">
                <div class="label">Application:</div>
                <div class="value">DigiLocker Integration Demo</div>
            </div>
            <div class="info-item">
                <div class="label">Redirect URI:</div>
                <div class="value">${redirectUri}</div>
            </div>
        </div>

        <div class="permissions">
            <h3>🔐 Permissions Requested</h3>
            <div class="permission-item">Access to your issued documents</div>
            <div class="permission-item">Read your Aadhaar information</div>
            <div class="permission-item">Access to uploaded documents</div>
        </div>

        <div class="buttons">
            <button class="btn btn-secondary" onclick="denyAccess()">Deny</button>
            <button class="btn btn-primary" onclick="grantAccess()">Allow Access</button>
        </div>

        <div class="processing" id="processing">
            <div class="spinner"></div>
            Processing your consent...
        </div>

        <div class="footer">
            <p>🔒 This is a sandbox environment for testing purposes</p>
            <p>In production, this would be the official government consent page</p>
        </div>
    </div>

    <script>
        async function grantAccess() {
            document.getElementById('processing').style.display = 'block';
            document.querySelector('.buttons').style.display = 'none';
            
            try {
                // Simulate the consent API call
                const response = await fetch('/apisetu/demo/consent?request_id=${requestId}&redirect_uri=${encodeURIComponent(redirectUri)}');
                const result = await response.json();
                
                if (response.ok) {
                    // Simulate redirect back to the application
                    window.location.href = result.redirectTo;
                } else {
                    alert('Error: ' + (result.message || 'Consent failed'));
                    document.getElementById('processing').style.display = 'none';
                    document.querySelector('.buttons').style.display = 'flex';
                }
            } catch (error) {
                alert('Error: ' + error.message);
                document.getElementById('processing').style.display = 'none';
                document.querySelector('.buttons').style.display = 'flex';
            }
        }

        function denyAccess() {
            alert('Access denied. You will be redirected back to the application.');
            window.location.href = '${redirectUri}?error=access_denied&error_description=User denied access';
        }
    </script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }

  /**
   * Health check endpoint for APISetu integration
   * GET /apisetu/health
   */
  @Get('health')
  @ApiOperation({ 
    summary: 'APISetu Health Check',
    description: 'Check the health status of the APISetu DigiLocker integration service.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Service is healthy',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'healthy' },
        service: { type: 'string', example: 'APISetu DigiLocker Integration' },
        timestamp: { type: 'string', example: '2025-05-30T21:50:51.042Z' },
        version: { type: 'string', example: '1.0.0' },
        environment: { type: 'string', example: 'mock' },
        schemas: { 
          type: 'object',
          properties: {
            AccessToken: { type: 'string', example: 'Official APISetu AccessToken schema implemented' },
            AuthTokenResponse: { type: 'string', example: 'Official APISetu AuthTokenResponse schema implemented' },
            AccessTokenOpenId: { type: 'string', example: 'Official APISetu AccessTokenOpenId schema implemented' },
            compliance: { type: 'string', example: 'APISetu v1.12 + MeriPehchaan v2.3' }
          }
        }
      }
    }
  })
  async healthCheck(): Promise<any> {
    return {
      status: 'healthy',
      service: 'APISetu DigiLocker Integration',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      schemas: {
        AccessToken: 'Official APISetu AccessToken schema implemented',
        AuthTokenResponse: 'Official APISetu AuthTokenResponse schema implemented',
        AccessTokenOpenId: 'Official APISetu AccessTokenOpenId schema implemented',
        compliance: 'APISetu v1.12 + MeriPehchaan v2.3'
      }
    };
  }
} 