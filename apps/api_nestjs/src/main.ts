import 'reflect-metadata';

import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import { RequestLoggingInterceptor } from './common/interceptors/request-logging.interceptor.js';
import { isOriginAllowed } from './common/security/security.utils.js';
import { AppConfigService } from './config/app-config.service.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true
    })
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new RequestLoggingInterceptor());

  const config = app.get(AppConfigService);
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void
    ) => {
      if (isOriginAllowed(origin, config.corsAllowedOrigins)) {
        callback(null, true);
        return;
      }
      callback(new Error('Origin not allowed by CORS policy'));
    },
    credentials: true
  });

  if (config.sentryDsn.length > 0) {
    Logger.log('Sentry reporting is configured for API runtime', 'Observability');
  }
  if (config.otelEnabled) {
    Logger.log('OpenTelemetry tracing is enabled for API runtime', 'Observability');
  }

  await app.listen(config.port);
  Logger.log(`API started on port ${config.port} in ${config.nodeEnv} mode`, 'Bootstrap');
}

void bootstrap().catch((error: unknown) => {
  Logger.error('API bootstrap failed', error as Error, 'Bootstrap');
  process.exit(1);
});
