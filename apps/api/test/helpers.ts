import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type Role } from '@prisma/client';
import * as argon2 from 'argon2';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';

export const TEST_PASSWORD = 'test-password-123';

/** Mirrors main.ts so tests exercise the same middleware and prefix as production. */
export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  await app.init();
  return app;
}

export function createPrisma(): PrismaClient {
  const connectionString = process.env['DATABASE_URL'];
  if (!connectionString) throw new Error('DATABASE_URL is not set');
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

export interface SeededOrg {
  organizationId: string;
  userId: string;
  email: string;
}

let counter = 0;

/** Creates an isolated organization with one user. Emails are unique per call. */
export async function seedOrg(
  prisma: PrismaClient,
  options: { role?: Role; name?: string } = {},
): Promise<SeededOrg> {
  counter += 1;
  const suffix = `${Date.now()}-${counter}`;
  const name = options.name ?? `Org ${suffix}`;

  const organization = await prisma.organization.create({
    data: { name, slug: `org-${suffix}` },
  });

  const user = await prisma.user.create({
    data: {
      organizationId: organization.id,
      email: `user-${suffix}@example.test`,
      name: `User ${suffix}`,
      role: options.role ?? 'OWNER',
      passwordHash: await argon2.hash(TEST_PASSWORD, { type: argon2.argon2id }),
    },
  });

  return { organizationId: organization.id, userId: user.id, email: user.email };
}

/** Logs in and returns the raw Cookie header value for subsequent requests. */
export async function login(app: INestApplication, email: string): Promise<string> {
  const response = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ email, password: TEST_PASSWORD })
    .expect(200);

  const setCookie = response.headers['set-cookie'];
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
  const session = cookies.find((cookie) => cookie?.startsWith('fmb_session='));
  if (!session) throw new Error('Login did not set a session cookie');

  return session.split(';')[0] as string;
}

export async function createCustomer(
  prisma: PrismaClient,
  org: SeededOrg,
  overrides: { firstName?: string; lastName?: string } = {},
): Promise<{ id: string }> {
  return prisma.customer.create({
    data: {
      organizationId: org.organizationId,
      createdById: org.userId,
      firstName: overrides.firstName ?? 'Test',
      lastName: overrides.lastName ?? 'Customer',
    },
    select: { id: true },
  });
}
