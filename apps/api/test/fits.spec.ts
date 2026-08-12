import type { INestApplication } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createBike,
  createCustomer,
  createFit,
  createPrisma,
  createTestApp,
  login,
  seedOrg,
  type SeededOrg,
} from './helpers';

describe('fits', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let orgA: SeededOrg;
  let orgB: SeededOrg;
  let cookieA: string;
  let cookieB: string;
  let customerA: { id: string };
  let bikeA: { id: string };
  let customerB: { id: string };
  let bikeB: { id: string };

  /** Starts a fit through the API so prefill runs exactly as it does in the app. */
  async function startFit(
    cookie: string,
    customerId: string,
    bikeId: string,
  ): Promise<{ id: string; bodyMeasurements: unknown[]; bikeMeasurements: unknown[] }> {
    const response = await request(app.getHttpServer())
      .post('/api/fits')
      .set('Cookie', cookie)
      .send({ customerId, bikeId })
      .expect(201);
    return response.body;
  }

  beforeAll(async () => {
    prisma = createPrisma();
    app = await createTestApp();

    orgA = await seedOrg(prisma, { name: 'Fit Studio A' });
    orgB = await seedOrg(prisma, { name: 'Fit Studio B' });
    cookieA = await login(app, orgA.email);
    cookieB = await login(app, orgB.email);

    customerA = await createCustomer(prisma, orgA, { lastName: 'RiderA' });
    bikeA = await createBike(prisma, orgA, customerA.id, { brand: 'BikeOfA' });
    customerB = await createCustomer(prisma, orgB, { lastName: 'RiderB' });
    bikeB = await createBike(prisma, orgB, customerB.id, { brand: 'BikeOfB' });
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('tenant isolation', () => {
    it('never lists another organization’s fits', async () => {
      await createFit(prisma, orgA, customerA.id, bikeA.id);
      await createFit(prisma, orgB, customerB.id, bikeB.id);

      const response = await request(app.getHttpServer())
        .get('/api/fits')
        .set('Cookie', cookieA)
        .expect(200);

      const customerIds = response.body.data.map((f: { customerId: string }) => f.customerId);
      expect(customerIds).toContain(customerA.id);
      expect(customerIds).not.toContain(customerB.id);
    });

    it('returns 404 — not 403 — when reading another organization’s fit', async () => {
      const fit = await createFit(prisma, orgA, customerA.id, bikeA.id);

      // 404 rather than 403 on purpose: a 403 would confirm the id exists.
      await request(app.getHttpServer())
        .get(`/api/fits/${fit.id}`)
        .set('Cookie', cookieB)
        .expect(404);
    });

    it('refuses to update another organization’s fit and leaves it untouched', async () => {
      const fit = await createFit(prisma, orgA, customerA.id, bikeA.id);

      await request(app.getHttpServer())
        .patch(`/api/fits/${fit.id}`)
        .set('Cookie', cookieB)
        .send({ summary: 'Hijacked' })
        .expect(404);

      const row = await prisma.fit.findUniqueOrThrow({ where: { id: fit.id } });
      expect(row.summary).toBeNull();
    });

    it('refuses to delete another organization’s fit', async () => {
      const fit = await createFit(prisma, orgA, customerA.id, bikeA.id);

      await request(app.getHttpServer())
        .delete(`/api/fits/${fit.id}`)
        .set('Cookie', cookieB)
        .expect(404);

      const row = await prisma.fit.findUniqueOrThrow({ where: { id: fit.id } });
      expect(row.deletedAt).toBeNull();
    });

    it('stamps the creating organization, ignoring any organizationId in the body', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/fits')
        .set('Cookie', cookieA)
        .send({
          customerId: customerA.id,
          bikeId: bikeA.id,
          organizationId: orgB.organizationId,
        })
        .expect(201);

      const row = await prisma.fit.findUniqueOrThrow({ where: { id: response.body.id } });
      expect(row.organizationId).toBe(orgA.organizationId);
    });

    it('refuses to start a fit on another organization’s customer', async () => {
      await request(app.getHttpServer())
        .post('/api/fits')
        .set('Cookie', cookieA)
        .send({ customerId: customerB.id, bikeId: bikeB.id })
        .expect(404);

      const count = await prisma.fit.count({ where: { customerId: customerB.id } });
      expect(count).toBe(1); // only the one seeded directly in the isolation test above
    });

    it('refuses to start a fit on another organization’s bike', async () => {
      await request(app.getHttpServer())
        .post('/api/fits')
        .set('Cookie', cookieA)
        .send({ customerId: customerA.id, bikeId: bikeB.id })
        .expect(404);
    });

    it('refuses to save measurements onto another organization’s fit', async () => {
      const fit = await createFit(prisma, orgA, customerA.id, bikeA.id);

      await request(app.getHttpServer())
        .patch(`/api/fits/${fit.id}/body-measurements`)
        .set('Cookie', cookieB)
        .send({ measurements: [{ key: 'inseam', value: 800 }] })
        .expect(404);

      const count = await prisma.fitBodyMeasurement.count({ where: { fitId: fit.id } });
      expect(count).toBe(0);
    });

    it('refuses to complete another organization’s fit', async () => {
      const fit = await createFit(prisma, orgA, customerA.id, bikeA.id);

      await request(app.getHttpServer())
        .post(`/api/fits/${fit.id}/complete`)
        .set('Cookie', cookieB)
        .expect(404);

      const row = await prisma.fit.findUniqueOrThrow({ where: { id: fit.id } });
      expect(row.status).toBe('IN_PROGRESS');
    });
  });

  describe('starting a fit', () => {
    it('starts in progress, on the body step, with no measurements', async () => {
      const fit = await startFit(cookieA, customerA.id, bikeA.id);

      expect(fit).toMatchObject({
        status: 'IN_PROGRESS',
        currentStep: 'BODY',
        completedAt: null,
        bodyMeasurements: [],
        bikeMeasurements: [],
      });
    });

    it('includes the customer and bike so the wizard header needs no extra calls', async () => {
      const fit = await startFit(cookieA, customerA.id, bikeA.id);

      expect(fit).toMatchObject({
        customer: { id: customerA.id, lastName: 'RiderA' },
        bike: { id: bikeA.id, brand: 'BikeOfA' },
      });
    });

    it('rejects a bike belonging to a different customer in the same organization', async () => {
      const other = await createCustomer(prisma, orgA, { lastName: 'NotTheOwner' });

      const response = await request(app.getHttpServer())
        .post('/api/fits')
        .set('Cookie', cookieA)
        .send({ customerId: other.id, bikeId: bikeA.id })
        .expect(422);

      expect(response.body.details).toHaveProperty('bikeId');
    });
  });

  describe('measurements', () => {
    it('saves body measurements and reads them back', async () => {
      const fit = await startFit(cookieA, customerA.id, bikeA.id);

      const response = await request(app.getHttpServer())
        .patch(`/api/fits/${fit.id}/body-measurements`)
        .set('Cookie', cookieA)
        .send({
          measurements: [
            { key: 'inseam', value: 820 },
            { key: 'shoulder_width', value: 420, note: 'measured twice' },
          ],
        })
        .expect(200);

      expect(response.body.bodyMeasurements).toHaveLength(2);
      const inseam = response.body.bodyMeasurements.find(
        (m: { key: string }) => m.key === 'inseam',
      );
      expect(inseam).toMatchObject({ value: 820, prefilled: false });
    });

    it('keeps before and after as separate rows for the same measurement', async () => {
      const fit = await startFit(cookieA, customerA.id, bikeA.id);

      await request(app.getHttpServer())
        .patch(`/api/fits/${fit.id}/bike-measurements`)
        .set('Cookie', cookieA)
        .send({ stage: 'BEFORE', measurements: [{ key: 'saddle_height', value: 720 }] })
        .expect(200);

      const response = await request(app.getHttpServer())
        .patch(`/api/fits/${fit.id}/bike-measurements`)
        .set('Cookie', cookieA)
        .send({ stage: 'AFTER', measurements: [{ key: 'saddle_height', value: 735 }] })
        .expect(200);

      const saddle = response.body.bikeMeasurements.filter(
        (m: { key: string }) => m.key === 'saddle_height',
      );
      expect(saddle).toHaveLength(2);
      expect(saddle.find((m: { stage: string }) => m.stage === 'BEFORE').value).toBe(720);
      expect(saddle.find((m: { stage: string }) => m.stage === 'AFTER').value).toBe(735);
    });

    it('updates rather than duplicating when the same stage is saved twice', async () => {
      const fit = await startFit(cookieA, customerA.id, bikeA.id);

      for (const value of [700, 710, 715]) {
        await request(app.getHttpServer())
          .patch(`/api/fits/${fit.id}/bike-measurements`)
          .set('Cookie', cookieA)
          .send({ stage: 'BEFORE', measurements: [{ key: 'saddle_height', value }] })
          .expect(200);
      }

      const rows = await prisma.fitBikeMeasurement.findMany({ where: { fitId: fit.id } });
      expect(rows).toHaveLength(1);
      expect(rows[0]?.value).toBe(715);
    });

    it('treats keys absent from a batch as unchanged', async () => {
      const fit = await startFit(cookieA, customerA.id, bikeA.id);

      await request(app.getHttpServer())
        .patch(`/api/fits/${fit.id}/body-measurements`)
        .set('Cookie', cookieA)
        .send({
          measurements: [
            { key: 'inseam', value: 800 },
            { key: 'arm_length', value: 600 },
          ],
        })
        .expect(200);

      const response = await request(app.getHttpServer())
        .patch(`/api/fits/${fit.id}/body-measurements`)
        .set('Cookie', cookieA)
        .send({ measurements: [{ key: 'inseam', value: 805 }] })
        .expect(200);

      const byKey = new Map(
        response.body.bodyMeasurements.map((m: { key: string; value: number }) => [m.key, m.value]),
      );
      expect(byKey.get('inseam')).toBe(805);
      expect(byKey.get('arm_length')).toBe(600);
    });

    it('removes a measurement when its value is cleared to null', async () => {
      const fit = await startFit(cookieA, customerA.id, bikeA.id);

      await request(app.getHttpServer())
        .patch(`/api/fits/${fit.id}/body-measurements`)
        .set('Cookie', cookieA)
        .send({ measurements: [{ key: 'inseam', value: 800 }] })
        .expect(200);

      const response = await request(app.getHttpServer())
        .patch(`/api/fits/${fit.id}/body-measurements`)
        .set('Cookie', cookieA)
        .send({ measurements: [{ key: 'inseam', value: null }] })
        .expect(200);

      expect(response.body.bodyMeasurements).toHaveLength(0);
    });

    it('rejects a value outside the definition’s range, keyed by measurement', async () => {
      const fit = await startFit(cookieA, customerA.id, bikeA.id);

      const response = await request(app.getHttpServer())
        .patch(`/api/fits/${fit.id}/bike-measurements`)
        .set('Cookie', cookieA)
        // A 3 metre crank. Bounds come from the catalog, not the request schema.
        .send({ stage: 'BEFORE', measurements: [{ key: 'crank_length', value: 3000 }] })
        .expect(422);

      expect(response.body.code).toBe('VALIDATION_FAILED');
      expect(response.body.details).toHaveProperty('crank_length');
    });

    it('refuses a body measurement sent to the bike endpoint', async () => {
      const fit = await startFit(cookieA, customerA.id, bikeA.id);

      const response = await request(app.getHttpServer())
        .patch(`/api/fits/${fit.id}/bike-measurements`)
        .set('Cookie', cookieA)
        .send({ stage: 'BEFORE', measurements: [{ key: 'inseam', value: 800 }] })
        .expect(422);

      expect(response.body.details).toHaveProperty('inseam');
    });

    it('refuses a bike measurement sent to the body endpoint', async () => {
      const fit = await startFit(cookieA, customerA.id, bikeA.id);

      const response = await request(app.getHttpServer())
        .patch(`/api/fits/${fit.id}/body-measurements`)
        .set('Cookie', cookieA)
        .send({ measurements: [{ key: 'saddle_height', value: 720 }] })
        .expect(422);

      expect(response.body.details).toHaveProperty('saddle_height');
    });

    it('reports every problem in a batch at once', async () => {
      const fit = await startFit(cookieA, customerA.id, bikeA.id);

      const response = await request(app.getHttpServer())
        .patch(`/api/fits/${fit.id}/body-measurements`)
        .set('Cookie', cookieA)
        .send({
          measurements: [
            { key: 'inseam', value: 99_999 },
            { key: 'arm_length', value: 99_999 },
          ],
        })
        .expect(422);

      expect(Object.keys(response.body.details).sort()).toEqual(['arm_length', 'inseam']);
    });

    it('writes nothing at all when one measurement in a batch is invalid', async () => {
      const fit = await startFit(cookieA, customerA.id, bikeA.id);

      await request(app.getHttpServer())
        .patch(`/api/fits/${fit.id}/body-measurements`)
        .set('Cookie', cookieA)
        .send({
          measurements: [
            { key: 'inseam', value: 820 },
            { key: 'arm_length', value: 99_999 },
          ],
        })
        .expect(422);

      // The valid half must not have landed — a half-saved screen is worse than none.
      const count = await prisma.fitBodyMeasurement.count({ where: { fitId: fit.id } });
      expect(count).toBe(0);
    });

    /**
     * The wizard flushes on blur as well as on a debounce, so a fitter tabbing
     * through faster than the round trip puts overlapping batches in flight against
     * the same rows. Delete-then-create lost one of them: the second transaction
     * could not see the first's uncommitted insert, deleted nothing, and then died
     * on the unique index — taking every other measurement in its batch with it.
     *
     * The interleaving is timing-dependent, so this fires enough overlapping
     * batches to make it likely rather than certain. It is a regression net, not a
     * proof; the guarantee comes from the endpoint being idempotent.
     */
    it('keeps every value when overlapping batches touch the same measurements', async () => {
      const fit = await startFit(cookieA, customerA.id, bikeA.id);

      const batches = [
        [{ key: 'saddle_height', value: 700 }],
        [
          { key: 'saddle_height', value: 705 },
          { key: 'stem_length', value: 100 },
        ],
        [
          { key: 'saddle_height', value: 710 },
          { key: 'bar_width', value: 400 },
        ],
        [
          { key: 'saddle_height', value: 715 },
          { key: 'spacer_stack', value: 20 },
        ],
        [
          { key: 'stem_length', value: 110 },
          { key: 'bar_width', value: 420 },
        ],
      ];

      const responses = await Promise.all(
        batches.map((measurements) =>
          request(app.getHttpServer())
            .patch(`/api/fits/${fit.id}/bike-measurements`)
            .set('Cookie', cookieA)
            .send({ stage: 'BEFORE', measurements }),
        ),
      );

      // No batch may fail, and none may take an innocent measurement down with it.
      expect(responses.every((r) => r.status === 200)).toBe(true);

      const rows = await prisma.fitBikeMeasurement.findMany({
        where: { fitId: fit.id },
        select: { definition: { select: { key: true } } },
      });

      expect(new Set(rows.map((r) => r.definition.key))).toEqual(
        new Set(['saddle_height', 'stem_length', 'bar_width', 'spacer_stack']),
      );
    });

    it('rejects the same measurement twice in one batch', async () => {
      const fit = await startFit(cookieA, customerA.id, bikeA.id);

      await request(app.getHttpServer())
        .patch(`/api/fits/${fit.id}/body-measurements`)
        .set('Cookie', cookieA)
        .send({
          measurements: [
            { key: 'inseam', value: 800 },
            { key: 'inseam', value: 810 },
          ],
        })
        .expect(422);
    });

    it('rejects an unknown measurement key', async () => {
      const fit = await startFit(cookieA, customerA.id, bikeA.id);

      await request(app.getHttpServer())
        .patch(`/api/fits/${fit.id}/body-measurements`)
        .set('Cookie', cookieA)
        .send({ measurements: [{ key: 'wingspan', value: 800 }] })
        .expect(422);
    });
  });

  describe('lifecycle', () => {
    it('remembers the step the fitter was on', async () => {
      const fit = await startFit(cookieA, customerA.id, bikeA.id);

      await request(app.getHttpServer())
        .patch(`/api/fits/${fit.id}`)
        .set('Cookie', cookieA)
        .send({ currentStep: 'BIKE_AFTER' })
        .expect(200);

      const reopened = await request(app.getHttpServer())
        .get(`/api/fits/${fit.id}`)
        .set('Cookie', cookieA)
        .expect(200);

      expect(reopened.body.currentStep).toBe('BIKE_AFTER');
    });

    it('completes, stamping the time and landing on review', async () => {
      const fit = await startFit(cookieA, customerA.id, bikeA.id);

      const response = await request(app.getHttpServer())
        .post(`/api/fits/${fit.id}/complete`)
        .set('Cookie', cookieA)
        .expect(200);

      expect(response.body).toMatchObject({ status: 'COMPLETED', currentStep: 'REVIEW' });
      expect(response.body.completedAt).not.toBeNull();
    });

    it('keeps a completed fit editable', async () => {
      const fit = await startFit(cookieA, customerA.id, bikeA.id);
      await request(app.getHttpServer())
        .post(`/api/fits/${fit.id}/complete`)
        .set('Cookie', cookieA)
        .expect(200);

      const response = await request(app.getHttpServer())
        .patch(`/api/fits/${fit.id}/body-measurements`)
        .set('Cookie', cookieA)
        .send({ measurements: [{ key: 'inseam', value: 815 }] })
        .expect(200);

      expect(response.body.bodyMeasurements[0]).toMatchObject({ key: 'inseam', value: 815 });
    });

    // Prefill picks its source by completedAt desc, so re-dating a fit from January
    // would quietly make it the seed for the customer's next one.
    it('does not re-date a fit that is completed again after a correction', async () => {
      const fit = await startFit(cookieA, customerA.id, bikeA.id);

      const first = await request(app.getHttpServer())
        .post(`/api/fits/${fit.id}/complete`)
        .set('Cookie', cookieA)
        .expect(200);

      await new Promise((resolve) => setTimeout(resolve, 10));

      const second = await request(app.getHttpServer())
        .post(`/api/fits/${fit.id}/complete`)
        .set('Cookie', cookieA)
        .expect(200);

      expect(second.body.completedAt).toBe(first.body.completedAt);
    });

    it('soft-deletes: the row survives but leaves the list', async () => {
      const fit = await createFit(prisma, orgA, customerA.id, bikeA.id);

      await request(app.getHttpServer())
        .delete(`/api/fits/${fit.id}`)
        .set('Cookie', cookieA)
        .expect(204);

      await request(app.getHttpServer())
        .get(`/api/fits/${fit.id}`)
        .set('Cookie', cookieA)
        .expect(404);

      const row = await prisma.fit.findUniqueOrThrow({ where: { id: fit.id } });
      expect(row.deletedAt).not.toBeNull();
    });

    it('filters by customer', async () => {
      const other = await createCustomer(prisma, orgA, { lastName: 'Unrelated' });
      const otherBike = await createBike(prisma, orgA, other.id);
      await createFit(prisma, orgA, other.id, otherBike.id);

      const response = await request(app.getHttpServer())
        .get('/api/fits')
        .query({ customerId: customerA.id })
        .set('Cookie', cookieA)
        .expect(200);

      const customerIds: string[] = response.body.data.map(
        (f: { customerId: string }) => f.customerId,
      );
      expect(customerIds.every((id) => id === customerA.id)).toBe(true);
    });
  });

  describe('prefill from history', () => {
    it('carries a bike’s delivered values into the next fit as its before values', async () => {
      const customer = await createCustomer(prisma, orgA, { lastName: 'Returning' });
      const bike = await createBike(prisma, orgA, customer.id);

      const first = await startFit(cookieA, customer.id, bike.id);
      await request(app.getHttpServer())
        .patch(`/api/fits/${first.id}/bike-measurements`)
        .set('Cookie', cookieA)
        .send({ stage: 'AFTER', measurements: [{ key: 'saddle_height', value: 742 }] })
        .expect(200);
      await request(app.getHttpServer())
        .post(`/api/fits/${first.id}/complete`)
        .set('Cookie', cookieA)
        .expect(200);

      const second = await startFit(cookieA, customer.id, bike.id);

      const before = (second.bikeMeasurements as Array<{ key: string; stage: string }>).find(
        (m) => m.key === 'saddle_height' && m.stage === 'BEFORE',
      );
      expect(before).toMatchObject({ value: 742, prefilled: true });
    });

    it('carries body values across to a fit on a different bike', async () => {
      const customer = await createCustomer(prisma, orgA, { lastName: 'TwoBikes' });
      const roadBike = await createBike(prisma, orgA, customer.id, { brand: 'Road' });
      const gravelBike = await createBike(prisma, orgA, customer.id, { brand: 'Gravel' });

      const first = await startFit(cookieA, customer.id, roadBike.id);
      await request(app.getHttpServer())
        .patch(`/api/fits/${first.id}/body-measurements`)
        .set('Cookie', cookieA)
        .send({ measurements: [{ key: 'inseam', value: 838 }] })
        .expect(200);
      await request(app.getHttpServer())
        .post(`/api/fits/${first.id}/complete`)
        .set('Cookie', cookieA)
        .expect(200);

      const second = await startFit(cookieA, customer.id, gravelBike.id);

      const inseam = (second.bodyMeasurements as Array<{ key: string }>).find(
        (m) => m.key === 'inseam',
      );
      expect(inseam).toMatchObject({ value: 838, prefilled: true });
      // The bike is a different one, so nothing bike-side should have carried over.
      expect(second.bikeMeasurements).toHaveLength(0);
    });

    it('clears the prefilled flag once the fitter saves over the value', async () => {
      const customer = await createCustomer(prisma, orgA, { lastName: 'Overwrites' });
      const bike = await createBike(prisma, orgA, customer.id);

      const first = await startFit(cookieA, customer.id, bike.id);
      await request(app.getHttpServer())
        .patch(`/api/fits/${first.id}/bike-measurements`)
        .set('Cookie', cookieA)
        .send({ stage: 'AFTER', measurements: [{ key: 'stem_length', value: 100 }] })
        .expect(200);
      await request(app.getHttpServer())
        .post(`/api/fits/${first.id}/complete`)
        .set('Cookie', cookieA)
        .expect(200);

      const second = await startFit(cookieA, customer.id, bike.id);
      const response = await request(app.getHttpServer())
        .patch(`/api/fits/${second.id}/bike-measurements`)
        .set('Cookie', cookieA)
        .send({ stage: 'BEFORE', measurements: [{ key: 'stem_length', value: 90 }] })
        .expect(200);

      const stem = response.body.bikeMeasurements.find(
        (m: { key: string; stage: string }) => m.key === 'stem_length' && m.stage === 'BEFORE',
      );
      expect(stem).toMatchObject({ value: 90, prefilled: false });
    });

    it('does not prefill from an unfinished fit', async () => {
      const customer = await createCustomer(prisma, orgA, { lastName: 'Abandoned' });
      const bike = await createBike(prisma, orgA, customer.id);

      const first = await startFit(cookieA, customer.id, bike.id);
      await request(app.getHttpServer())
        .patch(`/api/fits/${first.id}/bike-measurements`)
        .set('Cookie', cookieA)
        .send({ stage: 'AFTER', measurements: [{ key: 'bar_width', value: 400 }] })
        .expect(200);
      // Deliberately not completed.

      const second = await startFit(cookieA, customer.id, bike.id);
      expect(second.bikeMeasurements).toHaveLength(0);
    });

    it('never prefills across a tenant boundary', async () => {
      // Two organizations, each with a customer and bike carrying the same name. If
      // prefill leaked, org B's new fit would inherit org A's numbers.
      const customerInA = await createCustomer(prisma, orgA, { lastName: 'Shared' });
      const bikeInA = await createBike(prisma, orgA, customerInA.id, { brand: 'Shared' });

      const fitInA = await startFit(cookieA, customerInA.id, bikeInA.id);
      await request(app.getHttpServer())
        .patch(`/api/fits/${fitInA.id}/bike-measurements`)
        .set('Cookie', cookieA)
        .send({ stage: 'AFTER', measurements: [{ key: 'saddle_height', value: 949 }] })
        .expect(200);
      await request(app.getHttpServer())
        .post(`/api/fits/${fitInA.id}/complete`)
        .set('Cookie', cookieA)
        .expect(200);

      const customerInB = await createCustomer(prisma, orgB, { lastName: 'Shared' });
      const bikeInB = await createBike(prisma, orgB, customerInB.id, { brand: 'Shared' });
      const fitInB = await startFit(cookieB, customerInB.id, bikeInB.id);

      expect(fitInB.bikeMeasurements).toHaveLength(0);
    });
  });
});
