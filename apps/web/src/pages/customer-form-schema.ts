import { z } from 'zod';
import { cmToMm, gramsToKg, kgToGrams, mmToCm, type Customer } from '@fitmybike/shared';

/**
 * The form talks centimetres and kilograms because that is what a fitter writes on
 * a sheet. The API only ever sees millimetres and grams. Conversion lives here, at
 * the boundary, and nowhere else.
 *
 * Text fields are strings. The measurement fields accept string OR number, because
 * Vue applies number casting to `v-model` on `<input type="number">` implicitly —
 * a bare z.string() there rejects every value the user types with "expected string,
 * received number". Clearing the input yields '' again, hence the union.
 *
 * z.coerce is avoided throughout: it infers an `unknown` input type, which poisons
 * the form bindings.
 */
const numericField = (min: number, max: number, message: string) =>
  z
    .union([z.string(), z.number()])
    .refine((value) => {
      if (value === '') return true;
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed >= min && parsed <= max;
    }, message);

export const customerFormSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(100),
  lastName: z.string().trim().min(1, 'Last name is required').max(100),
  email: z.union([z.literal(''), z.email('Enter a valid email address').max(255)]),
  phone: z.string().trim().max(40),
  dateOfBirth: z.union([z.literal(''), z.iso.date('Enter a valid date')]),
  heightCm: numericField(100, 250, 'Height must be between 100 and 250 cm'),
  weightKg: numericField(30, 250, 'Weight must be between 30 and 250 kg'),
  notes: z.string().max(5000),
});

export type CustomerFormValues = z.infer<typeof customerFormSchema>;

/** Exactly what the API accepts — canonical SI units, nulls rather than blanks. */
export interface CustomerApiPayload {
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  dateOfBirth: string | null;
  heightMm: number | null;
  weightGrams: number | null;
  notes: string | null;
}

export const emptyCustomerForm: CustomerFormValues = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  dateOfBirth: '',
  heightCm: '',
  weightKg: '',
  notes: '',
};

export function toFormValues(customer: Customer): CustomerFormValues {
  return {
    firstName: customer.firstName,
    lastName: customer.lastName,
    email: customer.email ?? '',
    phone: customer.phone ?? '',
    dateOfBirth: customer.dateOfBirth ?? '',
    heightCm: customer.heightMm === null ? '' : String(mmToCm(customer.heightMm)),
    weightKg: customer.weightGrams === null ? '' : String(gramsToKg(customer.weightGrams)),
    notes: customer.notes ?? '',
  };
}

export function toApiPayload(values: CustomerFormValues): CustomerApiPayload {
  return {
    firstName: values.firstName,
    lastName: values.lastName,
    email: values.email === '' ? null : values.email,
    phone: values.phone === '' ? null : values.phone,
    dateOfBirth: values.dateOfBirth === '' ? null : values.dateOfBirth,
    heightMm: values.heightCm === '' ? null : cmToMm(Number(values.heightCm)),
    weightGrams: values.weightKg === '' ? null : kgToGrams(Number(values.weightKg)),
    notes: values.notes === '' ? null : values.notes,
  };
}
