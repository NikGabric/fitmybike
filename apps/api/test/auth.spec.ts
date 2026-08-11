import type { INestApplication } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TEST_PASSWORD, createPrisma, createTestApp, login, seedOrg } from './helpers';

describe('auth', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let email: string;

  beforeAll(async () => {
    prisma = createPrisma();
    app = await createTestApp();
    ({ email } = await seedOrg(prisma, { name: 'Auth Org' }));
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('rejects an unauthenticated request', async () => {
    const response = await request(app.getHttpServer()).get('/api/customers').expect(401);
    expect(response.body).toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('rejects a wrong password', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: 'not-the-password' })
      .expect(401);
  });

  it('gives the same answer for an unknown account as for a wrong password', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'nobody@example.test', password: TEST_PASSWORD })
      .expect(401);

    // No user enumeration: the message must not reveal which half was wrong.
    expect(response.body.message).toBe('Invalid email or password');
  });

  it('issues an httpOnly, SameSite=Lax session cookie on login', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: TEST_PASSWORD })
      .expect(200);

    const cookies = response.headers['set-cookie'] as unknown as string[];
    const session = cookies.find((cookie) => cookie.startsWith('fmb_session='));

    expect(session).toBeDefined();
    expect(session).toContain('HttpOnly');
    expect(session).toContain('SameSite=Lax');
    // Host-only: a Domain attribute would widen the cookie across subdomains.
    expect(session).not.toContain('Domain=');
  });

  it('returns the current user and organization from /auth/me', async () => {
    const cookie = await login(app, email);

    const response = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', cookie)
      .expect(200);

    expect(response.body).toMatchObject({ email, role: 'OWNER' });
    expect(response.body.organization.name).toBe('Auth Org');
    expect(response.body).not.toHaveProperty('passwordHash');
  });

  it('revokes the session on logout', async () => {
    const cookie = await login(app, email);

    await request(app.getHttpServer()).post('/api/auth/logout').set('Cookie', cookie).expect(204);

    // The same cookie must now be worthless — the row is gone, not just expired.
    await request(app.getHttpServer()).get('/api/auth/me').set('Cookie', cookie).expect(401);
  });

  it('rejects a forged session cookie', async () => {
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', 'fmb_session=definitely-not-a-real-token')
      .expect(401);
  });

  it('rejects a session belonging to a deactivated user', async () => {
    const org = await seedOrg(prisma, { name: 'Deactivated Org' });
    const cookie = await login(app, org.email);

    await request(app.getHttpServer()).get('/api/auth/me').set('Cookie', cookie).expect(200);

    await prisma.user.update({
      where: { id: org.userId },
      data: { deactivatedAt: new Date() },
    });

    await request(app.getHttpServer()).get('/api/auth/me').set('Cookie', cookie).expect(401);
  });
});
