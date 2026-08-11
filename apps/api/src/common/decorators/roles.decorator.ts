import { SetMetadata } from '@nestjs/common';
import type { Role } from '@prisma/client';

export const ROLES_KEY = 'fmb:roles';

/** Restrict a route to the given roles. Requires RolesGuard, applied globally. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
