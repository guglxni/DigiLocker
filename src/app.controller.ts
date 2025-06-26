import { Controller, Get, Param, Res, BadRequestException } from '@nestjs/common';
import { AppService } from './app.service';
import { Response } from 'express';
import { join } from 'path';
import * as path from 'path';
import * as fs from 'fs';
import { Public } from './auth/public.decorator';
import { ApiTags, ApiExcludeEndpoint, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Application')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get()
  getHello(@Res() res: Response) {
    const indexPath = join(process.cwd(), 'public', 'index.html');
    return res.sendFile(indexPath);
  }

  @Public()
  @ApiExcludeEndpoint()
  @Get('public/:filename')
  servePublic(@Param('filename') filename: string, @Res() res: Response) {
    const safePath = join(__dirname, '..', 'public', filename);
    
    // Security check to prevent directory traversal
    const publicDir = join(__dirname, '..', 'public');
    if (!safePath.startsWith(publicDir)) {
      throw new BadRequestException('Invalid file path');
    }
    
    return res.sendFile(safePath);
  }

  @Public()
  @ApiExcludeEndpoint()
  @Get('css/:filename')
  serveCss(@Param('filename') filename: string, @Res() res: Response) {
    const safePath = join(__dirname, '..', 'public', 'css', filename);
    
    // Security check to prevent directory traversal
    const cssDir = join(__dirname, '..', 'public', 'css');
    if (!safePath.startsWith(cssDir)) {
      throw new BadRequestException('Invalid file path');
    }
    
    return res.sendFile(safePath);
    }

  @Public()
  @Get('production-guide')
  @ApiOperation({ summary: 'Production deployment guide for Hopae evaluators' })
  @ApiResponse({ status: 200, description: 'Production deployment guide page' })
  getProductionGuide(@Res() res: Response) {
    const guidePath = join(process.cwd(), 'public', 'production-guide.html');
    return res.sendFile(guidePath);
  }

  @Public()
  @Get('apisetu-demo')
  @ApiOperation({ summary: 'APISetu DigiLocker integration demo page' })
  @ApiResponse({ status: 200, description: 'APISetu demo page' })
  getApiSetuDemo(@Res() res: Response) {
    const demoPath = join(process.cwd(), 'public', 'apisetu-demo.html');
    return res.sendFile(demoPath);
  }

  @Public()
  @Get('apisetu-advanced.html')
  @ApiOperation({ summary: 'Advanced APISetu + MeriPehchaan integration with PKCE and cross-device authentication' })
  @ApiResponse({ status: 200, description: 'Advanced production-ready APISetu demo page' })
  getApiSetuAdvanced(@Res() res: Response) {
    const advancedPath = join(process.cwd(), 'public', 'apisetu-advanced.html');
    return res.sendFile(advancedPath);
  }

  @Public()
  @Get('apisetu-health')
  @ApiOperation({ summary: 'APISetu health status dashboard' })
  @ApiResponse({ status: 200, description: 'APISetu health monitoring dashboard' })
  getApiSetuHealth(@Res() res: Response) {
    const healthPath = join(process.cwd(), 'public', 'apisetu-health.html');
    return res.sendFile(healthPath);
  }

  @Public()
  @Get('metrics-dashboard')
  @ApiOperation({ summary: 'System metrics dashboard with charts and real-time monitoring' })
  @ApiResponse({ status: 200, description: 'System metrics dashboard page' })
  getMetricsDashboard(@Res() res: Response) {
    const metricsPath = join(process.cwd(), 'public', 'metrics-dashboard.html');
    return res.sendFile(metricsPath);
  }

  @Public()
  @Get('https-redirect')
  @ApiOperation({ summary: 'HTTPS redirect helper for Safari users' })
  @ApiResponse({ status: 200, description: 'HTTPS redirect helper page' })
  getHttpsRedirect(@Res() res: Response) {
    const redirectPath = join(process.cwd(), 'public', 'https-redirect.html');
    return res.sendFile(redirectPath);
  }

  @Public()
  @Get('quick-reference')
  @ApiOperation({ summary: 'Quick reference page with all correct URLs for evaluators' })
  @ApiResponse({ status: 200, description: 'Quick reference page' })
  getQuickReference(@Res() res: Response) {
    const referencePath = join(process.cwd(), 'public', 'quick-reference.html');
    return res.sendFile(referencePath);
  }

  @Public()
  @Get('oauth-integration-guide.html')
  serveOAuthIntegrationGuide(@Res() res: Response) {
    const filePath = path.join(process.cwd(), 'public', 'oauth-integration-guide.html');
    return res.sendFile(filePath);
  }
}
