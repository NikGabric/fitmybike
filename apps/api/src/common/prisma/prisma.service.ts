import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import type { Env } from '../../env';
import { createTenantClient, type TenantPrismaClient } from './tenant-client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(config: ConfigService<Env, true>) {
    // Prisma 7 has no built-in query engine; it talks to Postgres through a driver adapter.
    super({ adapter: new PrismaPg({ connectionString: config.get('DATABASE_URL') }) });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /**
   * The only sanctioned way to reach a tenant-scoped model.
   *
   *   this.prisma.forOrg(user.organizationId).customer.findMany()
   *
   * Deliberately NOT a request-scoped provider: making this request-scoped would
   * turn every consumer — and their whole dependency subtree — request-scoped too,
   * which is a quiet and expensive performance cliff. Passing the id explicitly
   * keeps the scope visible at every call site.
   */
  forOrg(organizationId: string): TenantPrismaClient {
    return createTenantClient(this, organizationId);
  }
}
