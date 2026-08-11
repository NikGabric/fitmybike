import { z } from 'zod';

/**
 * The measurement catalog — the single source of truth for what a fit records.
 *
 * This array is authoritative; the `measurement_definitions` table is a mirror of it,
 * synced on API boot (see MeasurementDefinitionsService). Seeding the table from a
 * migration or from prisma/seed.ts would not do: the API integration tests rebuild
 * their database with `prisma db push --force-reset`, which runs neither, so the
 * catalog would be silently missing under `pnpm test`.
 *
 * Values are SI integers throughout, per the project-wide rule:
 *   MM         millimetres
 *   DECIDEGREE tenths of a degree — 72.5° is stored as 725
 *   GRAM       grams
 *
 * The unit names what is *stored*, not what is displayed, so there is nothing to
 * remember at a call site. Conversion happens only at the display edge, in units.ts.
 *
 * Adding a measurement is a line here plus `pnpm openapi`. Deleting one is safe:
 * the sync stamps `retiredAt` on any row whose key has left this array rather than
 * dropping it, so fits recorded years ago keep resolving their labels and units.
 * Putting the key back un-retires it.
 */

export const measurementCategorySchema = z.enum(['BODY', 'BIKE']);
export type MeasurementCategory = z.infer<typeof measurementCategorySchema>;

export const measurementUnitSchema = z.enum(['MM', 'DECIDEGREE', 'GRAM']);
export type MeasurementUnit = z.infer<typeof measurementUnitSchema>;

interface MeasurementSeed {
  readonly key: string;
  readonly label: string;
  readonly category: MeasurementCategory;
  readonly unit: MeasurementUnit;
  /** Inclusive bounds, in the stored unit. Generous at both ends — these reject typos, not riders. */
  readonly minValue: number;
  readonly maxValue: number;
  readonly helpText?: string;
  readonly sortOrder: number;
}

export const MEASUREMENT_DEFINITIONS = [
  // --- body: the rider, measured once per fit ---
  {
    key: 'inseam',
    label: 'Inseam',
    category: 'BODY',
    unit: 'MM',
    minValue: 500,
    maxValue: 1100,
    helpText: 'Floor to crotch, barefoot, book pulled up firmly.',
    sortOrder: 100,
  },
  {
    key: 'torso_length',
    label: 'Torso length',
    category: 'BODY',
    unit: 'MM',
    minValue: 400,
    maxValue: 900,
    helpText: 'Sternal notch to the top of the iliac crest.',
    sortOrder: 110,
  },
  {
    key: 'arm_length',
    label: 'Arm length',
    category: 'BODY',
    unit: 'MM',
    minValue: 400,
    maxValue: 900,
    helpText: 'Acromion to the centre of a closed fist.',
    sortOrder: 120,
  },
  {
    key: 'shoulder_width',
    label: 'Shoulder width',
    category: 'BODY',
    unit: 'MM',
    minValue: 250,
    maxValue: 600,
    helpText: 'Acromion to acromion.',
    sortOrder: 130,
  },
  {
    key: 'foot_length',
    label: 'Foot length',
    category: 'BODY',
    unit: 'MM',
    minValue: 200,
    maxValue: 350,
    sortOrder: 140,
  },
  {
    key: 'sternal_notch_height',
    label: 'Sternal notch height',
    category: 'BODY',
    unit: 'MM',
    minValue: 1000,
    maxValue: 1800,
    helpText: 'Floor to the sternal notch, standing.',
    sortOrder: 150,
  },
  {
    key: 'forward_flexion',
    label: 'Forward flexion',
    category: 'BODY',
    unit: 'DECIDEGREE',
    minValue: 0,
    maxValue: 1200,
    helpText: 'Hip flexion with a neutral spine, knees locked.',
    sortOrder: 160,
  },

  // --- bike: measured twice per fit, as it arrived and as delivered ---
  {
    key: 'saddle_height',
    label: 'Saddle height',
    category: 'BIKE',
    unit: 'MM',
    minValue: 500,
    maxValue: 950,
    helpText: 'Bottom bracket centre to the top of the saddle, along the seat tube.',
    sortOrder: 200,
  },
  {
    key: 'saddle_setback',
    label: 'Saddle setback',
    category: 'BIKE',
    unit: 'MM',
    minValue: -50,
    maxValue: 200,
    helpText: 'Saddle nose behind the bottom bracket. Negative if ahead of it.',
    sortOrder: 210,
  },
  {
    key: 'saddle_angle',
    label: 'Saddle angle',
    category: 'BIKE',
    unit: 'DECIDEGREE',
    minValue: -150,
    maxValue: 150,
    helpText: 'Nose up is positive.',
    sortOrder: 220,
  },
  {
    key: 'saddle_nose_to_bar',
    label: 'Saddle nose to bar',
    category: 'BIKE',
    unit: 'MM',
    minValue: 300,
    maxValue: 800,
    sortOrder: 230,
  },
  {
    key: 'saddle_to_bar_drop',
    label: 'Saddle to bar drop',
    category: 'BIKE',
    unit: 'MM',
    minValue: -150,
    maxValue: 250,
    helpText: 'Saddle above bar is positive. Negative when the bars sit higher.',
    sortOrder: 240,
  },
  {
    key: 'stem_length',
    label: 'Stem length',
    category: 'BIKE',
    unit: 'MM',
    minValue: 50,
    maxValue: 160,
    sortOrder: 250,
  },
  {
    key: 'stem_angle',
    label: 'Stem angle',
    category: 'BIKE',
    unit: 'DECIDEGREE',
    minValue: -250,
    maxValue: 250,
    sortOrder: 260,
  },
  {
    key: 'spacer_stack',
    label: 'Spacer stack',
    category: 'BIKE',
    unit: 'MM',
    minValue: 0,
    maxValue: 100,
    helpText: 'Total spacer height below the stem.',
    sortOrder: 270,
  },
  {
    key: 'bar_width',
    label: 'Bar width',
    category: 'BIKE',
    unit: 'MM',
    minValue: 320,
    maxValue: 520,
    helpText: 'Centre to centre at the hoods.',
    sortOrder: 280,
  },
  {
    key: 'bar_reach',
    label: 'Bar reach',
    category: 'BIKE',
    unit: 'MM',
    minValue: 60,
    maxValue: 120,
    sortOrder: 290,
  },
  {
    key: 'crank_length',
    label: 'Crank length',
    category: 'BIKE',
    unit: 'MM',
    minValue: 150,
    maxValue: 185,
    sortOrder: 300,
  },
  {
    key: 'cleat_fore_aft',
    label: 'Cleat fore/aft',
    category: 'BIKE',
    unit: 'MM',
    minValue: 0,
    maxValue: 40,
    helpText: 'Shoe toe to the cleat centre.',
    sortOrder: 310,
  },
] as const satisfies readonly MeasurementSeed[];

export type MeasurementKey = (typeof MEASUREMENT_DEFINITIONS)[number]['key'];

export const measurementKeySchema = z.enum(MEASUREMENT_DEFINITIONS.map((d) => d.key));

/** Lookup by key. Built once — the catalog is immutable at runtime. */
export const measurementByKey = new Map<MeasurementKey, MeasurementSeed>(
  MEASUREMENT_DEFINITIONS.map((d) => [d.key, d]),
);

export const measurementDefinitionSchema = z.object({
  key: measurementKeySchema,
  label: z.string(),
  category: measurementCategorySchema,
  unit: measurementUnitSchema,
  minValue: z.number().int(),
  maxValue: z.number().int(),
  helpText: z.string().nullable(),
  sortOrder: z.number().int(),
});
export type MeasurementDefinition = z.infer<typeof measurementDefinitionSchema>;

export const measurementDefinitionListSchema = z.object({
  data: z.array(measurementDefinitionSchema),
});
export type MeasurementDefinitionList = z.infer<typeof measurementDefinitionListSchema>;
