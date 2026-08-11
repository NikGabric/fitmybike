import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AppModule } from './app.module';
import { buildOpenApiDocument } from './openapi-document';

/**
 * Emits openapi.json without starting a server or touching the database:
 * NestFactory.create() instantiates providers but does not run onModuleInit, so
 * Prisma never connects. The spec can therefore be generated in CI or a Docker
 * build with no Postgres available (DATABASE_URL still has to parse — any
 * placeholder will do).
 *
 * Runs from `dist`, not through tsx: esbuild-based loaders do not emit
 * `emitDecoratorMetadata`, so Nest would resolve every constructor dependency to
 * undefined. The package script builds first for that reason.
 */
async function emit(): Promise<void> {
  // abortOnError:false — otherwise Nest calls process.exit() on a bootstrap failure
  // and the reason is lost, which makes this script impossible to debug.
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn'],
    abortOnError: false,
  });
  app.setGlobalPrefix('api');

  const document = buildOpenApiDocument(app);
  const target = resolve(__dirname, '..', 'openapi.json');
  writeFileSync(target, `${JSON.stringify(document, null, 2)}\n`);

  await app.close().catch(() => undefined);
  process.stdout.write(`OpenAPI document written to ${target}\n`);
}

emit().catch((error: unknown) => {
  process.stderr.write(`Failed to emit OpenAPI document: ${String(error)}\n`);
  process.exit(1);
});
