import { currentUserSchema, loginSchema } from '@fitmybike/shared';
import { createZodDto } from 'nestjs-zod';

/**
 * DTOs are generated from the shared Zod schemas, so the rules the Vue form
 * enforces and the rules the API enforces are literally the same object.
 */
export class LoginDto extends createZodDto(loginSchema) {}
export class CurrentUserDto extends createZodDto(currentUserSchema) {}
