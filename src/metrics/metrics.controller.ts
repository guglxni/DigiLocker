import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import {
  register,
  collectDefaultMetrics,
  Counter,
  Histogram,
} from 'prom-client';

// Optional: Collect default metrics
collectDefaultMetrics({ prefix: 'nestjs_app_' });

// Example custom metrics (can be expanded based on needs)
export const httpRequestDurationMicroseconds = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10], // Buckets in seconds
});

export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'code'],
});

// You can add more custom metrics here, e.g., a Gauge for active connections
// export const activeConnections = new Gauge({
//   name: 'active_connections',
//   help: 'Number of active connections',
// });

@Controller('metrics')
export class MetricsController {
  @Get()
  async getMetrics(@Res() res: Response) {
    res.header('Content-Type', register.contentType);
    res.send(await register.metrics());
  }
}
