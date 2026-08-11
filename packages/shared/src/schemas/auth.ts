import { z } from 'zod';
import { roleSchema } from './common.js';

export const loginSchema = z.object({
  email: z.email().max(255),
  password: z.string().min(1, 'Password is required').max(200),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const currentUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  role: roleSchema,
  organization: z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
  }),
});
export type CurrentUser = z.infer<typeof currentUserSchema>;
