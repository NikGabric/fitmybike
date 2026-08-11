import type { PrismaClient } from '@prisma/client';

/**
 * Models that carry `organizationId`. Adding a tenant-scoped model means adding it
 * here *and* to TENANT_MODELS in the root eslint.config.js, which lint-blocks raw
 * access to it off the unscoped client.
 */
const TENANT_MODELS = new Set(['Customer', 'Invitation', 'EmailLog']);

/** Operations that accept a `where` clause we can constrain. */
const WHERE_OPERATIONS = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirstOrThrow',
  'count',
  'aggregate',
  'groupBy',
  'update',
  'updateMany',
  'delete',
  'deleteMany',
  'upsert',
]);

type AnyArgs = Record<string, unknown>;

/**
 * Wraps a Prisma client so every query against a tenant-scoped model is confined to
 * one organization: `organizationId` is forced into the `where` clause on reads,
 * updates and deletes, and into `data` on writes.
 *
 * Because it lands in `where`, a cross-tenant `update`/`delete` fails with Prisma's
 * P2025 (record not found), which the exception filter turns into a 404 — the
 * caller cannot distinguish "belongs to someone else" from "does not exist".
 *
 * This is a safety net, not a licence to stop thinking: it only covers models listed
 * in TENANT_MODELS, and raw queries bypass it entirely.
 */
export function createTenantClient(base: PrismaClient, organizationId: string) {
  return base.$extends({
    query: {
      $allModels: {
        $allOperations({ model, operation, args, query }) {
          if (!TENANT_MODELS.has(model)) return query(args);

          const next: AnyArgs = { ...(args as AnyArgs) };

          if (WHERE_OPERATIONS.has(operation)) {
            next['where'] = { ...((next['where'] as AnyArgs) ?? {}), organizationId };
          }

          if (operation === 'create') {
            next['data'] = { ...((next['data'] as AnyArgs) ?? {}), organizationId };
          }

          if (operation === 'upsert') {
            next['create'] = { ...((next['create'] as AnyArgs) ?? {}), organizationId };
          }

          if (operation === 'createMany' || operation === 'createManyAndReturn') {
            const data = next['data'];
            next['data'] = Array.isArray(data)
              ? data.map((row: AnyArgs) => ({ ...row, organizationId }))
              : { ...((data as AnyArgs) ?? {}), organizationId };
          }

          return query(next);
        },
      },
    },
  });
}

export type TenantPrismaClient = ReturnType<typeof createTenantClient>;
