import { z } from 'zod';
import { bikeTypeSchema, type Bike, type BikeType } from '@fitmybike/shared';
import { blankToNull } from '@/lib/form-fields';

/**
 * No unit conversion here — a bike has no measurements of its own. Those live on
 * the fit, because what a saddle is set to is a property of the fitting session,
 * not of the frame.
 */
export const bikeFormSchema = z.object({
  brand: z.string().trim().max(100),
  model: z.string().trim().max(100),
  sizeLabel: z.string().trim().max(40),
  type: bikeTypeSchema,
  notes: z.string().max(5000),
});

export type BikeFormValues = z.infer<typeof bikeFormSchema>;

/** Exactly what the API accepts — nulls rather than blanks. */
export interface BikeApiPayload {
  brand: string | null;
  model: string | null;
  sizeLabel: string | null;
  type: BikeType;
  notes: string | null;
}

export const emptyBikeForm: BikeFormValues = {
  brand: '',
  model: '',
  sizeLabel: '',
  type: 'ROAD',
  notes: '',
};

export function toFormValues(bike: Bike): BikeFormValues {
  return {
    brand: bike.brand ?? '',
    model: bike.model ?? '',
    sizeLabel: bike.sizeLabel ?? '',
    type: bike.type,
    notes: bike.notes ?? '',
  };
}

export function toApiPayload(values: BikeFormValues): BikeApiPayload {
  return {
    brand: blankToNull(values.brand),
    model: blankToNull(values.model),
    sizeLabel: blankToNull(values.sizeLabel),
    type: values.type,
    notes: blankToNull(values.notes),
  };
}
