import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class MockDataService {
  private readonly logger = new Logger(MockDataService.name);

  constructor(private readonly configService: ConfigService) {}

  getMockTokenResponse(): any {
    this.logger.log('Generating mock token response');
    const jwtSecret =
      this.configService.get<string>('jwtSecret') || 'default-mock-jwt-secret';
    // Ensure jwtSecret is always a string for jwt.sign
    if (!jwtSecret) {
      this.logger.error(
        'JWT_SECRET for mock token generation is undefined and no default was provided. This should not happen.',
      );
      // Fallback to a hardcoded secret if absolutely necessary, though config should be fixed
      // This part is mostly for preventing a crash during tests if config is misconfigured.
      // In a real scenario, better to throw or have a guaranteed default from ConfigService.
      throw new Error('Mock JWT secret is not available.');
    }
    const mockAccessToken = jwt.sign(
      { user_id: 'mock_user_123', scope: 'read:profile' },
      jwtSecret,
      { expiresIn: '1h' },
    );

    return {
      access_token: mockAccessToken, // Using the generated JWT
      token_type: 'Bearer',
      expires_in: 3600, // 1 hour in seconds
      refresh_token: 'MOCK_REFRESH_TOKEN_XYZ123ABC',
      scope: 'read:profile',
    };
  }

  // Add missing methods required by auth.service.ts
  getTokens() {
    this.logger.log('Getting mock tokens');
    return this.getMockTokenResponse();
  }

  getUserInfo(accessToken: string) {
    this.logger.log(`Getting mock user info with token: ${accessToken.substring(0, 10)}...`);
    return this.getMockUserProfile();
  }

  // Add alias for consistency with auth.service.ts
  getMockUserInfo(): any {
    return this.getMockUserProfile();
  }

  getMockUserProfile(): any {
    this.logger.log('Returning mock user profile');
    return {
      sub: 'mock_user_123',
      name: 'Mock User',
      email: 'mock.user@example.com',
      dob: '1990-01-01',
      gender: 'Male',
      digilockerid: 'DLmock12345',
      eaadhaar: 'Y',
    };
  }

  getMockIssuedDocuments(): any {
    this.logger.log('Returning mock issued documents');
    return {
      items: [
        {
          name: 'Mock Driving License',
          type: 'Driving License',
          size: '12345',
          date: '01-01-2023',
          mime: 'application/pdf',
          uri: 'dl:/mock/driving_license.pdf',
        },
        {
          name: 'Mock PAN Card',
          type: 'PAN Card',
          size: '67890',
          date: '02-02-2022',
          mime: 'application/pdf',
          uri: 'dl:/mock/pan_card.pdf',
        },
        {
          name: 'Mock Aadhaar Card',
          type: 'Aadhaar Card',
          size: '123456',
          date: '03-03-2021',
          mime: 'application/xml',
          uri: 'dl:/mock/aadhaar.xml',
        },
      ],
      dob: '1990-01-01',
      gender: 'M',
      name: 'Mock User',
    };
  }

  getMockFileBuffer(uri?: string): Buffer {
    this.logger.log(`Returning mock file buffer for URI: ${uri || 'generic'}`);
    let content = '';
    const fileName = uri || 'file';

    if (uri && uri.endsWith('.xml')) {
      content = `<mockDocument uri="${uri}"><content>This is a mock XML document for ${fileName}.</content></mockDocument>`;
    } else {
      // Simplified, valid PDF string for mock purposes.
      // Using a template literal for easier multi-line string handling and escaping.
      content = `%PDF-1.4\n%%äüöß\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 58 >>\nstream\nBT\n/F1 12 Tf\n72 712 Td\n(Mock PDF Content for: ${fileName}) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000018 00000 n \n0000000077 00000 n \n0000000131 00000 n \n0000000230 00000 n \ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n300\n%%EOF`;
    }
    return Buffer.from(content);
  }
}
