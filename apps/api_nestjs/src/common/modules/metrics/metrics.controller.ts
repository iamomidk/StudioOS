import { Controller, Get, Header } from '@nestjs/common';

import { MetricsService } from './metrics.service.js';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4')
  getMetrics(): string {
    const snapshot = this.metrics.snapshot();

    return [
      '# HELP studioos_http_requests_total Total HTTP requests processed.',
      '# TYPE studioos_http_requests_total counter',
      `studioos_http_requests_total ${snapshot.httpRequestsTotal}`,
      '# HELP studioos_http_errors_total Total HTTP requests with status >= 400.',
      '# TYPE studioos_http_errors_total counter',
      `studioos_http_errors_total ${snapshot.httpErrorsTotal}`
    ].join('\n');
  }
}
