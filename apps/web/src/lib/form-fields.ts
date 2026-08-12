import { z } from 'zod';

/**
 * Shared building blocks for VeeValidate form schemas.
 *
 * Two traps live here so no individual form has to remember them:
 *
 * 1. Vue applies implicit number casting to `v-model` on `<input type="number">`.
 *    A bare `z.string()` therefore rejects everything the user types with
 *    "expected string, received number", which reads to a user as the form simply
 *    not submitting. Numeric fields must accept `string | number`. Clearing the
 *    input yields `''` again, hence the union with the empty string.
 *
 * 2. `z.coerce` infers an `unknown` input type, which poisons the form bindings —
 *    `defineField` ends up untyped. It is avoided throughout.
 */

/** A numeric form field: optional, bounded, and tolerant of Vue's number casting. */
export const numericField = (min: number, max: number, message: string) =>
  z.union([z.string(), z.number()]).refine((value) => {
    if (value === '') return true;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= min && parsed <= max;
  }, message);

/** `''` from an untouched field means "not set", which the API spells `null`. */
export const blankToNull = (value: string): string | null => (value === '' ? null : value);

/** Reads a numeric form field back out, converting with `toApi` when it has a value. */
export function numericToApi(
  value: string | number,
  toApi: (n: number) => number,
): number | null {
  return value === '' ? null : toApi(Number(value));
}
