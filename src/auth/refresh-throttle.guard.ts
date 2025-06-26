import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express'; // Import Request type from express

@Injectable()
export class RefreshThrottleGuard extends ThrottlerGuard {
  protected async getTracker(req: any): Promise<string> {
    // Ensure req.cookies is available. If using Fastify, req.cookies might not be populated by default.
    // Assuming Express, where cookie-parser middleware would populate req.cookies.
    const expressReq = req as Request;
    const refreshTokenCookieName =
      process.env.DIGILOCKER_COOKIE_REFRESH_TOKEN_NAME || 'dl_rtoken';

    if (expressReq.cookies && expressReq.cookies[refreshTokenCookieName]) {
      // Using only a part of the token for privacy/length if necessary, but full token is more unique.
      // For now, using the full cookie value as the tracker.
      return expressReq.cookies[refreshTokenCookieName];
    }
    // Fallback to IP address if the refresh token cookie is not present
    // The default ThrottlerGuard uses req.ip or req.ips[0]
    return super.getTracker(req);
  }

  // Override other methods if needed, e.g., generateKey, but getTracker is usually sufficient for custom tracking.
}
