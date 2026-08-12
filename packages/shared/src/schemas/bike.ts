import { z } from 'zod';
import { nullableText } from './common.js';

export const bikeTypeSchema = z.enum(['ROAD', 'TT', 'GRAVEL', 'MTB', 'OTHER']);
export type BikeType = z.infer<typeof bikeTypeSchema>;

/**
 * Every descriptive field is optional on purpose: a fitter should be able to start a
 * fit on an unbadged frame without inventing a brand for it. The UI falls back to the
 * bike type for a display name.
 */
export const createBikeSchema = z.object({
  brand: nullableText(100),
  model: nullableText(100),
  sizeLabel: nullableText(40),
  type: bikeTypeSchema.default('ROAD'),
  notes: nullableText(5000),
});
export type CreateBikeInput = z.input<typeof createBikeSchema>;
export type CreateBikeData = z.output<typeof createBikeSchema>;

/** PATCH semantics: an absent key means "leave unchanged". */
export const updateBikeSchema = createBikeSchema.partial();
export type UpdateBikeInput = z.input<typeof updateBikeSchema>;
export type UpdateBikeData = z.output<typeof updateBikeSchema>;

export const bikeSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  brand: z.string().nullable(),
  model: z.string().nullable(),
  sizeLabel: z.string().nullable(),
  type: bikeTypeSchema,
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Bike = z.infer<typeof bikeSchema>;

/** Unpaginated: a customer has a handful of bikes, not a catalogue. */
export const bikeListSchema = z.object({
  data: z.array(bikeSchema),
});
export type BikeList = z.infer<typeof bikeListSchema>;

/** Display name for a bike, for UI lists and fit headers. */
export function bikeLabel(bike: Pick<Bike, 'brand' | 'model' | 'sizeLabel' | 'type'>): string {
  const named = [bike.brand, bike.model].filter(Boolean).join(' ').trim();
  const base = named || BIKE_TYPE_LABELS[bike.type];
  return bike.sizeLabel ? `${base} (${bike.sizeLabel})` : base;
}

export const BIKE_TYPE_LABELS: Record<BikeType, string> = {
  ROAD: 'Road bike',
  TT: 'TT / triathlon bike',
  GRAVEL: 'Gravel bike',
  MTB: 'Mountain bike',
  OTHER: 'Bike',
};
