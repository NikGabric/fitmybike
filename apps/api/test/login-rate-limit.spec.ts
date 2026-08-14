import type { INestApplication } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, it } from 'vitest';
import { TEST_PASSWORD, createPrisma, createTestApp, seedOrg } from './helpers';

/**
 * Its own spec file rather than a block in auth.spec.ts: the throttler's storage lives
 * with the app instance, and these tests deliberately exhaust a budget. Sharing an app
 * with the other auth tests would make their results depend on execution order.
 */
describe('login rate limit', () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = createPrisma();
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('refuses a sixth attempt from the same address within the window', async () => {
    const org = await seedOrg(prisma, { name: 'Throttle Org' });
    // The header shape production produces: Caddy appends the client, nginx appends Caddy.
    const client = '198.51.100.9, 10.0.0.5';

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .set('X-Forwarded-For', client)
        .send({ email: org.email, password: 'wrong-password' })
        .expect(401);
    }

    // The *correct* password, and still refused — the limit counts attempts, not
    // failures, so a guessed password on the sixth try does not get in either.
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('X-Forwarded-For', client)
      .send({ email: org.email, password: TEST_PASSWORD })
      .expect(429);
  });

  // Guards the thing that makes `trust proxy` load-bearing. Every request arrives from
  // the same socket — the nginx container in production, loopback here — so if the
  // throttler keyed on that instead of the forwarded address, one attacker would lock
  // out every user of the app. This test fails if that regresses.
  it('counts each client address separately', async () => {
    const org = await seedOrg(prisma, { name: 'Separate Budgets Org' });

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .set('X-Forwarded-For', '198.51.100.20, 10.0.0.5')
        .send({ email: org.email, password: 'wrong-password' })
        .expect(401);
    }

    // A different client, arriving over the same proxies, still has its full budget.
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('X-Forwarded-For', '198.51.100.21, 10.0.0.5')
      .send({ email: org.email, password: TEST_PASSWORD })
      .expect(200);
  });
});
