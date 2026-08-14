import cookieParser from 'cookie-parser';
import type { NestExpressApplication } from '@nestjs/platform-express';

/**
 * Everything the app needs beyond its modules, in one place.
 *
 * Both `main.ts` and the integration tests call this. They used to configure the app
 * separately, which meant a setting could be added to one and silently missed by the
 * other — the tests would then pass against an app that production never runs.
 */
export function configureApp(app: NestExpressApplication): void {
  // Everything lives under /api. In dev the Vite proxy forwards /api here; in prod
  // Caddy does the same. Identical URLs in both, so there is nothing to configure
  // per environment — and deliberately NO enableCors(), because the browser only
  // ever talks to a single origin. Reaching for CORS means the topology broke.
  app.setGlobalPrefix('api');
  app.use(cookieParser());

  // Two proxies sit in front of the API in production: Caddy terminates TLS and
  // forwards to nginx, which forwards here. The socket address is therefore always
  // the nginx container, and the client's address survives only in X-Forwarded-For —
  // which Express ignores entirely until it is told how many hops to trust.
  //
  // A hop count, never `true`. Trusting the whole chain would let a client forge its
  // own address by sending a crafted X-Forwarded-For, which matters because this
  // value is what any per-IP rate limiting has to key on.
  app.set('trust proxy', 2);
}
