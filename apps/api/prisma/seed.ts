import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type Prisma } from '@prisma/client';
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

async function main(): Promise<void> {
  const passwordHash = await argon2.hash(DEFAULT_PASSWORD, { type: argon2.argon2id });

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
