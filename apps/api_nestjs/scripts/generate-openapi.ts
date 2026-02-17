import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import YAML from 'yaml';

import { AppModule } from '../src/app.module.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main(): Promise<void> {
  process.env.NODE_ENV ??= 'test';
  process.env.DATABASE_URL ??= 'postgresql://placeholder:placeholder@localhost:5432/studioos';
  process.env.REDIS_URL ??= 'redis://localhost:6379';
  process.env.JWT_ACCESS_TOKEN_SECRET ??= 'openapi-access-secret-placeholder';
  process.env.JWT_REFRESH_TOKEN_SECRET ??= 'openapi-refresh-secret-placeholder';
  process.env.SKIP_PRISMA_CONNECT = 'true';

  const app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });

  const config = new DocumentBuilder()
    .setTitle('StudioOS API')
    .setDescription('Generated OpenAPI contract for StudioOS API.')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  const targetPath = path.resolve(__dirname, '../../../packages/api_contracts_openapi/openapi.yaml');

  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, YAML.stringify(document), 'utf8');

  await app.close();
  process.stdout.write(`Wrote OpenAPI contract to ${targetPath}\n`);
}

void main().catch((error: unknown) => {
  if (error instanceof Error) {
    process.stderr.write(
      `OpenAPI generation failed: ${error.message}\n${error.stack ?? 'no-stack'}\n`
    );
  } else {
    process.stderr.write(`OpenAPI generation failed: ${JSON.stringify(error)}\n`);
  }
  process.exitCode = 1;
});
