import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import {
  httpRequestDurationMicroseconds,
  httpRequestsTotal,
} from './metrics.controller'; // Import metrics from controller

@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const { method, originalUrl } = req;
    // Extract a simplified route, similar to how NestJS does for its router.
    // This is a basic example; more sophisticated route matching might be needed for complex apps.
    // For instance, removing UUIDs or other path parameters to avoid high cardinality.
    const route = originalUrl.split('?')[0]; // Basic route, remove query params

    const end = httpRequestDurationMicroseconds.startTimer();

    res.on('finish', () => {
      const statusCode = res.statusCode;
      // Record metrics
      httpRequestsTotal.inc({ method, route, code: statusCode });
      end({ method, route, code: statusCode });
    });

    next();
  }
}
