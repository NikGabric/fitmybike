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
