import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreateCustomerData,
  Customer,
  CustomerList,
  CustomerListQuery,
  UpdateCustomerData,
} from '@fitmybike/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

/** Columns exposed over the wire. `organizationId` and `createdById` stay internal. */
const CUSTOMER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  dateOfBirth: true,
  heightMm: true,
  weightGrams: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CustomerSelect;

type CustomerRow = Prisma.CustomerGetPayload<{ select: typeof CUSTOMER_SELECT }>;

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string, query: CustomerListQuery): Promise<CustomerList> {
    const db = this.prisma.forOrg(organizationId);

    const search = query.search?.trim();
    const where: Prisma.CustomerWhereInput = {
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      db.customer.findMany({
        where,
        select: CUSTOMER_SELECT,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        skip: (query.page - 1) * query.perPage,
        take: query.perPage,
      }),
      db.customer.count({ where }),
    ]);

    return {
      data: rows.map(toCustomer),
      meta: {
        page: query.page,
        perPage: query.perPage,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.perPage)),
      },
    };
  }

  async get(organizationId: string, id: string): Promise<Customer> {
    // findFirst, not findUnique: it takes arbitrary filters, so the injected
    // organizationId and the deletedAt check compose without special cases.
    const row = await this.prisma
      .forOrg(organizationId)
      .customer.findFirst({ where: { id, deletedAt: null }, select: CUSTOMER_SELECT });

    if (!row) throw new NotFoundException('Customer not found');
    return toCustomer(row);
  }

  async create(
    organizationId: string,
    createdById: string,
    input: CreateCustomerData,
  ): Promise<Customer> {
    const row = await this.prisma.forOrg(organizationId).customer.create({
      // organizationId is passed explicitly to satisfy Prisma's generated input type;
      // the forOrg extension overwrites it with the scoped value regardless, so a
      // wrong id here cannot leak a row into another tenant.
      data: { ...toPersistence(input), organizationId, createdById },
      select: CUSTOMER_SELECT,
    });
    return toCustomer(row);
  }

  async update(organizationId: string, id: string, input: UpdateCustomerData): Promise<Customer> {
    await this.get(organizationId, id);

    const row = await this.prisma.forOrg(organizationId).customer.update({
      where: { id },
      data: toPersistence(input),
      select: CUSTOMER_SELECT,
    });
    return toCustomer(row);
  }

  /** Soft delete: the row stays for audit and for the fits that will reference it. */
  async remove(organizationId: string, id: string): Promise<void> {
    await this.get(organizationId, id);

    await this.prisma
      .forOrg(organizationId)
      .customer.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}

/** `YYYY-MM-DD` on the wire, a UTC-midnight DATE in Postgres. */
function toPersistence<T extends Partial<CreateCustomerData>>(
  input: T,
): Omit<T, 'dateOfBirth'> & { dateOfBirth?: Date | null } {
  const { dateOfBirth, ...rest } = input;
  if (dateOfBirth === undefined) return rest as Omit<T, 'dateOfBirth'>;
  return {
    ...(rest as Omit<T, 'dateOfBirth'>),
    dateOfBirth: dateOfBirth === null ? null : new Date(`${dateOfBirth}T00:00:00.000Z`),
  };
}

function toCustomer(row: CustomerRow): Customer {
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    phone: row.phone,
    dateOfBirth: row.dateOfBirth ? row.dateOfBirth.toISOString().slice(0, 10) : null,
    heightMm: row.heightMm,
    weightGrams: row.weightGrams,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
