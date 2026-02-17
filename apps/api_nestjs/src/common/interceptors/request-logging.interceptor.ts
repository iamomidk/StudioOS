import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';

interface HttpRequestLike {
  method: string;
  url: string;
}

interface HttpResponseLike {
  statusCode: number;
}

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RequestLoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<HttpRequestLike>();
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        const response = context.switchToHttp().getResponse<HttpResponseLike>();
        const duration = Date.now() - start;
        this.logger.log(
          `${request.method} ${request.url} ${response.statusCode} - ${duration}ms`
        );
      })
    );
  }
}
