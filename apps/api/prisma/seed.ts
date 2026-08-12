import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type Prisma } from '@prisma/client';
import { MEASUREMENT_DEFINITIONS } from '@fitmybike/shared';
import * as argon2 from 'argon2';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: ['../../.env', '.env'], quiet: true });

const DEFAULT_PASSWORD = 'changeme123';

const connectionString = process.env['DATABASE_URL'];
if (!connectionString) throw new Error('DATABASE_URL is not set');

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

/**
 * Deliberately seeds TWO organizations. Multi-tenant bugs hide when there is only
 * one tenant to look at — with a second org present, a leak is visible the moment
 * you log in as either owner.
 */
const ORGS = [
  {
    name: 'Fit My Bike Studio',
    slug: 'fit-my-bike-studio',
    owner: { email: 'owner@fitmybike.test', name: 'Ana Kovač' },
    fitter: { email: 'fitter@fitmybike.test', name: 'Luka Novak' },
    customers: [
      { firstName: 'Marko', lastName: 'Horvat', email: 'marko.horvat@example.com', phone: '+385 91 234 5678', dateOfBirth: '1988-04-12', heightMm: 1810, weightGrams: 78_500, notes: 'Long-distance rider. Reports numbness in left hand after 3h.' },
      { firstName: 'Petra', lastName: 'Babić', email: 'petra.babic@example.com', phone: '+385 98 111 2222', dateOfBirth: '1994-09-02', heightMm: 1685, weightGrams: 61_000, notes: 'New TT bike, first fit.' },
      { firstName: 'Ivan', lastName: 'Perić', email: 'ivan.peric@example.com', phone: null, dateOfBirth: '1979-01-25', heightMm: 1755, weightGrams: 84_200, notes: 'Previous knee surgery, right leg.' },
      { firstName: 'Sara', lastName: 'Vuković', email: null, phone: '+385 95 777 8888', dateOfBirth: '2001-06-30', heightMm: 1620, weightGrams: 55_800, notes: null },
      { firstName: 'Tomislav', lastName: 'Jurić', email: 'tomislav.juric@example.com', phone: null, dateOfBirth: null, heightMm: 1890, weightGrams: 91_000, notes: 'Very tall; standard stem length insufficient.' },
      { firstName: 'Maja', lastName: 'Šimić', email: 'maja.simic@example.com', phone: '+385 92 333 4444', dateOfBirth: '1991-11-17', heightMm: 1702, weightGrams: 64_300, notes: 'Gravel setup. Wants a more upright position.' },
    ],
  },
  {
    name: 'Alpine Bike Lab',
    slug: 'alpine-bike-lab',
    owner: { email: 'owner@alpinelab.test', name: 'Nina Zupan' },
    fitter: null,
    customers: [
      { firstName: 'Klara', lastName: 'Oblak', email: 'klara.oblak@example.com', phone: null, dateOfBirth: '1985-03-08', heightMm: 1660, weightGrams: 58_900, notes: 'Belongs to the OTHER organization — must never appear in Fit My Bike Studio.' },
    ],
  },
] as const;

/**
 * A fit that has already happened, so the app has history to show on a fresh
 * install: what the bike arrived at, and what it left at.
 */
const DEMO_BODY = {
  inseam: 850,
  torso_length: 600,
  arm_length: 655,
  shoulder_width: 430,
  foot_length: 275,
  sternal_notch_height: 1480,
  forward_flexion: 750,
} as const;

const DEMO_BIKE: Record<string, { before: number; after: number }> = {
  saddle_height: { before: 720, after: 735 },
  saddle_setback: { before: 65, after: 55 },
  saddle_angle: { before: 0, after: -15 },
  saddle_nose_to_bar: { before: 520, after: 530 },
  saddle_to_bar_drop: { before: 60, after: 45 },
  stem_length: { before: 100, after: 110 },
  spacer_stack: { before: 20, after: 10 },
  bar_width: { before: 420, after: 420 },
  crank_length: { before: 1725, after: 1725 },
};

/**
 * The catalog normally syncs when the API boots. The seed runs standalone, so it
 * mirrors the same shared array — otherwise `db:seed` on a fresh database would have
 * no definitions to hang its demo fit off.
 */
async function seedCatalog(): Promise<Map<string, string>> {
  for (const definition of MEASUREMENT_DEFINITIONS) {
    const fields = {
      label: definition.label,
      category: definition.category,
      unit: definition.unit,
      minValue: definition.minValue,
      maxValue: definition.maxValue,
      helpText: 'helpText' in definition ? definition.helpText : null,
      sortOrder: definition.sortOrder,
      retiredAt: null,
    };
    await prisma.measurementDefinition.upsert({
      where: { key: definition.key },
      update: fields,
      create: { key: definition.key, ...fields },
    });
  }

  const rows = await prisma.measurementDefinition.findMany({ select: { id: true, key: true } });
  return new Map(rows.map((row) => [row.key, row.id]));
}

async function seedFits(
  organizationId: string,
  ownerId: string,
  customerId: string,
  definitionIds: Map<string, string>,
): Promise<void> {
  const existing = await prisma.bike.findFirst({ where: { customerId }, select: { id: true } });
  if (existing) return;

  const roadBike = await prisma.bike.create({
    data: {
      organizationId,
      customerId,
      createdById: ownerId,
      brand: 'Canyon',
      model: 'Ultimate CF SL',
      sizeLabel: '56',
      type: 'ROAD',
      notes: 'Shimano 105, 172.5 cranks.',
    },
  });

  await prisma.bike.create({
    data: {
      organizationId,
      customerId,
      createdById: ownerId,
      brand: 'Open',
      model: 'U.P.',
      sizeLabel: 'L',
      type: 'GRAVEL',
    },
  });

  const completedAt = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  await prisma.fit.create({
    data: {
      organizationId,
      customerId,
      bikeId: roadBike.id,
      createdById: ownerId,
      status: 'COMPLETED',
      currentStep: 'REVIEW',
      reason: 'Numbness in left hand after three hours.',
      summary:
        'Raised the saddle 15mm and shortened the effective reach by dropping a spacer and levelling the saddle. Revisit in three months.',
      startedAt: completedAt,
      completedAt,
      bodyMeasurements: {
        create: Object.entries(DEMO_BODY).flatMap(([key, value]) => {
          const definitionId = definitionIds.get(key);
          return definitionId ? [{ organizationId, definitionId, value }] : [];
        }),
      },
      bikeMeasurements: {
        create: Object.entries(DEMO_BIKE).flatMap(([key, { before, after }]) => {
          const definitionId = definitionIds.get(key);
          if (!definitionId) return [];
          return [
            { organizationId, definitionId, stage: 'BEFORE' as const, value: before },
            { organizationId, definitionId, stage: 'AFTER' as const, value: after },
          ];
        }),
      },
    },
  });

  // A second, unfinished fit so there is something to land mid-wizard on.
  await prisma.fit.create({
    data: {
      organizationId,
      customerId,
      bikeId: roadBike.id,
      createdById: ownerId,
      status: 'IN_PROGRESS',
      currentStep: 'BIKE_BEFORE',
      reason: 'Follow-up after new shoes.',
      bodyMeasurements: {
        create: Object.entries(DEMO_BODY).flatMap(([key, value]) => {
          const definitionId = definitionIds.get(key);
          return definitionId ? [{ organizationId, definitionId, value, prefilled: true }] : [];
        }),
      },
      bikeMeasurements: {
        create: Object.entries(DEMO_BIKE).flatMap(([key, { after }]) => {
          const definitionId = definitionIds.get(key);
          return definitionId
            ? [{ organizationId, definitionId, stage: 'BEFORE' as const, value: after, prefilled: true }]
            : [];
        }),
      },
    },
  });
}

async function main(): Promise<void> {
  const passwordHash = await argon2.hash(DEFAULT_PASSWORD, { type: argon2.argon2id });
  const definitionIds = await seedCatalog();

  for (const org of ORGS) {
    const organization = await prisma.organization.upsert({
      where: { slug: org.slug },
      update: { name: org.name },
      create: { name: org.name, slug: org.slug },
    });

    const owner = await prisma.user.upsert({
      where: { email: org.owner.email },
      update: { name: org.owner.name, role: 'OWNER', organizationId: organization.id },
      create: {
        email: org.owner.email,
        name: org.owner.name,
        role: 'OWNER',
        passwordHash,
        organizationId: organization.id,
      },
    });

    if (org.fitter) {
      await prisma.user.upsert({
        where: { email: org.fitter.email },
        update: { name: org.fitter.name, role: 'FITTER', organizationId: organization.id },
        create: {
          email: org.fitter.email,
          name: org.fitter.name,
          role: 'FITTER',
          passwordHash,
          organizationId: organization.id,
        },
      });
    }

    for (const customer of org.customers) {
      const existing = await prisma.customer.findFirst({
        where: {
          organizationId: organization.id,
          firstName: customer.firstName,
          lastName: customer.lastName,
        },
        select: { id: true },
      });
      if (existing) continue;

      const data: Prisma.CustomerUncheckedCreateInput = {
        organizationId: organization.id,
        createdById: owner.id,
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email,
        phone: customer.phone,
        dateOfBirth: customer.dateOfBirth ? new Date(`${customer.dateOfBirth}T00:00:00.000Z`) : null,
        heightMm: customer.heightMm,
        weightGrams: customer.weightGrams,
        notes: customer.notes,
      };
      await prisma.customer.create({ data });
    }

    // The first customer of each organization gets bikes and fit history. Both orgs
    // get them on purpose: a tenant leak in the fits module is only visible when
    // there is a second studio's fit to leak.
    const firstCustomer = org.customers[0];
    if (firstCustomer) {
      const customer = await prisma.customer.findFirst({
        where: {
          organizationId: organization.id,
          firstName: firstCustomer.firstName,
          lastName: firstCustomer.lastName,
        },
        select: { id: true },
      });
      if (customer) {
        await seedFits(organization.id, owner.id, customer.id, definitionIds);
      }
    }

    console.log(`Seeded ${org.name} (${org.customers.length} customers)`);
  }

  console.log(`\nLog in with any of:`);
  for (const org of ORGS) {
    console.log(`  ${org.owner.email} / ${DEFAULT_PASSWORD}   (OWNER, ${org.name})`);
    if (org.fitter) console.log(`  ${org.fitter.email} / ${DEFAULT_PASSWORD}   (FITTER, ${org.name})`);
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
