import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { ZodValidationException } from 'nestjs-zod';

interface ZodIssueLike {
  path: Array<string | number>;
  message: string;
}

/**
 * nestjs-zod v5 types getZodError() as `unknown` because it supports both zod
 * majors. Narrowed structurally rather than with `instanceof ZodError`: that would
 * silently stop matching if the API and the shared package ever resolved to
 * separate physical copies of zod.
 */
function readZodIssues(error: unknown): ZodIssueLike[] {
  const issues = (error as { issues?: unknown } | null)?.issues;
  if (!Array.isArray(issues)) return [];
  return issues.filter(
    (issue): issue is ZodIssueLike =>
      typeof issue === 'object' &&
      issue !== null &&
      Array.isArray((issue as ZodIssueLike).path) &&
      typeof (issue as ZodIssueLike).message === 'string',
  );
}

/** The single error shape every endpoint returns. The web client relies on it. */
export interface ApiErrorBody {
  code: string;
  message: string;
  /** Field-level validation errors, keyed by dotted path. */
  details?: Record<string, string[]>;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, body } = this.toApiError(exception);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json(body);
  }

  private toApiError(exception: unknown): { status: number; body: ApiErrorBody } {
    if (exception instanceof ZodValidationException) {
      const details: Record<string, string[]> = {};
      for (const issue of readZodIssues(exception.getZodError())) {
        const key = issue.path.join('.') || '_';
        (details[key] ??= []).push(issue.message);
      }
      return {
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        body: { code: 'VALIDATION_FAILED', message: 'Validation failed', details },
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      // P2025 covers a cross-tenant update/delete too: forOrg() puts organizationId
      // in the where clause, so another org's row simply is not found.
      if (exception.code === 'P2025') {
        return {
          status: HttpStatus.NOT_FOUND,
          body: { code: 'NOT_FOUND', message: 'Resource not found' },
        };
      }
      if (exception.code === 'P2002') {
        return {
          status: HttpStatus.CONFLICT,
          body: { code: 'CONFLICT', message: 'That value is already taken' },
        };
      }
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      const message =
        typeof res === 'string'
          ? res
          : ((res as { message?: string | string[] }).message ?? exception.message);
      return {
        status,
        body: {
          code: this.codeForStatus(status),
          message: Array.isArray(message) ? message.join(', ') : message,
        },
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
    };
  }

  private codeForStatus(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'BAD_REQUEST';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return 'VALIDATION_FAILED';
      default:
        return status >= 500 ? 'INTERNAL_ERROR' : 'ERROR';
    }
  }
}
