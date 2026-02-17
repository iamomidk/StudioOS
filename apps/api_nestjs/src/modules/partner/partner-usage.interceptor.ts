import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';

import { PartnerService } from './partner.service.js';
import type { PartnerAuthenticatedRequest } from './auth/partner-api-key.guard.js';

@Injectable()
export class PartnerUsageInterceptor implements NestInterceptor {
  constructor(private readonly partnerService: PartnerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context
      .switchToHttp()
      .getRequest<
        PartnerAuthenticatedRequest & { method: string; originalUrl?: string; path?: string }
      >();
    const response = context.switchToHttp().getResponse<{
      statusCode: number;
      setHeader: (name: string, value: string) => void;
    }>();
    const startedAt = Date.now();
    response.setHeader('x-partner-api-version', 'v1');
    response.setHeader('x-partner-api-deprecation-policy', '/docs/api/partner-v1.md');

    return next.handle().pipe(
      finalize(() => {
        const partner = request.partner;
        if (!partner) {
          return;
        }

        void this.partnerService
          .recordUsage(
            partner.credentialId,
            partner.organizationId,
            request.method,
            request.originalUrl ?? request.path ?? 'unknown',
            response.statusCode,
            Date.now() - startedAt
          )
          .catch(() => undefined);
      })
    );
  }
}
