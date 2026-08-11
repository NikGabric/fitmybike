import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import type {
  CreateFitData,
  Fit,
  FitList,
  FitListQuery,
  MeasurementInput,
  UpdateBikeMeasurementsData,
  UpdateBodyMeasurementsData,
  UpdateFitData,
} from '@fitmybike/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  MeasurementDefinitionsService,
  type CatalogEntry,
} from '../measurement-definitions/measurement-definitions.service';

const FIT_SUMMARY_SELECT = {
  id: true,
  customerId: true,
  bikeId: true,
  status: true,
  currentStep: true,
  reason: true,
  startedAt: true,
  completedAt: true,
  customer: { select: { id: true, firstName: true, lastName: true } },
  bike: { select: { id: true, brand: true, model: true, sizeLabel: true, type: true } },
} satisfies Prisma.FitSelect;

const FIT_SELECT = {
  ...FIT_SUMMARY_SELECT,
  summary: true,
  createdAt: true,
  updatedAt: true,
  bodyMeasurements: {
    select: { value: true, note: true, prefilled: true, definition: { select: { key: true } } },
  },
  bikeMeasurements: {
    select: {
      stage: true,
      value: true,
      note: true,
      prefilled: true,
      definition: { select: { key: true } },
    },
  },
} satisfies Prisma.FitSelect;

type FitSummaryRow = Prisma.FitGetPayload<{ select: typeof FIT_SUMMARY_SELECT }>;
type FitRow = Prisma.FitGetPayload<{ select: typeof FIT_SELECT }>;

@Injectable()
export class FitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly definitions: MeasurementDefinitionsService,
  ) {}

  async list(organizationId: string, query: FitListQuery): Promise<FitList> {
    const db = this.prisma.forOrg(organizationId);

    const where: Prisma.FitWhereInput = {
      deletedAt: null,
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.bikeId ? { bikeId: query.bikeId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const [rows, total] = await Promise.all([
      db.fit.findMany({
        where,
        select: FIT_SUMMARY_SELECT,
        orderBy: { startedAt: 'desc' },
        skip: (query.page - 1) * query.perPage,
        take: query.perPage,
      }),
      db.fit.count({ where }),
    ]);

    return {
      data: rows.map(toFitSummary),
      meta: {
        page: query.page,
        perPage: query.perPage,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.perPage)),
      },
    };
  }

  async get(organizationId: string, id: string): Promise<Fit> {
    const row = await this.prisma
      .forOrg(organizationId)
      .fit.findFirst({ where: { id, deletedAt: null }, select: FIT_SELECT });

    if (!row) throw new NotFoundException('Fit not found');
    return toFit(row);
  }

  /**
   * Starts a fit, carrying forward what is already known.
   *
   * Bike before-values come from the last completed fit *on that bike*: whatever it
   * was delivered at is what it should still be sitting at today. Body values come
   * from the customer's last completed fit on *any* bike, since the rider is the
   * same person regardless of which frame they turned up on.
   *
   * Everything carried over is flagged `prefilled` so the UI can show it as
   * inherited rather than measured, and the flag clears the moment the fitter saves
   * over it.
   */
  async create(
    organizationId: string,
    createdById: string,
    input: CreateFitData,
  ): Promise<Fit> {
    const db = this.prisma.forOrg(organizationId);

    const customer = await db.customer.findFirst({
      where: { id: input.customerId, deletedAt: null },
      select: { id: true },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    const bike = await db.bike.findFirst({
      where: { id: input.bikeId, deletedAt: null },
      select: { id: true, customerId: true },
    });
    if (!bike) throw new NotFoundException('Bike not found');

    // Both exist in this organization, but they may not belong together. That is a
    // malformed request rather than a missing record, so 422 with a field key.
    if (bike.customerId !== input.customerId) {
      throw new UnprocessableEntityException({
        message: 'That bike belongs to a different customer',
        details: { bikeId: ['That bike belongs to a different customer'] },
      });
    }

    const [previousOnBike, previousForCustomer] = await Promise.all([
      db.fit.findFirst({
        where: { bikeId: input.bikeId, status: 'COMPLETED', deletedAt: null },
        orderBy: { completedAt: 'desc' },
        select: {
          bikeMeasurements: {
            where: { stage: 'AFTER' },
            select: { definitionId: true, value: true },
          },
        },
      }),
      db.fit.findFirst({
        where: { customerId: input.customerId, status: 'COMPLETED', deletedAt: null },
        orderBy: { completedAt: 'desc' },
        select: { bodyMeasurements: { select: { definitionId: true, value: true } } },
      }),
    ]);

    const fit = await db.fit.create({
      data: {
        organizationId,
        customerId: input.customerId,
        bikeId: input.bikeId,
        reason: input.reason,
        createdById,
        bodyMeasurements: {
          create: (previousForCustomer?.bodyMeasurements ?? []).map((m) => ({
            organizationId,
            definitionId: m.definitionId,
            value: m.value,
            prefilled: true,
          })),
        },
        bikeMeasurements: {
          create: (previousOnBike?.bikeMeasurements ?? []).map((m) => ({
            organizationId,
            definitionId: m.definitionId,
            stage: 'BEFORE' as const,
            value: m.value,
            prefilled: true,
          })),
        },
      },
      select: FIT_SELECT,
    });

    return toFit(fit);
  }

  async update(organizationId: string, id: string, input: UpdateFitData): Promise<Fit> {
    await this.requireFit(organizationId, id);

    const row = await this.prisma
      .forOrg(organizationId)
      .fit.update({ where: { id }, data: input, select: FIT_SELECT });
    return toFit(row);
  }

  async complete(organizationId: string, id: string): Promise<Fit> {
    await this.requireFit(organizationId, id);

    const row = await this.prisma.forOrg(organizationId).fit.update({
      where: { id },
      data: { status: 'COMPLETED', completedAt: new Date(), currentStep: 'REVIEW' },
      select: FIT_SELECT,
    });
    return toFit(row);
  }

  async remove(organizationId: string, id: string): Promise<void> {
    await this.requireFit(organizationId, id);

    await this.prisma
      .forOrg(organizationId)
      .fit.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async updateBodyMeasurements(
    organizationId: string,
    id: string,
    input: UpdateBodyMeasurementsData,
  ): Promise<Fit> {
    await this.requireFit(organizationId, id);
    const resolved = await this.resolve(input.measurements, 'BODY');

    const db = this.prisma.forOrg(organizationId);
    const definitionIds = resolved.map((r) => r.entry.id);

    // Replace rather than upsert: a batch carries the whole state of each key it
    // names — value and note together — so clearing a field leaves no row behind.
    // Keys absent from the batch are never touched.
    await db.$transaction([
      db.fitBodyMeasurement.deleteMany({
        where: { fitId: id, definitionId: { in: definitionIds } },
      }),
      db.fitBodyMeasurement.createMany({
        data: resolved
          .filter((r) => r.input.value !== null)
          .map((r) => ({
            organizationId,
            fitId: id,
            definitionId: r.entry.id,
            value: r.input.value as number,
            note: r.input.note,
            prefilled: false,
          })),
      }),
    ]);

    return this.get(organizationId, id);
  }

  async updateBikeMeasurements(
    organizationId: string,
    id: string,
    input: UpdateBikeMeasurementsData,
  ): Promise<Fit> {
    await this.requireFit(organizationId, id);
    const resolved = await this.resolve(input.measurements, 'BIKE');

    const db = this.prisma.forOrg(organizationId);
    const definitionIds = resolved.map((r) => r.entry.id);

    await db.$transaction([
      db.fitBikeMeasurement.deleteMany({
        where: { fitId: id, stage: input.stage, definitionId: { in: definitionIds } },
      }),
      db.fitBikeMeasurement.createMany({
        data: resolved
          .filter((r) => r.input.value !== null)
          .map((r) => ({
            organizationId,
            fitId: id,
            definitionId: r.entry.id,
            stage: input.stage,
            value: r.input.value as number,
            note: r.input.note,
            prefilled: false,
          })),
      }),
    ]);

    return this.get(organizationId, id);
  }

  /**
   * Checks every measurement in a batch against the catalog before anything is
   * written, and reports all the problems at once keyed by measurement — a fitter
   * filling in a screenful of numbers should not have to fix them one round trip at
   * a time.
   */
  private async resolve(
    measurements: MeasurementInput[],
    category: 'BODY' | 'BIKE',
  ): Promise<Array<{ input: MeasurementInput; entry: CatalogEntry }>> {
    const catalog = await this.definitions.catalog();
    const details: Record<string, string[]> = {};
    const resolved: Array<{ input: MeasurementInput; entry: CatalogEntry }> = [];

    for (const measurement of measurements) {
      const entry = catalog.get(measurement.key);

      if (!entry) {
        details[measurement.key] = ['No such measurement'];
        continue;
      }
      if (entry.category !== category) {
        details[measurement.key] = [
          `${entry.label} is a ${entry.category.toLowerCase()} measurement`,
        ];
        continue;
      }
      if (
        measurement.value !== null &&
        (measurement.value < entry.minValue || measurement.value > entry.maxValue)
      ) {
        details[measurement.key] = [
          `${entry.label} must be between ${entry.minValue} and ${entry.maxValue}`,
        ];
        continue;
      }

      resolved.push({ input: measurement, entry });
    }

    if (Object.keys(details).length > 0) {
      throw new UnprocessableEntityException({ message: 'Validation failed', details });
    }

    return resolved;
  }

  private async requireFit(organizationId: string, id: string): Promise<void> {
    const fit = await this.prisma
      .forOrg(organizationId)
      .fit.findFirst({ where: { id, deletedAt: null }, select: { id: true } });

    if (!fit) throw new NotFoundException('Fit not found');
  }
}

function toFitSummary(row: FitSummaryRow): FitList['data'][number] {
  return {
    id: row.id,
    customerId: row.customerId,
    bikeId: row.bikeId,
    status: row.status,
    currentStep: row.currentStep,
    reason: row.reason,
    startedAt: row.startedAt.toISOString(),
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    customer: row.customer,
    bike: row.bike,
  };
}

function toFit(row: FitRow): Fit {
  return {
    ...toFitSummary(row),
    summary: row.summary,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    bodyMeasurements: row.bodyMeasurements.map((m) => ({
      key: m.definition.key as Fit['bodyMeasurements'][number]['key'],
      value: m.value,
      note: m.note,
      prefilled: m.prefilled,
    })),
    bikeMeasurements: row.bikeMeasurements.map((m) => ({
      key: m.definition.key as Fit['bikeMeasurements'][number]['key'],
      stage: m.stage,
      value: m.value,
      note: m.note,
      prefilled: m.prefilled,
    })),
  };
}
