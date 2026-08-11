import { describe, expect, it } from 'vitest';
import type { Customer } from '@fitmybike/shared';
import {
  customerFormSchema,
  emptyCustomerForm,
  toApiPayload,
  toFormValues,
} from '@/pages/customer-form-schema';

const customer: Customer = {
  id: 'c1',
  firstName: 'Marko',
  lastName: 'Horvat',
  email: 'marko@example.com',
  phone: '+385 91 234 5678',
  dateOfBirth: '1988-04-12',
  heightMm: 1810,
  weightGrams: 78_500,
  notes: 'Numbness in left hand.',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('unit conversion at the form boundary', () => {
  it('shows millimetres as centimetres and grams as kilograms', () => {
    const values = toFormValues(customer);
    expect(values.heightCm).toBe('181');
    expect(values.weightKg).toBe('78.5');
  });

  it('converts back to canonical SI units on submit', () => {
    const payload = toApiPayload(toFormValues(customer));
    expect(payload.heightMm).toBe(1810);
    expect(payload.weightGrams).toBe(78_500);
  });

  it('round-trips without drifting', () => {
    const payload = toApiPayload(toFormValues(customer));
    expect(payload.heightMm).toBe(customer.heightMm);
    expect(payload.weightGrams).toBe(customer.weightGrams);
  });

  it('maps nulls to blank fields and back to null', () => {
    const sparse: Customer = {
      ...customer,
      email: null,
      phone: null,
      dateOfBirth: null,
      heightMm: null,
      weightGrams: null,
      notes: null,
    };

    const values = toFormValues(sparse);
    expect(values).toMatchObject({ email: '', heightCm: '', weightKg: '', notes: '' });

    const payload = toApiPayload(values);
    expect(payload).toMatchObject({
      email: null,
      phone: null,
      dateOfBirth: null,
      heightMm: null,
      weightGrams: null,
      notes: null,
    });
  });
});

describe('customerFormSchema', () => {
  it('accepts a blank optional numeric field', () => {
    const result = customerFormSchema.safeParse({
      ...emptyCustomerForm,
      firstName: 'A',
      lastName: 'B',
    });
    expect(result.success).toBe(true);
  });

  it('requires first and last name', () => {
    const result = customerFormSchema.safeParse(emptyCustomerForm);
    expect(result.success).toBe(false);

    const fields = result.success ? [] : result.error.issues.map((i) => i.path[0]);
    expect(fields).toContain('firstName');
    expect(fields).toContain('lastName');
  });

  it('rejects a height outside the plausible range', () => {
    const result = customerFormSchema.safeParse({
      ...emptyCustomerForm,
      firstName: 'A',
      lastName: 'B',
      heightCm: '20',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('between 100 and 250 cm');
    }
  });

  it('rejects a malformed email but allows an empty one', () => {
    const base = { ...emptyCustomerForm, firstName: 'A', lastName: 'B' };
    expect(customerFormSchema.safeParse({ ...base, email: 'not-an-email' }).success).toBe(false);
    expect(customerFormSchema.safeParse({ ...base, email: '' }).success).toBe(true);
  });
});
