import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';

/**
 * Shared by the served Swagger UI and the `pnpm openapi` emitter, so the docs a
 * developer reads and the types the web app compiles against can never diverge.
 *
 * cleanupOpenApiDoc is nestjs-zod v5's replacement for the old patchNestJsSwagger():
 * it rewrites the Zod-derived schemas into plain OpenAPI after the document is built.
 */
export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Fit My Bike API')
    .setDescription('Bike fitting studio management. All endpoints are scoped to the caller’s organization.')
    .setVersion('0.0.0')
    .addCookieAuth('fmb_session', { type: 'apiKey', in: 'cookie', name: 'fmb_session' })
    .build();

  return cleanupOpenApiDoc(SwaggerModule.createDocument(app, config));
}
