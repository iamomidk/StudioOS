import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';

interface HttpRequestLike {
  url: string;
}

interface HttpResponseLike {
  status(code: number): HttpResponseLike;
  json(payload: unknown): void;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<HttpRequestLike>();
    const response = ctx.getResponse<HttpResponseLike>();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = isHttpException
      ? exception.getResponse()
      : {
          message: 'Internal server error'
        };

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      error: message
    });
  }
}
