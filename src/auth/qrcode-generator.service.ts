import { Injectable, Logger } from '@nestjs/common';
import * as QRCode from 'qrcode';

@Injectable()
export class QRCodeGeneratorService {
  private readonly logger = new Logger(QRCodeGeneratorService.name);

  /**
   * Generate a QR code data URL from a string
   * @param data The data to encode in the QR code
   * @returns Promise that resolves to a data URL string
   */
  async generateQRCode(data: string): Promise<string> {
    try {
      return await QRCode.toDataURL(data);
    } catch (error) {
      this.logger.error(`Failed to generate QR code: ${error.message}`, error.stack);
      throw new Error('Failed to generate QR code');
    }
  }
} 