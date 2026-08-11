import type { INestApplication } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createCustomer,
  createPrisma,
  createTestApp,
  login,
  seedOrg,
  type SeededOrg,
} from './helpers';

describe('customers', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let orgA: SeededOrg;
  let orgB: SeededOrg;
  let cookieA: string;
  let cookieB: string;

  beforeAll(async () => {
    prisma = createPrisma();
    app = await createTestApp();

    orgA = await seedOrg(prisma, { name: 'Studio A' });
    orgB = await seedOrg(prisma, { name: 'Studio B' });
    cookieA = await login(app, orgA.email);
    cookieB = await login(app, orgB.email);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('tenant isolation', () => {
    it('never lists another organization’s customers', async () => {
      await createCustomer(prisma, orgA, { lastName: 'BelongsToA' });
      await createCustomer(prisma, orgB, { lastName: 'BelongsToB' });

      const response = await request(app.getHttpServer())
        .get('/api/customers')
        .set('Cookie', cookieA)
        .expect(200);

      const names = response.body.data.map((c: { lastName: string }) => c.lastName);
      expect(names).toContain('BelongsToA');
      expect(names).not.toContain('BelongsToB');
    });

    it('returns 404 — not 403 — when reading another organization’s customer', async () => {
      const customer = await createCustomer(prisma, orgA);

      // 404 rather than 403 on purpose: a 403 would confirm the id exists.
      await request(app.getHttpServer())
        .get(`/api/customers/${customer.id}`)
        .set('Cookie', cookieB)
        .expect(404);
    });

    it('refuses to update another organization’s customer and leaves it untouched', async () => {
      const customer = await createCustomer(prisma, orgA, { firstName: 'Original' });

      await request(app.getHttpServer())
        .patch(`/api/customers/${customer.id}`)
        .set('Cookie', cookieB)
        .send({ firstName: 'Hijacked' })
        .expect(404);

      const row = await prisma.customer.findUniqueOrThrow({ where: { id: customer.id } });
      expect(row.firstName).toBe('Original');
    });

    it('refuses to delete another organization’s customer', async () => {
      const customer = await createCustomer(prisma, orgA);

      await request(app.getHttpServer())
        .delete(`/api/customers/${customer.id}`)
        .set('Cookie', cookieB)
        .expect(404);

      const row = await prisma.customer.findUniqueOrThrow({ where: { id: customer.id } });
      expect(row.deletedAt).toBeNull();
    });

    it('stamps the creating organization, ignoring any organizationId in the body', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/customers')
        .set('Cookie', cookieA)
        .send({
          firstName: 'Trying',
          lastName: 'ToEscape',
          organizationId: orgB.organizationId,
        })
        .expect(201);

      const row = await prisma.customer.findUniqueOrThrow({
        where: { id: response.body.id },
      });
      expect(row.organizationId).toBe(orgA.organizationId);
    });
  });

  describe('crud', () => {
    it('creates a customer, normalising blanks to null and coercing numbers', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/customers')
        .set('Cookie', cookieA)
        .send({
          firstName: 'Ana',
          lastName: 'Rider',
          email: '',
          phone: '+385 91 111 2222',
          dateOfBirth: '1990-01-15',
          heightMm: '1750',
          weightGrams: 68_000,
          notes: '',
        })
        .expect(201);

      expect(response.body).toMatchObject({
        firstName: 'Ana',
        email: null,
        notes: null,
        dateOfBirth: '1990-01-15',
        heightMm: 1750,
        weightGrams: 68_000,
      });
    });

    it('lowercases email on the way in', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/customers')
        .set('Cookie', cookieA)
        .send({ firstName: 'Case', lastName: 'Test', email: 'MiXeD@Example.COM' })
        .expect(201);

      expect(response.body.email).toBe('mixed@example.com');
    });

    it('rejects an out-of-range height with a field-keyed error', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/customers')
        .set('Cookie', cookieA)
        .send({ firstName: 'Too', lastName: 'Short', heightMm: 50 })
        .expect(422);

      expect(response.body.code).toBe('VALIDATION_FAILED');
      expect(response.body.details).toHaveProperty('heightMm');
    });

    it('treats an absent key in PATCH as "leave unchanged"', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/customers')
        .set('Cookie', cookieA)
        .send({ firstName: 'Keep', lastName: 'Me', phone: '+385 1 234 567' })
        .expect(201);

      const updated = await request(app.getHttpServer())
        .patch(`/api/customers/${created.body.id}`)
        .set('Cookie', cookieA)
        .send({ firstName: 'Kept' })
        .expect(200);

      expect(updated.body.firstName).toBe('Kept');
      expect(updated.body.phone).toBe('+385 1 234 567');
    });

    it('soft-deletes: the row survives but leaves the list', async () => {
      const customer = await createCustomer(prisma, orgA, { lastName: 'Archived' });

      await request(app.getHttpServer())
        .delete(`/api/customers/${customer.id}`)
        .set('Cookie', cookieA)
        .expect(204);

      await request(app.getHttpServer())
        .get(`/api/customers/${customer.id}`)
        .set('Cookie', cookieA)
        .expect(404);

      const row = await prisma.customer.findUniqueOrThrow({ where: { id: customer.id } });
      expect(row.deletedAt).not.toBeNull();
    });

    it('searches by name, case-insensitively, within the tenant', async () => {
      await createCustomer(prisma, orgA, { firstName: 'Zvonimir', lastName: 'Searchable' });
      await createCustomer(prisma, orgB, { firstName: 'Zvonimir', lastName: 'OtherOrg' });

      const response = await request(app.getHttpServer())
        .get('/api/customers')
        .query({ search: 'zvonimir' })
        .set('Cookie', cookieA)
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].lastName).toBe('Searchable');
    });

    it('paginates', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/customers')
        .query({ page: 1, perPage: 2 })
        .set('Cookie', cookieA)
        .expect(200);

      expect(response.body.data.length).toBeLessThanOrEqual(2);
      expect(response.body.meta).toMatchObject({ page: 1, perPage: 2 });
    });

    it('rejects a perPage above the cap', async () => {
      await request(app.getHttpServer())
        .get('/api/customers')
        .query({ perPage: 5000 })
        .set('Cookie', cookieA)
        .expect(422);
    });
  });
});
