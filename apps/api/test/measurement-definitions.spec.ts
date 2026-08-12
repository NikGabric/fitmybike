import type { INestApplication } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import { MEASUREMENT_DEFINITIONS } from '@fitmybike/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrisma, createTestApp, login, seedOrg, type SeededOrg } from './helpers';

describe('measurement definitions', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let org: SeededOrg;
  let cookie: string;

  beforeAll(async () => {
    prisma = createPrisma();
    app = await createTestApp();

    org = await seedOrg(prisma, { name: 'Catalog Studio' });
    cookie = await login(app, org.email);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  // The catalog reaching the test database at all is the point of syncing on boot:
  // global-setup rebuilds it with `prisma db push --force-reset`, which runs neither
  // migrations nor the seed. If this fails, nothing else about fits will work.
  it('syncs the shared catalog into the database when the app boots', async () => {
    const count = await prisma.measurementDefinition.count();
    expect(count).toBe(MEASUREMENT_DEFINITIONS.length);
  });

  it('is idempotent — booting twice does not duplicate rows', async () => {
    const second = await createTestApp();
    await second.close();

    const count = await prisma.measurementDefinition.count();
    expect(count).toBe(MEASUREMENT_DEFINITIONS.length);
  });

  it('returns every definition, ordered by sortOrder', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/measurement-definitions')
      .set('Cookie', cookie)
      .expect(200);

    expect(response.body.data).toHaveLength(MEASUREMENT_DEFINITIONS.length);

    const sortOrders = response.body.data.map((d: { sortOrder: number }) => d.sortOrder);
    expect(sortOrders).toEqual([...sortOrders].sort((a, b) => a - b));
  });

  it('carries the units and bounds through unchanged', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/measurement-definitions')
      .set('Cookie', cookie)
      .expect(200);

    const byKey = new Map(
      response.body.data.map((d: { key: string }) => [d.key, d] as const),
    );

    // Angles are stored as tenths of a degree, so the catalog must say DECIDEGREE —
    // a DEG here would mean values are off by a factor of ten at the display edge.
    expect(byKey.get('saddle_angle')).toMatchObject({
      unit: 'DECIDEGREE',
      category: 'BIKE',
      minValue: -150,
      maxValue: 150,
    });
    expect(byKey.get('inseam')).toMatchObject({ unit: 'MM', category: 'BODY' });
  });

  it('splits into body and bike categories', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/measurement-definitions')
      .set('Cookie', cookie)
      .expect(200);

    const categories = new Set(response.body.data.map((d: { category: string }) => d.category));
    expect(categories).toEqual(new Set(['BODY', 'BIKE']));
  });

  it('is not public — an anonymous request is rejected', async () => {
    await request(app.getHttpServer()).get('/api/measurement-definitions').expect(401);
  });
});
