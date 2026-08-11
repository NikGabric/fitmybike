import { z } from 'zod';

/**
 * Form inputs arrive as strings, and an untouched optional field arrives as ''.
 * These helpers normalise '' and undefined to null so the API never has to guess
 * whether "empty" means "unset" or "blank string".
 */

export const nullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v == null || v === '' ? null : v));

export const nullableEmail = () =>
  z
    .union([z.literal(''), z.email().max(255)])
    .nullish()
    .transform((v) => (v == null || v === '' ? null : v.toLowerCase()));

/** ISO `YYYY-MM-DD`. Kept as a string end to end; time zones have no business here. */
export const nullableDate = () =>
  z
    .union([z.literal(''), z.iso.date()])
    .nullish()
    .transform((v) => (v == null || v === '' ? null : v));

export const nullableInt = (min: number, max: number) =>
  z
    .union([z.literal(''), z.coerce.number().int().min(min).max(max)])
    .nullish()
    .transform((v) => (v == null || v === '' ? null : v));

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().max(200).optional(),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export const paginationMetaSchema = z.object({
  page: z.number().int(),
  perPage: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
});
export type PaginationMeta = z.infer<typeof paginationMetaSchema>;

export const roleSchema = z.enum(['OWNER', 'FITTER']);
export type Role = z.infer<typeof roleSchema>;
