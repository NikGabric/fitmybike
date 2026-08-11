import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import type { Env } from './env';
import { buildOpenApiDocument } from './openapi-document';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // Everything lives under /api. In dev the Vite proxy forwards /api here; in prod
  // Caddy does the same. Identical URLs in both, so there is nothing to configure
  // per environment — and deliberately NO enableCors(), because the browser only
  // ever talks to a single origin. Reaching for CORS means the topology broke.
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.enableShutdownHooks();

  SwaggerModule.setup('api/docs', app, buildOpenApiDocument(app));

  const config = app.get(ConfigService<Env, true>);
  const port = config.get('PORT', { infer: true });

  await app.listen(port);
  Logger.log(`API listening on http://localhost:${port}/api`, 'Bootstrap');
  Logger.log(`Docs at http://localhost:${port}/api/docs`, 'Bootstrap');
}

void bootstrap();
