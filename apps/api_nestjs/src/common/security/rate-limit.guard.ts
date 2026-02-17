import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';

import { AppConfigService } from '../../config/app-config.service.js';
import { MemoryRateLimiter } from './security.utils.js';

interface HttpRequestLike {
  ip?: string;
  socket?: {
    remoteAddress?: string;
  };
}

interface HttpResponseLike {
  setHeader(name: string, value: string): void;
  status(code: number): HttpResponseLike;
  json(body: unknown): void;
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly limiter: MemoryRateLimiter;

  constructor(@Inject(AppConfigService) private readonly config: AppConfigService) {
    this.limiter = new MemoryRateLimiter(
      this.config.rateLimitMaxRequests,
      this.config.rateLimitTtlSeconds
    );
  }

  canActivate(context: ExecutionContext): boolean {
    const http = context.switchToHttp();
    const request = http.getRequest<HttpRequestLike>();
    const response = http.getResponse<HttpResponseLike>();

    const key = request.ip ?? request.socket?.remoteAddress ?? 'unknown';
    const decision = this.limiter.check(key);

    response.setHeader('X-RateLimit-Limit', String(this.config.rateLimitMaxRequests));
    response.setHeader('X-RateLimit-Remaining', decision.allowed ? '1' : '0');
    response.setHeader('Retry-After', String(decision.retryAfterSeconds));

    if (!decision.allowed) {
      response.status(429).json({
        statusCode: 429,
        message: 'Too many requests',
        error: 'Too Many Requests'
      });
      return false;
    }

    return true;
  }
}
