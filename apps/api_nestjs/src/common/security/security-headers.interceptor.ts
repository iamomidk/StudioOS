import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Observable } from 'rxjs';

interface HttpResponseLike {
  setHeader(name: string, value: string): void;
}

@Injectable()
export class SecurityHeadersInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const response = context.switchToHttp().getResponse<HttpResponseLike>();

    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('X-XSS-Protection', '0');
    response.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'"
    );

    return next.handle();
  }
}
