import {
  decidegreesToDegrees,
  decimillimetresToMm,
  degreesToDecidegrees,
  gramsToKg,
  kgToGrams,
  mmToDecimillimetres,
  type MeasurementUnit,
} from '@fitmybike/shared';

/**
 * The conversion boundary for fit measurements, the counterpart to
 * customer-form-schema.ts.
 *
 * A fitter types the number they read off a tape or a goniometer — 735, 172.5, 7.5 —
 * and the API only ever sees canonical integers. Everything about that translation
 * lives here and nowhere else.
 *
 * Lengths are typed in millimetres, not centimetres, because that is what a fit
 * sheet says. The only sub-integer cases are angles and the handful of parts sold in
 * half-millimetre steps, both of which are stored as tenths.
 */

/** The stored integer, as the number a fitter should see in the input. */
export function toDisplayValue(stored: number, unit: MeasurementUnit): number {
  switch (unit) {
    case 'MM':
      return stored;
    case 'DECIMILLIMETRE':
      return decimillimetresToMm(stored);
    case 'DECIDEGREE':
      return decidegreesToDegrees(stored);
    case 'GRAM':
      return gramsToKg(stored);
  }
}

/** The number a fitter typed, as the integer the API stores. */
export function toStoredValue(display: number, unit: MeasurementUnit): number {
  switch (unit) {
    case 'MM':
      return Math.round(display);
    case 'DECIMILLIMETRE':
      return mmToDecimillimetres(display);
    case 'DECIDEGREE':
      return degreesToDecidegrees(display);
    case 'GRAM':
      return kgToGrams(display);
  }
}

/** The suffix shown beside an input. */
export function unitLabel(unit: MeasurementUnit): string {
  switch (unit) {
    case 'MM':
    case 'DECIMILLIMETRE':
      return 'mm';
    case 'DECIDEGREE':
      return '°';
    case 'GRAM':
      return 'kg';
  }
}

/** Input step: whole numbers where the unit is whole, tenths where it is not. */
export function unitStep(unit: MeasurementUnit): string {
  return unit === 'MM' ? '1' : '0.1';
}

/**
 * A definition's stored bounds expressed in display units, for client-side range
 * checking. The API re-checks against the catalog regardless — this only spares the
 * fitter a round trip.
 */
export function displayBounds(
  unit: MeasurementUnit,
  minValue: number,
  maxValue: number,
): { min: number; max: number } {
  return { min: toDisplayValue(minValue, unit), max: toDisplayValue(maxValue, unit) };
}

/** Parses what is in the input. `''` means "not set", which the API spells `null`. */
export function parseEntry(raw: string | number, unit: MeasurementUnit): number | null {
  if (raw === '' || raw === null) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? toStoredValue(parsed, unit) : null;
}
