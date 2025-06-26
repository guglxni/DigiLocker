import {
  Controller,
  Get,
  Query,
  Req,
  UseGuards,
  Res,
  Logger,
  UnauthorizedException,
  // HttpException, // Unused
  HttpStatus, // Ensure HttpStatus is imported for response codes
  // Post, // Unused
  Body,
} from '@nestjs/common';
import { DigilockerService } from './digilocker.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Request, Response } from 'express';
import { DigiLockerIssuedFilesResponse } from './interfaces/issued-files.interface';
import { StreamableFile } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiCookieAuth, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Digilocker')
@ApiCookieAuth('dl_token')
@Controller('digilocker')
@UseGuards(JwtAuthGuard) // Apply guard to all routes in this controller
export class DigilockerController {
  private readonly logger = new Logger(DigilockerController.name);

  constructor(private readonly digilockerService: DigilockerService) {}

  @Get('files')
  @ApiOperation({ summary: 'Get list of issued files from DigiLocker' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Issued files retrieved successfully', 
    type: DigiLockerIssuedFilesResponse 
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized or missing access token' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Internal server error.' })
  async getIssuedFiles(
    @Req() req: Request,
  ): Promise<DigiLockerIssuedFilesResponse> {
    const user = req.user as { accessToken: string };
    if (!user || !user.accessToken) {
      this.logger.warn('Access token missing in /digilocker/files despite JwtAuthGuard');
      throw new UnauthorizedException('Access token missing from request.');
    }
    this.logger.log(
      `Fetching issued files for user (token: ${user.accessToken.substring(0, 10)}...`,
    );
    return this.digilockerService.getIssuedFiles(user.accessToken);
  }

  @Get('file')
  @ApiOperation({ summary: 'Download a specific file from DigiLocker' })
  @ApiQuery({ name: 'uri', description: 'Unique DigiLocker file URI (e.g., dl:/MORTN/DRIVLIC/XYZ.pdf)', required: true, type: String, example: 'dl:/MORTN/DRIVLIC/XYZ.pdf' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Returns the document file (typically PDF or XML). The Content-Type header will indicate the actual type.',
    content: {
      'application/pdf': {
        schema: { type: 'string', format: 'binary' },
      },
      'application/xml': {
        schema: { type: 'string', format: 'binary' }, // Swagger UI might not render XML well, but this describes it.
      },
      'application/octet-stream': { // Fallback
        schema: { type: 'string', format: 'binary' },
      }
    }
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized or missing access token' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Missing or invalid file URI' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'File not found for the given URI.' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Internal server error.' })
  async downloadFile(
    @Query('uri') uri: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response, // Use passthrough for StreamableFile
  ): Promise<StreamableFile> {
    const user = req.user as { accessToken: string };
    if (!user || !user.accessToken) {
      this.logger.warn('Access token missing in /digilocker/file despite JwtAuthGuard');
      throw new UnauthorizedException('Access token missing from request.');
    }
    if (!uri) {
      this.logger.warn('/digilocker/file called without a URI query parameter.');
      throw new Error('File URI is required as a query parameter.');
    }

    this.logger.log(
      `Request to download file with URI: ${uri} for user (token: ${user.accessToken.substring(0, 10)}...`,
    );
    
    const streamableFile = await this.digilockerService.downloadFile(uri, user.accessToken);
    
    const extension = uri.split('.').pop()?.toLowerCase();
    if (extension === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
    } else if (extension === 'xml') {
      res.setHeader('Content-Type', 'application/xml');
    } else {
      res.setHeader('Content-Type', 'application/octet-stream'); // Default
    }

    return streamableFile;
  }

  // Endpoint to fetch user profile via DigilockerService (already exists in AuthService for /auth/user)
  // This is an alternative if you want a dedicated endpoint under /digilocker scope
  /*
   @Get('profile')
   async getUserProfile(@Req() req: Request) {
     const user = req.user as { accessToken: string };
     if (!user || !user.accessToken) {
       throw new UnauthorizedException('Access token missing from request.');
     }
     this.logger.log(`Fetching DigiLocker profile for user (token: ${user.accessToken.substring(0,10)}...`);
     return this.digilockerService.getUserProfile(user.accessToken);
   }
   */
}
