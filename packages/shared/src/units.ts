/**
 * Canonical storage is SI: lengths in millimetres, masses in grams, both integers.
 * Conversion happens only at the display edge. Nothing in the database or on the
 * wire is ever "centimetres" or "pounds" — that avoids the entire class of bugs
 * where a value's unit depends on who wrote it.
 */

export const MM_PER_CM = 10;
export const MM_PER_INCH = 25.4;
export const GRAMS_PER_KG = 1000;
export const GRAMS_PER_POUND = 453.59237;
export const DECIDEGREES_PER_DEGREE = 10;
export const DECIMILLIMETRES_PER_MM = 10;

export type UnitSystem = 'metric' | 'imperial';

const round = (value: number, decimals: number): number => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

// --- length ---
export const mmToCm = (mm: number): number => round(mm / MM_PER_CM, 1);
export const cmToMm = (cm: number): number => Math.round(cm * MM_PER_CM);
export const mmToInches = (mm: number): number => round(mm / MM_PER_INCH, 2);
export const inchesToMm = (inches: number): number => Math.round(inches * MM_PER_INCH);

// --- mass ---
export const gramsToKg = (grams: number): number => round(grams / GRAMS_PER_KG, 1);
export const kgToGrams = (kg: number): number => Math.round(kg * GRAMS_PER_KG);
export const gramsToPounds = (grams: number): number => round(grams / GRAMS_PER_POUND, 1);
export const poundsToGrams = (pounds: number): number => Math.round(pounds * GRAMS_PER_POUND);

/** Height for display, e.g. `182.5 cm` or `5'11.9"`. */
export function formatHeight(mm: number | null | undefined, system: UnitSystem = 'metric'): string {
  if (mm == null) return '—';
  if (system === 'metric') return `${mmToCm(mm)} cm`;

  const totalInches = mm / MM_PER_INCH;
  const feet = Math.floor(totalInches / 12);
  const inches = round(totalInches - feet * 12, 1);
  return `${feet}'${inches}"`;
}

/** Weight for display, e.g. `74.5 kg` or `164.2 lb`. */
export function formatWeight(
  grams: number | null | undefined,
  system: UnitSystem = 'metric',
): string {
  if (grams == null) return '—';
  return system === 'metric' ? `${gramsToKg(grams)} kg` : `${gramsToPounds(grams)} lb`;
}

// --- angle ---
// Angles are stored as tenths of a degree so the "integers only" rule holds for
// every measurement, with no floating-point exception to remember.
export const decidegreesToDegrees = (decidegrees: number): number =>
  round(decidegrees / DECIDEGREES_PER_DEGREE, 1);
export const degreesToDecidegrees = (degrees: number): number =>
  Math.round(degrees * DECIDEGREES_PER_DEGREE);

// --- sub-millimetre lengths ---
// Cranks and similar parts come in half-millimetre steps, so those measurements are
// stored in tenths of a millimetre rather than rounded to whole ones.
export const decimillimetresToMm = (decimillimetres: number): number =>
  round(decimillimetres / DECIMILLIMETRES_PER_MM, 1);
export const mmToDecimillimetres = (mm: number): number =>
  Math.round(mm * DECIMILLIMETRES_PER_MM);

/**
 * A catalog measurement for display, dispatched on its stored unit.
 *
 * Fit measurements read in millimetres, not centimetres: a saddle height is "735mm"
 * on every fit sheet in every studio. That is why this is separate from
 * formatHeight, which renders a rider's body height in cm where cm is what people
 * say. Angles are degrees everywhere.
 */
export function formatMeasurement(
  value: number | null | undefined,
  unit: 'MM' | 'DECIMILLIMETRE' | 'DECIDEGREE' | 'GRAM',
  system: UnitSystem = 'metric',
): string {
  if (value == null) return '—';
  switch (unit) {
    case 'MM':
      return system === 'metric' ? `${value} mm` : `${mmToInches(value)}"`;
    case 'DECIMILLIMETRE':
      return system === 'metric'
        ? `${decimillimetresToMm(value)} mm`
        : `${mmToInches(value / DECIMILLIMETRES_PER_MM)}"`;
    case 'DECIDEGREE':
      return `${decidegreesToDegrees(value)}°`;
    case 'GRAM':
      return formatWeight(value, system);
  }
}
