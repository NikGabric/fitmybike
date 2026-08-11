import { createParamDecorator, type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import type { RequestUser } from '../types/request-user';

/**
 * Injects the authenticated user. Throws rather than returning undefined so
 * handlers can treat it as always present — on a @Public route it means the
 * decorator was used by mistake.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestUser => {
    const request = ctx.switchToHttp().getRequest<Request>();
    if (!request.user) {
      throw new UnauthorizedException('No authenticated user on this request');
    }
    return request.user;
  },
);
