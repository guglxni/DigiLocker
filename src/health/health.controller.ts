import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Health Checks')
@Controller()
export class HealthController {
  @Get('ready')
  @ApiOperation({
    summary: 'Readiness probe',
    description: 'Checks if the service is ready to accept traffic.',
  })
  ready() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('health')
  @ApiOperation({
    summary: 'Liveness probe',
    description: 'Checks if the service is alive.',
  })
  health() {
    return { status: 'up', timestamp: new Date().toISOString() };
  }
}
