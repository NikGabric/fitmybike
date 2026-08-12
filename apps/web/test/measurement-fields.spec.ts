import { describe, expect, it } from 'vitest';
import {
  displayBounds,
  parseEntry,
  toDisplayValue,
  toStoredValue,
  unitLabel,
  unitStep,
} from '@/lib/measurement-fields';

describe('measurement display conversion', () => {
  it('passes whole millimetres straight through', () => {
    expect(toDisplayValue(735, 'MM')).toBe(735);
    expect(toStoredValue(735, 'MM')).toBe(735);
  });

  it('renders tenths of a millimetre as the half sizes cranks actually come in', () => {
    expect(toDisplayValue(1725, 'DECIMILLIMETRE')).toBe(172.5);
    expect(toStoredValue(172.5, 'DECIMILLIMETRE')).toBe(1725);
  });

  it('renders tenths of a degree as degrees', () => {
    expect(toDisplayValue(75, 'DECIDEGREE')).toBe(7.5);
    expect(toStoredValue(7.5, 'DECIDEGREE')).toBe(75);
  });

  it('handles negative values, which setback and drop both take', () => {
    expect(toDisplayValue(-25, 'MM')).toBe(-25);
    expect(toStoredValue(-1.5, 'DECIDEGREE')).toBe(-15);
  });

  it('round-trips every unit without drift', () => {
    const cases = [
      [735, 'MM'],
      [1725, 'DECIMILLIMETRE'],
      [-150, 'DECIDEGREE'],
      [74_500, 'GRAM'],
    ] as const;

    for (const [stored, unit] of cases) {
      expect(toStoredValue(toDisplayValue(stored, unit), unit)).toBe(stored);
    }
  });
});

describe('parseEntry', () => {
  // Vue number-casts v-model on <input type="number">, so the same field yields a
  // string on one render and a number on the next. Both must work.
  it('accepts what the fitter typed as either a string or a number', () => {
    expect(parseEntry('172.5', 'DECIMILLIMETRE')).toBe(1725);
    expect(parseEntry(172.5, 'DECIMILLIMETRE')).toBe(1725);
  });

  it('treats an empty field as "not set" rather than zero', () => {
    expect(parseEntry('', 'MM')).toBeNull();
  });

  it('rejects nonsense rather than storing NaN', () => {
    expect(parseEntry('abc', 'MM')).toBeNull();
  });

  it('rounds a stray decimal on a whole-millimetre measurement', () => {
    expect(parseEntry('735.4', 'MM')).toBe(735);
  });
});

describe('field presentation', () => {
  it('labels sub-millimetre measurements in millimetres, not tenths', () => {
    expect(unitLabel('MM')).toBe('mm');
    expect(unitLabel('DECIMILLIMETRE')).toBe('mm');
    expect(unitLabel('DECIDEGREE')).toBe('°');
  });

  it('steps in tenths only where the stored unit is a tenth', () => {
    expect(unitStep('MM')).toBe('1');
    expect(unitStep('DECIMILLIMETRE')).toBe('0.1');
    expect(unitStep('DECIDEGREE')).toBe('0.1');
  });

  it('converts stored bounds into the numbers shown beside the input', () => {
    expect(displayBounds('DECIMILLIMETRE', 1500, 1850)).toEqual({ min: 150, max: 185 });
    expect(displayBounds('MM', 500, 950)).toEqual({ min: 500, max: 950 });
  });
});
