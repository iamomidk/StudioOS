import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';

import { AppConfigService } from '../../config/app-config.service.js';

interface HttpRequestLike {
  ip?: string;
  socket?: {
    remoteAddress?: string;
  };
  headers: {
    [key: string]: string | string[] | undefined;
    'x-region-routing-key'?: string;
    'x-region-maintenance-bypass'?: string;
  };
}

interface HttpResponseLike {
  setHeader(name: string, value: string): void;
  status(code: number): HttpResponseLike;
  json(body: unknown): void;
}

@Injectable()
export class RegionRoutingGuard implements CanActivate {
  constructor(@Inject(AppConfigService) private readonly config: AppConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const http = context.switchToHttp();
    const request = http.getRequest<HttpRequestLike>();
    const response = http.getResponse<HttpResponseLike>();

    response.setHeader('X-Serving-Region', this.config.regionId);
    response.setHeader('X-Primary-Region', this.config.primaryRegion);
    response.setHeader('X-Failover-Mode', this.config.failoverMode);

    if (this.config.isRegionInMaintenance(this.config.regionId)) {
      const bypassHeader = this.readHeader(request, 'x-region-maintenance-bypass');
      if (
        !this.config.maintenanceBypassToken ||
        bypassHeader !== this.config.maintenanceBypassToken
      ) {
        response.status(503).json({
          statusCode: 503,
          message: `Region ${this.config.regionId} is in maintenance mode`,
          code: 'REGION_MAINTENANCE'
        });
        return false;
      }
    }

    const routingKey =
      this.readHeader(request, 'x-region-routing-key') ??
      request.ip ??
      request.socket?.remoteAddress ??
      'unknown';

    if (!this.config.shouldServeTraffic(routingKey)) {
      response.status(503).json({
        statusCode: 503,
        message: `Traffic shifted away from ${this.config.regionId}`,
        code: 'REGION_TRAFFIC_SHIFTED',
        failoverMode: this.config.failoverMode
      });
      return false;
    }

    return true;
  }

  private readHeader(request: HttpRequestLike, headerName: string): string | null {
    const value = request.headers[headerName];
    if (Array.isArray(value)) {
      return value[0] ?? null;
    }
    return value ?? null;
  }
}
