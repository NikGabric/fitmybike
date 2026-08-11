import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'fmb:isPublic';

/** Opt a route out of the globally applied AuthGuard. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
