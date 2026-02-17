import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
  Optional
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Observable, tap } from 'rxjs';

import { MetricsService } from '../modules/metrics/metrics.service.js';

interface HttpRequestLike {
  method: string;
  url: string;
  headers: Record<string, string | string[] | undefined>;
  correlationId?: string;
}

interface HttpResponseLike {
  statusCode: number;
  setHeader(name: string, value: string): void;
}

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RequestLoggingInterceptor.name);
  private readonly metrics: MetricsService;

  constructor(@Optional() metrics?: MetricsService) {
    this.metrics = metrics ?? new MetricsService();
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<HttpRequestLike>();
    const response = context.switchToHttp().getResponse<HttpResponseLike>();
    const headerValue = request.headers['x-correlation-id'];
    const correlationId =
      typeof headerValue === 'string' && headerValue.length > 0 ? headerValue : randomUUID();
    request.correlationId = correlationId;
    response.setHeader('x-correlation-id', correlationId);

    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - start;
        this.metrics.recordRequest(response.statusCode);
        this.logger.log(
          JSON.stringify({
            event: 'http_request',
            correlationId,
            method: request.method,
            url: request.url,
            statusCode: response.statusCode,
            durationMs: duration
          })
        );
      })
    );
  }
}
