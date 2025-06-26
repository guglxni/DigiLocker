import { Controller, Post, Get, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../../auth/auth.service';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Controller('api/v1/hconnect')
export class HConnectController {
  private readonly logger = new Logger(HConnectController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {}

  @Post('/verify')
  async verifyWithHConnect(@Req() req: Request, @Res() res: Response) {
    try {
      // Get DigiLocker token from cookie
      const dlToken = req.cookies['dl_token'];
      
      if (!dlToken) {
        this.logger.warn('No DigiLocker token found in cookies');
        return res.status(401).json({ 
          success: false, 
          message: 'Authentication required. Please log in with DigiLocker first.' 
        });
      }
      
      // Get user info from DigiLocker token
      const userInfo = await this.authService.getUser(dlToken);
      
      this.logger.log(`Processing hConnect verification for user: ${userInfo.sub}`);
      
      // Format for hConnect API
      const verificationData = {
        eid_provider: "DigiLocker",
        country_code: "IN",
        verification_level: "high",
        user_identifier: userInfo.sub,
        verified_claims: {
          name: userInfo.name,
          dob: userInfo.dob || null,
          has_aadhaar: userInfo.eaadhaar === "Y",
          email: userInfo.email || null
        },
        verification_timestamp: Date.now(),
        token: dlToken
      };
      
      // In a production environment, you would call the actual hConnect API
      // For now, we'll simulate a successful response
      /* 
      const hConnectResponse = await firstValueFrom(
        this.httpService.post(
          'https://api.hopae.com/hconnect/v1/verify', 
          verificationData,
          {
            headers: {
              'Authorization': `Bearer ${this.configService.get('HOPAE_API_KEY')}`,
              'Content-Type': 'application/json'
            }
          }
        )
      );
      */
      
      // Mock response for development purposes
      const mockHConnectResponse = {
        verification_id: `hc-${Math.random().toString(36).substring(2, 15)}`,
        status: "verified",
        provider: "DigiLocker",
        country: "IN",
        level: "high",
        timestamp: new Date().toISOString(),
        expires_at: new Date(Date.now() + 86400000).toISOString(), // 24 hours
        token: `hc_${Math.random().toString(36).substring(2, 15)}`
      };
      
      // Store verification in user session or database if needed
      // req.session.hconnect = mockHConnectResponse;
      
      // Return verification response
      return res.json({
        success: true,
        message: "Successfully verified with hConnect",
        verification: mockHConnectResponse
      });
    } catch (error) {
      this.logger.error(`hConnect verification error: ${error.message}`, error.stack);
      return res.status(500).json({
        success: false,
        message: 'Failed to verify with hConnect',
        error: error.message
      });
    }
  }

  @Get('/status')
  async getVerificationStatus(@Req() req: Request, @Res() res: Response) {
    // In a production implementation, this would check the verification status
    // For now, return a simple status message
    return res.json({
      success: true,
      message: "hConnect verification status endpoint",
      isVerified: req.cookies['dl_token'] ? true : false
    });
  }
} 