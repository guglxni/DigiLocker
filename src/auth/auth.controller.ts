import {
  Controller,
  Get,
  Query,
  Res,
  Req,
  UseGuards,
  UnauthorizedException,
  Post,
  Logger,
  HttpCode,
  HttpStatus,
  Body,
  BadRequestException,
  Param,
  InternalServerErrorException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { AccessTokenGuard } from './access-token.guard';
import { TokenService } from './token.service';
import {
  Response as ExpressResponse,
  Request as ExpressRequest,
} from 'express';
// import { RefreshThrottleGuard } from './refresh-throttle.guard';
import { Throttle } from '@nestjs/throttler';
import { Public } from './public.decorator';
import { ApiTags, ApiOperation, ApiResponse, ApiExcludeEndpoint, ApiCookieAuth, ApiQuery, ApiBody } from '@nestjs/swagger';
import { ApiProperty } from '@nestjs/swagger';
import * as path from 'path';
import * as fs from 'fs';
// import * as QRCode from 'qrcode';

// Define interfaces for type safety
interface QrSessionResponse {
  sessionId: string;
  qrCodeData: string;
  pollingUrl: string;
  expiresIn: number;
}

// DTO for exchange-code endpoint
class ExchangeCodeDto {
  @ApiProperty({ description: 'Authorization code received from DigiLocker callback', example: 'xxxxxx' })
  code: string;

  @ApiProperty({ description: 'State parameter received from DigiLocker callback (optional, but recommended for CSRF protection)', example: 'yyyyyy', required: false })
  state?: string;
}

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly tokenService: TokenService,
  ) {}

  @Public()
  @Get('login')
  @ApiOperation({ summary: 'Initiate DigiLocker Login Flow' })
  @ApiQuery({ name: 'frontend_callback', required: false, description: 'Frontend callback URL to redirect to after authentication' })
  @ApiResponse({ status: HttpStatus.FOUND, description: 'Redirects to DigiLocker login page.' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Internal server error during login initiation.' })
  async login(
    @Res() res: ExpressResponse, 
    @Req() req: ExpressRequest,
    @Query('frontend_callback') frontendCallback?: string
  ) {
    this.logger.log('Login endpoint called');
    try {
      await this.authService.login(res, frontendCallback);
    } catch (error) {
      this.logger.error(`Login redirection failed: ${error.message}`, error.stack);
      if (!res.headersSent) {
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: 'Login process failed.' });
      }
    }
  }

  @Public()
  @Get('callback')
  @ApiOperation({ summary: 'Handle DigiLocker OAuth Callback' })
  @ApiQuery({ name: 'code', description: 'Authorization code from DigiLocker', required: true, type: String })
  @ApiQuery({ name: 'state', description: 'State parameter for CSRF protection', required: true, type: String })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Authentication successful, cookies set, returns token and user info (in test/mock). In production, may redirect or return success message.',
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid state or code.' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Internal server error during callback processing.' })
  async handleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Req() req: ExpressRequest,
    @Res() res: ExpressResponse,
  ) {
    this.logger.log(`Callback received. Code: ${code ? '[PRESENT]' : '[MISSING]'}, State: ${state}`);
    
    try {
      const authResult = await this.authService.handleCallback(code, state, req, res);

      // If authService handled the redirect (due to frontendCallback), it won't return here or authResult will be undefined/empty.
      // If authResult is an object, it means authService did NOT redirect and we should.
      if (authResult && typeof authResult === 'object' && authResult.shouldRedirect) {
        this.logger.log('AuthService processed callback, AuthController redirecting to files dashboard');
        return res.redirect('/auth/files-dashboard');
      } else if (authResult && typeof authResult === 'object') {
        // This case implies a frontendCallback was handled by authService, or it returned data not meant for immediate redirect by controller.
        // For safety, if authService returns data but didn't intend for controller to redirect, we send it as JSON.
        // This path should ideally not be hit if frontendCallback logic in authService is exhaustive.
        this.logger.log('AuthService returned data, but not marked for redirect by controller. Sending JSON.');
        return res.json(authResult);
      }
      // If authService handled the response completely (e.g. res.redirect was called within it for a frontend_callback),
      // it might not return a value, or the response is already sent. Nothing more to do here.
      this.logger.log('AuthService likely handled the full response (e.g. due to frontend_callback_url).');

    } catch (error) {
      this.logger.error(`Error in AuthController.handleCallback: ${error.message}`, error.stack);
      if (!res.headersSent) {
        // Handle specific known errors, or rethrow for global error handler
        if (error.message && error.message.includes('Invalid or expired state')) {
          if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
             this.logger.warn('State validation failed, but redirecting to files-dashboard in dev/test mode as a fallback.');
             return res.redirect('/auth/files-dashboard');
          }
          return res.status(HttpStatus.BAD_REQUEST).json({ message: 'Invalid or expired state.', error: 'Bad Request' });
        }
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message || 'Internal server error' });
      } else {
        this.logger.error('Headers already sent in AuthController.handleCallback error path. Cannot send error response.');
      }
    }
  }

  @Public()
  @Post('exchange-code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange Authorization Code for Tokens (SPA Flow)' })
  @ApiBody({ type: ExchangeCodeDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Successfully exchanged code for tokens. Returns access token, refresh token (optional), expiry, and user info.',
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid code or state, or missing parameters.' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Internal server error during token exchange.' })
  async exchangeCode(
    @Body() exchangeCodeDto: ExchangeCodeDto,
  ) {
    this.logger.log(`POST /auth/exchange-code called with code: ${exchangeCodeDto.code ? '[PRESENT]' : '[MISSING]'}, state: ${exchangeCodeDto.state}`);
    if (!exchangeCodeDto.code) {
      throw new BadRequestException('Authorization code is required.');
    }
    return this.authService.exchangeCodeForToken(exchangeCodeDto.code, exchangeCodeDto.state);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log out user and clear session cookies' })
  @ApiCookieAuth()
  @ApiResponse({ status: HttpStatus.OK, description: 'Logout successful, cookies cleared.' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Error during logout.' })
  logout(@Req() req: ExpressRequest, @Res({ passthrough: true }) res: ExpressResponse) {
    this.logger.log('Logout endpoint called');
    return this.authService.logout(req, res);
  }

  @Get('user')
  @UseGuards(AccessTokenGuard)
  async getUser(@Req() req: ExpressRequest) {
    if (req['user']) {
      this.logger.log('Returning user data from req.user (populated by AccessTokenGuard).');
      return req['user'];
    }

    this.logger.error('/auth/user endpoint reached but req.user was not populated by AccessTokenGuard. This indicates an issue with the guard or an unexpected state.');
    const accessToken = this.tokenService.getAccessTokenFromRequest(req);
    if (!accessToken) {
      throw new UnauthorizedException('User not authenticated and no access token found for fallback.');
    }
    this.logger.warn('Falling back to manually fetching user info in /auth/user due to missing req.user.');
    return this.authService.getUser(accessToken);
  }

  @Post('refresh')
  // @UseGuards(RefreshThrottleGuard)
  @Throttle({ default: { limit: 5, ttl: 60 * 60 } })
  async refresh(
    @Req() req: ExpressRequest,
    @Res() res: ExpressResponse,
  ): Promise<any> {
    const refreshToken = this.tokenService.getRefreshTokenFromRequest(req);

    if (!refreshToken) {
      this.logger.warn('/auth/refresh called without a refresh token cookie.');
      throw new UnauthorizedException('Refresh token not found.');
    }

    try {
      const refreshedSuccessfully =
        await this.authService.refreshAccessTokenAndSetCookies(
          refreshToken,
          res,
        );

      if (refreshedSuccessfully) {
        this.logger.log(
          'Access token refreshed successfully via /auth/refresh.',
        );
        return res.json({ message: 'Access token refreshed successfully.' });
      }
      this.logger.warn(
        'Failed to refresh access token via /auth/refresh, AuthService handled cookie clearing.',
      );
      throw new UnauthorizedException(
        'Failed to refresh access token. Please log in again.',
      );
    } catch (error) {
      this.logger.error(
        `Error during /auth/refresh: ${error.message}`,
        error.stack,
      );
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException(
        'Could not refresh session. Please log in again.',
      );
    }
  }

  @ApiExcludeEndpoint()
  @Get('callback/test-headers')
  testHeaders(@Req() req: ExpressRequest, @Res() res: ExpressResponse) {
    this.logger.log('Test headers endpoint hit');
    res.json({ headers: req.headers, cookies: req.cookies });
  }

  @ApiExcludeEndpoint()
  @Public()
  @Get('debug/test-encryption')
  async testEncryption(@Res() res: ExpressResponse) {
    this.logger.log('Test encryption endpoint hit');
    try {
      // This will test the encryption key directly
      const result = await this.authService.testEncryption();
      res.json(result);
    } catch (error) {
      this.logger.error(`Error testing encryption: ${error.message}`, error.stack);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ 
        error: 'Error testing encryption', 
        message: error.message 
      });
    }
  }

  @ApiExcludeEndpoint()
  @Public()
  @Get('debug/test-cookies')
  async testCookies(@Req() req: ExpressRequest, @Res() res: ExpressResponse) {
    this.logger.log('Test cookies endpoint hit');
    try {
      // This will test setting and retrieving cookies
      const result = await this.authService.testCookies(req, res);
      return result; // Response is handled by the service method
    } catch (error) {
      this.logger.error(`Error testing cookies: ${error.message}`, error.stack);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ 
        error: 'Error testing cookies', 
        message: error.message 
      });
    }
  }

  // New direct route for the callback.html
  @ApiExcludeEndpoint()
  @Public()
  @Get('callback-page')
  serveCallbackPage(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: ExpressResponse
  ) {
    this.logger.log(`Serving callback page with code=${code}, state=${state}`);
    
    // This HTML will be served directly instead of from a file
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Authentication Callback</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          margin: 0;
          padding: 20px;
          background-color: #f7f9fc;
          color: #333;
        }
        .container {
          max-width: 800px;
          margin: 0 auto;
          background-color: white;
          padding: 30px;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }
        h1 {
          color: #2962ff;
          border-bottom: 2px solid #f0f0f0;
          padding-bottom: 10px;
        }
        .success-icon {
          font-size: 48px;
          color: #4caf50;
          text-align: center;
          margin: 20px 0;
        }
        .details {
          background-color: #f5f5f5;
          padding: 15px;
          border-radius: 4px;
          margin-top: 20px;
        }
        .details h2 {
          margin-top: 0;
          font-size: 18px;
          color: #555;
        }
        .details pre {
          white-space: pre-wrap;
          word-break: break-all;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Authentication Successful</h1>
        <div class="success-icon">✓</div>
        <p>You have been successfully authenticated with DigiLocker.</p>
        <p>You can close this window and return to the application.</p>
        
        <div class="details">
          <h2>Authentication Details:</h2>
          <div id="auth-details"></div>
          
          <h2>Cookies:</h2>
          <pre id="cookies"></pre>
        </div>
      </div>
      
      <script>
        document.addEventListener('DOMContentLoaded', function() {
          console.log("Authentication callback page loaded successfully");
          
          // Display URL parameters
          const urlParams = new URLSearchParams(window.location.search);
          const details = document.getElementById('auth-details');
          
          details.innerHTML = 
            '<p><strong>Code:</strong> ' + urlParams.get('code') + '</p>' +
            '<p><strong>State:</strong> ' + urlParams.get('state') + '</p>';
          
          // Display cookies
          document.getElementById('cookies').textContent = document.cookie;
        });
      </script>
    </body>
    </html>
    `;
    
    // Set content type to HTML and send the response
    res.set('Content-Type', 'text/html');
    return res.send(html);
  }

  @Get('login-page')
  serveLoginPage() {
    console.log('Serving login page');
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>DigiLocker Integration - Login</title>
        <link rel="stylesheet" href="/css/main.css">
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    </head>
    <body>
        <!-- Redirect to our static files -->
        <script>
            window.location.href = '/public/login.html';
        </script>
    </body>
    </html>`;
  }

  @Get('files-dashboard')
  serveFilesDashboard(@Res() res: ExpressResponse) {
    console.log('Serving files dashboard');
    const filePath = path.join(process.cwd(), 'public', 'files-dashboard.html');
    return res.sendFile(filePath);
  }

  @ApiExcludeEndpoint()
  @Public()
  @Get('/static/check_callback.html')
  redirectFromRootStaticCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: ExpressResponse
  ) {
    this.logger.log(`Redirecting from /static/check_callback.html to /auth/callback-page with code=${code}, state=${state}`);
    return res.redirect(`/auth/callback-page?code=${code}&state=${state}`);
  }

  @ApiExcludeEndpoint()
  @Public()
  @Get('check_callback.html')
  serveCheckCallbackPage(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: ExpressResponse
  ) {
    this.logger.log(`Serving direct check_callback.html with code=${code}, state=${state}`);
    
    // This HTML will be served directly instead of from a file
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>DigiLocker Authentication Callback</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          margin: 0;
          padding: 20px;
          background-color: #f7f9fc;
          color: #333;
        }
        .container {
          max-width: 800px;
          margin: 0 auto;
          background-color: white;
          padding: 30px;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }
        h1 {
          color: #3563e9;
          border-bottom: 2px solid #f0f0f0;
          padding-bottom: 10px;
        }
        .success-icon {
          font-size: 48px;
          color: #4caf50;
          text-align: center;
          margin: 20px 0;
        }
        .details {
          background-color: #f5f5f5;
          padding: 15px;
          border-radius: 4px;
          margin-top: 20px;
        }
        .details h2 {
          margin-top: 0;
          font-size: 18px;
          color: #555;
        }
        .details pre {
          white-space: pre-wrap;
          word-break: break-all;
        }
        .btn {
          display: inline-block;
          padding: 10px 20px;
          background-color: #3563e9;
          color: white;
          border-radius: 5px;
          text-decoration: none;
          margin-top: 20px;
          font-weight: 500;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Authentication Successful</h1>
        <div class="success-icon">✓</div>
        <p>You have been successfully authenticated with DigiLocker.</p>
        <p>You will be redirected to the files dashboard shortly.</p>
        
        <div class="details" style="display: none;"> <!-- Optionally hide or remove details -->
          <h2>Authentication Details:</h2>
          <div id="auth-details"></div>
          
          <h2>Cookies:</h2>
          <pre id="cookies"></pre>
        </div>
        
        <a href="/auth/files-dashboard" class="btn" id="dashboard-link">Go to Files Dashboard</a>
      </div>
      
      <script>
        document.addEventListener('DOMContentLoaded', function() {
          console.log("Authentication callback page loaded successfully.");
          
          const urlParams = new URLSearchParams(window.location.search);
          const code = urlParams.get('code');
          const state = urlParams.get('state');
          
          // Display URL parameters (optional, can be removed for cleaner UX)
          const details = document.getElementById('auth-details');
          if (details) { // Check if element exists
            details.innerHTML = 
              '<p><strong>Code:</strong> ' + (code || 'N/A') + '</p>' +
              '<p><strong>State:</strong> ' + (state || 'N/A') + '</p>';
          }
          
          // Display cookies (optional, for debugging, can be removed)
          const cookiesEl = document.getElementById('cookies');
          if (cookiesEl) { // Check if element exists
             cookiesEl.textContent = document.cookie;
          }
          
          // Automatically redirect to the files dashboard
          // The necessary authentication cookies should have already been set by the backend
          // during the initial callback handling before this page was served.
          setTimeout(function() {
            window.location.href = '/auth/files-dashboard'; // Or simply '../files_dashboard.html' if served statically from same level
          }, 3000); // 3-second delay before redirect
        });
      </script>
    </body>
    </html>
    `;
    
    // Set content type to HTML and send the response
    res.set('Content-Type', 'text/html');
    return res.send(html);
  }

  @ApiExcludeEndpoint()
  @Public()
  @Get('qr-session')
  async initiateQRSession(): Promise<QrSessionResponse> {
    this.logger.log('GET /auth/qr-session');
    
    try {
      const qrSessionData = await this.authService.initiateQRSession();
      
      return {
        sessionId: qrSessionData.sessionId,
        qrCodeData: qrSessionData.qrCodeData,
        pollingUrl: qrSessionData.pollingUrl,
        expiresIn: qrSessionData.expiresIn
      };
    } catch (error) {
      this.logger.error(`Error initiating QR session: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to generate QR session');
    }
  }
  
  @Get('qr-status/:sessionId')
  async checkQRStatus(
    @Param('sessionId') sessionId: string,
    @Res() res: ExpressResponse
  ) {
    this.logger.log(`GET /auth/qr-status/${sessionId}`);
    
    try {
      const statusResponse = await this.authService.checkQRStatus(sessionId);
      
      // For successful sessions with tokens, set the authentication cookies
      if (statusResponse.status === 'SUCCESS') {
        // Get the session data to retrieve token information
        const sessionData = await this.authService.getQrSessionData(sessionId);
        
        if (sessionData && sessionData.accessToken && sessionData.accessTokenExpiresAt) {
          // Calculate expires_in in seconds from expiration timestamp
          const expiresIn = sessionData.accessTokenExpiresAt - Math.floor(Date.now() / 1000);
          
          // Set authentication cookies
          this.authService.setAuthCookies(
            res,
            sessionData.accessToken,
            expiresIn,
            sessionData.refreshToken || null
          );
        }
      }
      
      // Send the status response
      const httpStatus = this.getHttpStatusForQrStatus(statusResponse.status);
      return res.status(httpStatus).json(statusResponse);
    } catch (error) {
      this.logger.error(`Error checking QR status: ${error.message}`, error.stack);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        sessionId,
        status: 'ERROR',
        message: 'Internal server error'
      });
    }
  }
  
  private getHttpStatusForQrStatus(status: string): number {
    switch (status) {
      case 'SUCCESS':
        return HttpStatus.OK;
      case 'PENDING':
        return HttpStatus.OK;
      case 'NOT_FOUND':
        return HttpStatus.NOT_FOUND;
      case 'FAILED':
        return HttpStatus.BAD_REQUEST;
      case 'ERROR':
        return HttpStatus.INTERNAL_SERVER_ERROR;
      default:
        return HttpStatus.OK;
    }
  }

  @Public()
  @Get('qr-callback')
  async handleQRCallback(
    @Query('code') authCode: string,       // Expect 'code' from DigiLocker
    @Query('state') state: string,        // Expect 'state' (which is our original sessionId)
    // @Query('session_id') sessionId: string, // No longer expecting session_id directly
    @Res() res: ExpressResponse
  ) {
    this.logger.log(`GET /auth/qr-callback received with state: ${state}, authCode: ${authCode ? '[PRESENT]' : '[MISSING]'}`);

    if (!state || !authCode) {
      this.logger.warn('/auth/qr-callback called with missing state or authCode.');
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: 'Missing required parameters (state, code) for QR callback.'
      });
    }

    // Delegate to AuthService, using the received 'state' as the 'sessionId' for internal tracking
    try {
      await this.authService.handleQRCallback(state, authCode, res);
      // Response is handled within authService.handleQRCallback
    } catch (error) {
      this.logger.error(`Error calling authService.handleQRCallback for state ${state}: ${error.message}`, error.stack);
      if (!res.headersSent) {
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          success: false,
          message: 'An unexpected error occurred while processing the QR callback.'
        });
      }
    }
  }

  @Get('oauth-integration-guide')
  serveOAuthIntegrationGuide(@Res() res: ExpressResponse) {
    console.log('Serving OAuth integration guide');
    const filePath = path.join(process.cwd(), 'public', 'oauth-integration-guide.html');
    return res.sendFile(filePath);
  }
}
