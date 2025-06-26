import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import * as crypto from 'crypto';

interface StoredState {
  verifier?: string;
  frontendCallback?: string;
  // Add any other data you want to store with the state
}

// Interface for QR Session Data
export interface QrSessionData {
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'EXPIRED';
  verifier: string; // The PKCE code verifier
  deepLink?: string; // The QR code deep link
  createdAt: number; // Timestamp when the session was created
  accessToken?: string; // The access token received after auth
  refreshToken?: string; // The refresh token received after auth
  idToken?: string; // The ID token received after auth
  accessTokenExpiresAt?: number; // When the access token expires (timestamp)
  expiresIn?: number; // Legacy - Token expiration in seconds
}

@Injectable()
export class RedisStateService {
  private readonly logger = new Logger(RedisStateService.name);
  private readonly ttlSeconds = 600; // 10 minutes in seconds

  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  generatePKCEVerifier(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  generatePKCEChallenge(verifier: string): string {
    return crypto.createHash('sha256').update(verifier).digest('base64url');
  }

  async createState(verifier?: string, frontendCallback?: string): Promise<string> {
    const state = crypto.randomBytes(16).toString('hex');
    const stateData: StoredState = { verifier, frontendCallback };
    try {
      await this.cache.set(state, stateData, this.ttlSeconds * 1000);
      this.logger.log(`Created state ${state} with TTL ${this.ttlSeconds}s${frontendCallback ? ' and frontend callback' : ''}`);
    } catch (error) {
      this.logger.error(
        `Failed to set state in Redis: ${error.message}`,
        error.stack,
      );
      throw error;
    }
    return state;
  }

  async validateState(state: string): Promise<StoredState | null> {
    let data: StoredState | null = null;
    try {
      data = (await this.cache.get<StoredState>(state)) || null;
      if (data) {
        this.logger.log(`Validated state ${state}, deleting.`);
        await this.cache.del(state);
      } else {
        this.logger.warn(`State ${state} not found or expired.`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to validate/delete state from Redis: ${error.message}`,
        error.stack,
      );
      return null;
    }
    return data;
  }

  // --- Methods for QR Session Management ---

  generateRandomString(length: number): string {
    return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
  }

  async storeQrSessionData(sessionId: string, data: QrSessionData, ttlSeconds: number): Promise<void> {
    // Extract the base sessionId if it contains a timestamp (for mock mode)
    const baseSessionId = sessionId.includes('_') ? sessionId.split('_')[0] : sessionId;
    const key = `qr_session:${baseSessionId}`;
    
    try {
      await this.cache.set(key, data, ttlSeconds * 1000);
      this.logger.log(`Stored QR session data for ${baseSessionId} with TTL ${ttlSeconds}s. Status: ${data.status}`);
    } catch (error) {
      this.logger.error(`Failed to set QR session data in Redis for ${baseSessionId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getQrSessionData(sessionId: string): Promise<QrSessionData | null> {
    // Extract the base sessionId if it contains a timestamp (for mock mode)
    const baseSessionId = sessionId.includes('_') ? sessionId.split('_')[0] : sessionId;
    const key = `qr_session:${baseSessionId}`;
    
    let data: QrSessionData | null = null;
    try {
      data = (await this.cache.get<QrSessionData>(key)) || null;
      if (data) {
        this.logger.log(`Retrieved QR session data for ${baseSessionId}. Status: ${data.status}`);
      } else {
        this.logger.warn(`QR session data for ${baseSessionId} not found or expired.`);
      }
    } catch (error) {
      this.logger.error(`Failed to get QR session data from Redis for ${baseSessionId}: ${error.message}`, error.stack);
      return null; // Return null on error to prevent downstream issues
    }
    return data;
  }

  async updateQrSessionData(sessionId: string, updates: Partial<QrSessionData>): Promise<boolean> {
    // Extract the base sessionId if it contains a timestamp (for mock mode)
    const baseSessionId = sessionId.includes('_') ? sessionId.split('_')[0] : sessionId;
    const key = `qr_session:${baseSessionId}`;
    
    try {
      const currentData = await this.cache.get<QrSessionData>(key);
      if (!currentData) {
        this.logger.warn(`Cannot update QR session ${baseSessionId}: session not found or expired.`);
        return false;
      }

      const updatedData = { ...currentData, ...updates };
      await this.cache.set(key, updatedData, 300 * 1000); // Refresh TTL (5 minutes)
      this.logger.log(`Updated QR session ${baseSessionId} - Status: ${updatedData.status}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to update QR session ${baseSessionId}: ${error.message}`, error.stack);
      return false;
    }
  }

  async deleteQrSessionData(sessionId: string): Promise<void> {
    const key = `qr_session:${sessionId}`;
    try {
      await this.cache.del(key);
      this.logger.log(`Deleted QR session data for ${sessionId}.`);
    } catch (error) {
      this.logger.error(`Failed to delete QR session data from Redis for ${sessionId}: ${error.message}`, error.stack);
      // Decide if to throw or just log
    }
  }
}
