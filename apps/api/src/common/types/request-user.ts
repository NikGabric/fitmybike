import type { Role } from '@prisma/client';

/** Attached to the request by AuthGuard once a session cookie is verified. */
export interface RequestUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  organizationId: string;
  organization: {
    id: string;
    name: string;
    slug: string;
  };
  sessionId: string;
}

declare module 'express' {
  interface Request {
    user?: RequestUser;
  }
}
