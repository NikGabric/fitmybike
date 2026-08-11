import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import {
  MEASUREMENT_DEFINITIONS,
  measurementDefinitionListSchema,
  type MeasurementDefinitionList,
} from '@fitmybike/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

/** Columns exposed over the wire. `id` stays internal — `key` is the public identifier. */
const DEFINITION_SELECT = {
  key: true,
  label: true,
  category: true,
  unit: true,
  minValue: true,
  maxValue: true,
  helpText: true,
  sortOrder: true,
} satisfies Prisma.MeasurementDefinitionSelect;

/** What a measurement save needs to resolve and validate a key. */
export interface CatalogEntry {
  id: string;
  key: string;
  label: string;
  category: 'BODY' | 'BIKE';
  minValue: number;
  maxValue: number;
}

/**
 * The catalog is global, not tenant-scoped, so this service reaches the raw client on
 * purpose — `measurement_definitions` has no organizationId to filter on, and the
 * model is deliberately absent from TENANT_MODELS.
 */
@Injectable()
export class MeasurementDefinitionsService implements OnModuleInit {
  private readonly logger = new Logger(MeasurementDefinitionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * key -> definition, including the internal id. Built once after the sync: the
   * catalog is immutable while the process runs, so re-reading it on every
   * measurement save would be pure overhead.
   */
  private catalogByKey: Map<string, CatalogEntry> | null = null;

  async onModuleInit(): Promise<void> {
    await this.sync();
  }

  /** Resolves measurement keys to definition ids and their validation bounds. */
  async catalog(): Promise<Map<string, CatalogEntry>> {
    if (this.catalogByKey) return this.catalogByKey;

    const rows = await this.prisma.measurementDefinition.findMany({
      where: { retiredAt: null },
      select: { id: true, key: true, label: true, category: true, minValue: true, maxValue: true },
    });

    this.catalogByKey = new Map(rows.map((row) => [row.key, row]));
    return this.catalogByKey;
  }

  /**
   * Mirrors MEASUREMENT_DEFINITIONS from packages/shared into the table.
   *
   * Runs at boot rather than from a migration or prisma/seed.ts because neither
   * executes for the integration tests: test/global-setup.ts rebuilds the database
   * with `prisma db push --force-reset`, which skips both. Syncing here means the
   * catalog is present anywhere the app starts — dev, prod, CI and `pnpm test`.
   *
   * A key that disappears from the shared array is retired, not deleted: fits
   * recorded against it keep their foreign key, so an old fit still resolves its
   * labels and units. Putting the key back un-retires it.
   */
  async sync(): Promise<void> {
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

      await this.prisma.measurementDefinition.upsert({
        where: { key: definition.key },
        update: fields,
        create: { key: definition.key, ...fields },
      });
    }

    const retired = await this.prisma.measurementDefinition.updateMany({
      where: {
        key: { notIn: MEASUREMENT_DEFINITIONS.map((d) => d.key) },
        retiredAt: null,
      },
      data: { retiredAt: new Date() },
    });

    if (retired.count > 0) {
      this.logger.log(`Retired ${retired.count} measurement definition(s) no longer in the catalog`);
    }
  }

  async list(): Promise<MeasurementDefinitionList> {
    const rows = await this.prisma.measurementDefinition.findMany({
      where: { retiredAt: null },
      select: DEFINITION_SELECT,
      orderBy: { sortOrder: 'asc' },
    });

    // Parsed rather than cast: `key` is a plain string column, but the contract
    // promises the literal union. Every live row came from MEASUREMENT_DEFINITIONS,
    // so this only throws if the table has drifted from the code — which is a bug
    // worth surfacing loudly rather than papering over with an assertion.
    return measurementDefinitionListSchema.parse({ data: rows });
  }
}
