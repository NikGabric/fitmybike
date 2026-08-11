import { z } from 'zod';
import {
  nullableDate,
  nullableEmail,
  nullableInt,
  nullableText,
  paginationMetaSchema,
  paginationQuerySchema,
} from './common.js';

/** Plausible adult range, generous at both ends: 1.00 m – 2.50 m. */
const HEIGHT_MM = { min: 1000, max: 2500 } as const;
/** 30 kg – 250 kg. */
const WEIGHT_GRAMS = { min: 30_000, max: 250_000 } as const;

export const createCustomerSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(100),
  lastName: z.string().trim().min(1, 'Last name is required').max(100),
  email: nullableEmail(),
  phone: nullableText(40),
  dateOfBirth: nullableDate(),
  heightMm: nullableInt(HEIGHT_MM.min, HEIGHT_MM.max),
  weightGrams: nullableInt(WEIGHT_GRAMS.min, WEIGHT_GRAMS.max),
  notes: nullableText(5000),
});
export type CreateCustomerInput = z.input<typeof createCustomerSchema>;
export type CreateCustomerData = z.output<typeof createCustomerSchema>;

/** PATCH semantics: an absent key means "leave unchanged". */
export const updateCustomerSchema = createCustomerSchema.partial();
export type UpdateCustomerInput = z.input<typeof updateCustomerSchema>;
export type UpdateCustomerData = z.output<typeof updateCustomerSchema>;

export const customerSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  dateOfBirth: z.string().nullable(),
  heightMm: z.number().int().nullable(),
  weightGrams: z.number().int().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Customer = z.infer<typeof customerSchema>;

export const customerListQuerySchema = paginationQuerySchema;
export type CustomerListQuery = z.infer<typeof customerListQuerySchema>;

export const customerListSchema = z.object({
  data: z.array(customerSchema),
  meta: paginationMetaSchema,
});
export type CustomerList = z.infer<typeof customerListSchema>;

export const customerLimits = { height: HEIGHT_MM, weight: WEIGHT_GRAMS } as const;
