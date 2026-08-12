import { Injectable, NotFoundException } from '@nestjs/common';
import type { Bike, BikeList, CreateBikeData, UpdateBikeData } from '@fitmybike/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

/** Columns exposed over the wire. `organizationId` and `createdById` stay internal. */
const BIKE_SELECT = {
  id: true,
  customerId: true,
  brand: true,
  model: true,
  sizeLabel: true,
  type: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.BikeSelect;

type BikeRow = Prisma.BikeGetPayload<{ select: typeof BIKE_SELECT }>;

@Injectable()
export class BikesService {
  constructor(private readonly prisma: PrismaService) {}

  async listForCustomer(organizationId: string, customerId: string): Promise<BikeList> {
    await this.requireCustomer(organizationId, customerId);

    const rows = await this.prisma.forOrg(organizationId).bike.findMany({
      where: { customerId, deletedAt: null },
      select: BIKE_SELECT,
      orderBy: { createdAt: 'asc' },
    });

    return { data: rows.map(toBike) };
  }

  async get(organizationId: string, id: string): Promise<Bike> {
    const row = await this.prisma
      .forOrg(organizationId)
      .bike.findFirst({ where: { id, deletedAt: null }, select: BIKE_SELECT });

    if (!row) throw new NotFoundException('Bike not found');
    return toBike(row);
  }

  async create(
    organizationId: string,
    customerId: string,
    createdById: string,
    input: CreateBikeData,
  ): Promise<Bike> {
    // Resolve the customer through forOrg first. Without this, a customerId from
    // another organization would reach Postgres and fail as a foreign key violation
    // — a 500 that confirms the id exists somewhere. A 404 says nothing.
    await this.requireCustomer(organizationId, customerId);

    const row = await this.prisma.forOrg(organizationId).bike.create({
      // organizationId is passed to satisfy Prisma's generated input type; the forOrg
      // extension overwrites it with the scoped value regardless.
      data: { ...input, organizationId, customerId, createdById },
      select: BIKE_SELECT,
    });
    return toBike(row);
  }

  async update(organizationId: string, id: string, input: UpdateBikeData): Promise<Bike> {
    await this.get(organizationId, id);

    const row = await this.prisma.forOrg(organizationId).bike.update({
      where: { id },
      data: input,
      select: BIKE_SELECT,
    });
    return toBike(row);
  }

  /** Soft delete: the fits that reference this bike keep their history. */
  async remove(organizationId: string, id: string): Promise<void> {
    await this.get(organizationId, id);

    await this.prisma
      .forOrg(organizationId)
      .bike.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  private async requireCustomer(organizationId: string, customerId: string): Promise<void> {
    const customer = await this.prisma
      .forOrg(organizationId)
      .customer.findFirst({ where: { id: customerId, deletedAt: null }, select: { id: true } });

    if (!customer) throw new NotFoundException('Customer not found');
  }
}

function toBike(row: BikeRow): Bike {
  return {
    id: row.id,
    customerId: row.customerId,
    brand: row.brand,
    model: row.model,
    sizeLabel: row.sizeLabel,
    type: row.type,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
