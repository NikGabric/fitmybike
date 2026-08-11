import type { INestApplication } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createBike,
  createCustomer,
  createPrisma,
  createTestApp,
  login,
  seedOrg,
  type SeededOrg,
} from './helpers';

describe('bikes', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let orgA: SeededOrg;
  let orgB: SeededOrg;
  let cookieA: string;
  let cookieB: string;
  let customerA: { id: string };
  let customerB: { id: string };

  beforeAll(async () => {
    prisma = createPrisma();
    app = await createTestApp();

    orgA = await seedOrg(prisma, { name: 'Bike Studio A' });
    orgB = await seedOrg(prisma, { name: 'Bike Studio B' });
    cookieA = await login(app, orgA.email);
    cookieB = await login(app, orgB.email);

    customerA = await createCustomer(prisma, orgA, { lastName: 'OwnerA' });
    customerB = await createCustomer(prisma, orgB, { lastName: 'OwnerB' });
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('tenant isolation', () => {
    it('never lists another organization’s bikes', async () => {
      await createBike(prisma, orgA, customerA.id, { brand: 'BelongsToA' });
      await createBike(prisma, orgB, customerB.id, { brand: 'BelongsToB' });

      const response = await request(app.getHttpServer())
        .get(`/api/customers/${customerA.id}/bikes`)
        .set('Cookie', cookieA)
        .expect(200);

      const brands = response.body.data.map((b: { brand: string }) => b.brand);
      expect(brands).toContain('BelongsToA');
      expect(brands).not.toContain('BelongsToB');
    });

    it('returns 404 — not 403 — when reading another organization’s bike', async () => {
      const bike = await createBike(prisma, orgA, customerA.id);

      // 404 rather than 403 on purpose: a 403 would confirm the id exists.
      await request(app.getHttpServer())
        .get(`/api/bikes/${bike.id}`)
        .set('Cookie', cookieB)
        .expect(404);
    });

    it('refuses to update another organization’s bike and leaves it untouched', async () => {
      const bike = await createBike(prisma, orgA, customerA.id, { brand: 'Original' });

      await request(app.getHttpServer())
        .patch(`/api/bikes/${bike.id}`)
        .set('Cookie', cookieB)
        .send({ brand: 'Hijacked' })
        .expect(404);

      const row = await prisma.bike.findUniqueOrThrow({ where: { id: bike.id } });
      expect(row.brand).toBe('Original');
    });

    it('refuses to delete another organization’s bike', async () => {
      const bike = await createBike(prisma, orgA, customerA.id);

      await request(app.getHttpServer())
        .delete(`/api/bikes/${bike.id}`)
        .set('Cookie', cookieB)
        .expect(404);

      const row = await prisma.bike.findUniqueOrThrow({ where: { id: bike.id } });
      expect(row.deletedAt).toBeNull();
    });

    it('stamps the creating organization, ignoring any organizationId in the body', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/customers/${customerA.id}/bikes`)
        .set('Cookie', cookieA)
        .send({ brand: 'Trying', model: 'ToEscape', organizationId: orgB.organizationId })
        .expect(201);

      const row = await prisma.bike.findUniqueOrThrow({ where: { id: response.body.id } });
      expect(row.organizationId).toBe(orgA.organizationId);
    });

    // The nested route is the one that could leak: customerId arrives from the path.
    it('refuses to create a bike under another organization’s customer', async () => {
      await request(app.getHttpServer())
        .post(`/api/customers/${customerB.id}/bikes`)
        .set('Cookie', cookieA)
        .send({ brand: 'Sneaky' })
        .expect(404);

      const count = await prisma.bike.count({ where: { customerId: customerB.id, brand: 'Sneaky' } });
      expect(count).toBe(0);
    });

    it('refuses to list bikes under another organization’s customer', async () => {
      await request(app.getHttpServer())
        .get(`/api/customers/${customerB.id}/bikes`)
        .set('Cookie', cookieA)
        .expect(404);
    });
  });

  describe('crud', () => {
    it('creates a bike, defaulting the type and normalising blanks to null', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/customers/${customerA.id}/bikes`)
        .set('Cookie', cookieA)
        .send({ brand: 'Canyon', model: 'Ultimate CF SL', sizeLabel: '', notes: '' })
        .expect(201);

      expect(response.body).toMatchObject({
        brand: 'Canyon',
        model: 'Ultimate CF SL',
        sizeLabel: null,
        notes: null,
        type: 'ROAD',
        customerId: customerA.id,
      });
    });

    it('accepts a bike with no identifying details at all', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/customers/${customerA.id}/bikes`)
        .set('Cookie', cookieA)
        .send({ type: 'GRAVEL' })
        .expect(201);

      expect(response.body).toMatchObject({ brand: null, model: null, type: 'GRAVEL' });
    });

    it('rejects an unknown bike type with a field-keyed error', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/customers/${customerA.id}/bikes`)
        .set('Cookie', cookieA)
        .send({ type: 'PENNY_FARTHING' })
        .expect(422);

      expect(response.body.code).toBe('VALIDATION_FAILED');
      expect(response.body.details).toHaveProperty('type');
    });

    it('treats an absent key in PATCH as "leave unchanged"', async () => {
      const created = await request(app.getHttpServer())
        .post(`/api/customers/${customerA.id}/bikes`)
        .set('Cookie', cookieA)
        .send({ brand: 'Keep', model: 'Me', sizeLabel: '56' })
        .expect(201);

      const updated = await request(app.getHttpServer())
        .patch(`/api/bikes/${created.body.id}`)
        .set('Cookie', cookieA)
        .send({ brand: 'Kept' })
        .expect(200);

      expect(updated.body.brand).toBe('Kept');
      expect(updated.body.sizeLabel).toBe('56');
      expect(updated.body.model).toBe('Me');
    });

    it('soft-deletes: the row survives but leaves the list', async () => {
      const bike = await createBike(prisma, orgA, customerA.id, { brand: 'Archived' });

      await request(app.getHttpServer())
        .delete(`/api/bikes/${bike.id}`)
        .set('Cookie', cookieA)
        .expect(204);

      await request(app.getHttpServer())
        .get(`/api/bikes/${bike.id}`)
        .set('Cookie', cookieA)
        .expect(404);

      const row = await prisma.bike.findUniqueOrThrow({ where: { id: bike.id } });
      expect(row.deletedAt).not.toBeNull();
    });

    it('lists only the requested customer’s bikes, not the whole studio’s', async () => {
      const other = await createCustomer(prisma, orgA, { lastName: 'SomeoneElse' });
      await createBike(prisma, orgA, other.id, { brand: 'TheirBike' });

      const response = await request(app.getHttpServer())
        .get(`/api/customers/${customerA.id}/bikes`)
        .set('Cookie', cookieA)
        .expect(200);

      const brands = response.body.data.map((b: { brand: string }) => b.brand);
      expect(brands).not.toContain('TheirBike');
    });
  });
});
