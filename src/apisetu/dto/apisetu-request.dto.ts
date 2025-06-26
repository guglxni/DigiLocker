import { IsString, IsUrl, IsOptional, IsArray, IsEnum, IsInt, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateDigiLockerRequestDto {
  @ApiProperty({ 
    description: 'Redirect URL where user will be sent after authentication',
    example: 'https://your-app.com/callback'
  })
  @IsString()
  redirectUrl: string;

  @IsOptional()
  @IsString()
  sessionId?: string;
}

export class DigiLockerRequestResponse {
  id: string;
  status: 'unauthenticated' | 'authenticated' | 'revoked';
  url: string;
  validUpto: string;
}

export class DigiLockerStatusResponse {
  id: string;
  status: 'unauthenticated' | 'authenticated' | 'revoked';
  validUpto: string;
  url?: string;
  digilockerUserDetails?: any;
  traceId?: string;
}

// Official APISetu AccessToken Schema
export class AccessTokenOpenId {
  @ApiProperty({ description: 'Access token for API calls', example: 'bc125c212a4d03a9a188a858ba5a163f379e878a' })
  access_token: string;

  @ApiProperty({ description: 'Token expiration time in seconds', example: 3600 })
  expires_in: number;

  @ApiProperty({ description: 'Type of token, always Bearer', example: 'Bearer' })
  token_type: string;

  @ApiProperty({ description: 'Scope of access', example: 'string' })
  scope: string;

  @ApiProperty({ description: 'Refresh token for token renewal', example: 'a47ab3c59370e4f3a27694b74229a3cfcb8f' })
  refresh_token: string;

  @ApiProperty({ description: 'Consent validity timestamp', example: 1737275954 })
  consent_valid_till: number;

  @ApiProperty({ description: 'DigiLocker ID of the user', example: '123e4567-e89b-12d3-a456-426655440000' })
  digilocker_id: string;

  @ApiProperty({ description: 'Name of the user', example: 'Sunil Kumar' })
  name: string;

  @ApiProperty({ description: 'Aadhaar availability', example: 'Y' })
  eaadhaar: string;

  @ApiProperty({ description: 'Date of birth in DDMMYYYY format', example: '31121970' })
  dob: string;

  @ApiProperty({ description: 'Gender (M/F/T)', example: 'M' })
  gender: string;

  @ApiProperty({ description: 'Reference key for the user account', example: '4e8a423ea585b9f4dc5c1d1e94b45c17511b0bcc' })
  reference_key: string;
}

// Official APISetu AccessToken Schema (simplified)
export class AccessToken {
  @ApiProperty({ description: 'Access token for API calls', example: 'bc125c212a4d03a9a188a858ba5a163f379e878a' })
  access_token: string;

  @ApiProperty({ description: 'Token expiration time in seconds', example: 3600 })
  expires_in: number;

  @ApiProperty({ description: 'Type of token, always Bearer', example: 'Bearer' })
  token_type: string;

  @ApiProperty({ description: 'Scope of access', example: 'string' })
  scope: string;

  @ApiProperty({ description: 'Refresh token for token renewal', example: 'a47ab3c59370e4f3a27694b74229a3cfcb8f' })
  refresh_token: string;

  @ApiProperty({ description: 'Consent validity timestamp', example: 1737275954 })
  consent_valid_till: number;

  @ApiProperty({ description: 'DigiLocker ID of the user', example: '123e4567-e89b-12d3-a456-426655440000' })
  digilocker_id: string;

  @ApiProperty({ description: 'Name of the user', example: 'Sunil Kumar' })
  name: string;

  @ApiProperty({ description: 'Aadhaar availability', example: 'Y' })
  eaadhaar: string;

  @ApiProperty({ description: 'Date of birth in DDMMYYYY format', example: '31121970' })
  dob: string;

  @ApiProperty({ description: 'Gender (M/F/T)', example: 'M' })
  gender: string;

  @ApiProperty({ description: 'Reference key for the user account', example: '4e8a423ea585b9f4dc5c1d1e94b45c17511b0bcc' })
  reference_key: string;
}

// Official APISetu AuthTokenResponse Schema
export class AuthTokenResponse {
  @ApiProperty({ description: 'Access token for API calls', example: 'bc125c212a4d03a9a188a858ba5a163f379e878a' })
  access_token: string;

  @ApiProperty({ description: 'Token expiration time in seconds', example: 3600 })
  expires_in: number;

  @ApiProperty({ description: 'Type of token, always Bearer', example: 'Bearer' })
  token_type: string;

  @ApiProperty({ description: 'Scope of access', example: 'string' })
  scope: string;

  @ApiProperty({ description: 'Refresh token for token renewal', example: 'a47ab3c59370e4f3a27694b74229a3cfcb8f' })
  refresh_token: string;

  @ApiProperty({ description: 'Consent validity timestamp', example: 1737275954 })
  consent_valid_till: number;

  @ApiProperty({ description: 'DigiLocker ID of the user', example: '123e4567-e89b-12d3-a456-426655440000' })
  digilocker_id: string;

  @ApiProperty({ description: 'Name of the user', example: 'Sunil Kumar' })
  name: string;

  @ApiProperty({ description: 'Aadhaar availability', example: 'Y' })
  eaadhaar: string;

  @ApiProperty({ description: 'Date of birth in DDMMYYYY format', example: '31121970' })
  dob: string;

  @ApiProperty({ description: 'Gender (M/F/T)', example: 'M' })
  gender: string;

  @ApiProperty({ description: 'Reference key for the user account', example: '4e8a423ea585b9f4dc5c1d1e94b45c17511b0bcc' })
  reference_key: string;
}

// File Upload Schema
export class FileUpload {
  @ApiProperty({ description: 'File content in base64 format' })
  file: string;

  @ApiProperty({ description: 'MIME type of the file', example: 'application/pdf' })
  mimetype: string;

  @ApiProperty({ description: 'Original filename', example: 'document.pdf' })
  filename: string;

  @ApiProperty({ description: 'File size in bytes', example: 1024 })
  size: number;
}

export class DocumentParameter {
  @ApiProperty({ description: 'Parameter name', example: 'aadhaar_id' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Parameter value', example: '123456789012' })
  @IsString()
  value: string;
}

export class FetchDocumentDto {
  @IsString()
  docType: string;

  @IsString()
  orgId: string;

  @IsString()
  format: string;

  @IsString()
  consent: 'Y' | 'N';

  @IsArray()
  parameters: DocumentParameter[];
}

export class DocumentResponse {
  fileUrl: string;
  validUpto: string;
}

export class AadhaarDataResponse {
  aadhaar: {
    address: {
      careOf: string;
      country: string;
      district: string;
      house: string;
      landmark: string;
      locality: string;
      pin: string;
      postOffice: string;
      state: string;
      street: string;
      subDistrict: string;
      vtc: string;
    };
    dateOfBirth: string;
    email: string;
    gender: string;
    generatedAt: string;
    maskedNumber: string;
    name: string;
    phone: string;
    photo: string;
    verified: {
      email: boolean;
      phone: boolean;
      signature: boolean;
    };
    xml: {
      fileUrl: string;
      shareCode: string;
      validUntil: string;
    };
  };
  id: string;
  status: string;
}

export class AvailableDocument {
  availableFormats: string[];
  description: string;
  docType: string;
  orgId: string;
  orgName: string;
  parameters: Array<{
    description: string;
    name: string;
  }>;
}

export class DocumentsListResponse {
  documents: AvailableDocument[];
}

export interface StoredRequest {
  id: string;
  status: 'unauthenticated' | 'authenticated' | 'revoked';
  url: string;
  validUpto: string;
  redirectUrl: string;
  sessionId?: string;
  userDetails?: {
    digilockerId: string;
    email: string;
    phoneNumber: string;
  };
  accessToken?: AccessToken;
  traceId: string;
  createdAt: Date;
} 