import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';
import type { Env } from './env';
import { buildOpenApiDocument } from './openapi-document';
import type { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Shared with the integration tests, so they exercise the same app as production.
  configureApp(app);
  app.enableShutdownHooks();

  SwaggerModule.setup('api/docs', app, buildOpenApiDocument(app));

  const config = app.get(ConfigService<Env, true>);
  const port = config.get('PORT', { infer: true });

  await app.listen(port);
  Logger.log(`API listening on http://localhost:${port}/api`, 'Bootstrap');
  Logger.log(`Docs at http://localhost:${port}/api/docs`, 'Bootstrap');
}

void bootstrap();
