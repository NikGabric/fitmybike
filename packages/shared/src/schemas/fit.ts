import { z } from 'zod';
import { bikeTypeSchema } from './bike.js';
import { nullableInt, nullableText, paginationMetaSchema, paginationQuerySchema } from './common.js';
import { measurementKeySchema } from './measurement.js';

/**
 * The two snapshots of the bike, and the only thing a bike measurement is tagged
 * with. Measuring the rider's body is not a stage of the fit — see fitStepSchema.
 */
export const fitStageSchema = z.enum(['BEFORE', 'AFTER']);
export type FitStage = z.infer<typeof fitStageSchema>;

/** The wizard's resume pointer: which screen the fitter was last on. A UI concern. */
export const fitStepSchema = z.enum(['BODY', 'BIKE_BEFORE', 'BIKE_AFTER', 'REVIEW']);
export type FitStep = z.infer<typeof fitStepSchema>;

export const fitStatusSchema = z.enum(['IN_PROGRESS', 'COMPLETED']);
export type FitStatus = z.infer<typeof fitStatusSchema>;

// --- writes ---

export const createFitSchema = z.object({
  customerId: z.string().min(1, 'A customer is required'),
  bikeId: z.string().min(1, 'A bike is required'),
  reason: nullableText(2000),
});
export type CreateFitInput = z.input<typeof createFitSchema>;
export type CreateFitData = z.output<typeof createFitSchema>;

export const updateFitSchema = z
  .object({
    currentStep: fitStepSchema,
    reason: nullableText(2000),
    summary: nullableText(5000),
  })
  .partial();
export type UpdateFitInput = z.input<typeof updateFitSchema>;
export type UpdateFitData = z.output<typeof updateFitSchema>;

/**
 * One measurement in a batch save.
 *
 * The bounds here are only a sanity envelope — the real per-measurement range comes
 * from the catalog and is enforced server-side, because it is the definition that
 * knows a crank is 150–185 mm and a saddle angle is ±15°.
 *
 * A `null` value removes the measurement: clearing a field in the wizard should
 * leave no row behind, not a zero.
 */
export const measurementInputSchema = z.object({
  key: measurementKeySchema,
  value: nullableInt(-100_000, 100_000),
  note: nullableText(500),
});
export type MeasurementInput = z.output<typeof measurementInputSchema>;

/**
 * A batch replaces each named measurement outright — value and note together.
 * Keys absent from the batch are left untouched.
 */
/** One entry per key: two would race each other inside the same transaction. */
const uniqueKeys = (measurements: Array<{ key: string }>): boolean =>
  new Set(measurements.map((m) => m.key)).size === measurements.length;

export const updateBodyMeasurementsSchema = z.object({
  measurements: z
    .array(measurementInputSchema)
    .max(100)
    .refine(uniqueKeys, 'Each measurement may appear only once'),
});
export type UpdateBodyMeasurementsData = z.output<typeof updateBodyMeasurementsSchema>;

export const updateBikeMeasurementsSchema = z.object({
  stage: fitStageSchema,
  measurements: z
    .array(measurementInputSchema)
    .max(100)
    .refine(uniqueKeys, 'Each measurement may appear only once'),
});
export type UpdateBikeMeasurementsData = z.output<typeof updateBikeMeasurementsSchema>;

// --- reads ---

const fitCustomerSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
});

const fitBikeSchema = z.object({
  id: z.string(),
  brand: z.string().nullable(),
  model: z.string().nullable(),
  sizeLabel: z.string().nullable(),
  type: bikeTypeSchema,
});

export const bodyMeasurementSchema = z.object({
  key: measurementKeySchema,
  value: z.number().int(),
  note: z.string().nullable(),
  /** Carried over from an earlier fit rather than measured today. */
  prefilled: z.boolean(),
});
export type BodyMeasurement = z.infer<typeof bodyMeasurementSchema>;

export const bikeMeasurementSchema = bodyMeasurementSchema.extend({
  stage: fitStageSchema,
});
export type BikeMeasurement = z.infer<typeof bikeMeasurementSchema>;

/** The list view: everything needed for a history row, without the measurements. */
export const fitSummarySchema = z.object({
  id: z.string(),
  customerId: z.string(),
  bikeId: z.string(),
  status: fitStatusSchema,
  currentStep: fitStepSchema,
  reason: z.string().nullable(),
  startedAt: z.string(),
  completedAt: z.string().nullable(),
  customer: fitCustomerSchema,
  bike: fitBikeSchema,
});
export type FitSummary = z.infer<typeof fitSummarySchema>;

/**
 * The full fit. Measurements carry values only — labels, units, bounds and ordering
 * come from GET /api/measurement-definitions, which the client fetches once. That
 * keeps this payload lean and lets the UI render definitions with no row yet.
 */
export const fitSchema = fitSummarySchema.extend({
  summary: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  bodyMeasurements: z.array(bodyMeasurementSchema),
  bikeMeasurements: z.array(bikeMeasurementSchema),
});
export type Fit = z.infer<typeof fitSchema>;

export const fitListQuerySchema = paginationQuerySchema.extend({
  customerId: z.string().optional(),
  bikeId: z.string().optional(),
  status: fitStatusSchema.optional(),
});
export type FitListQuery = z.infer<typeof fitListQuerySchema>;

export const fitListSchema = z.object({
  data: z.array(fitSummarySchema),
  meta: paginationMetaSchema,
});
export type FitList = z.infer<typeof fitListSchema>;
