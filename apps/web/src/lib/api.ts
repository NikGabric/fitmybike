import createClient from 'openapi-fetch';
import type { paths } from '@fitmybike/shared/api';

/**
 * Types come from the API's own OpenAPI document (regenerate with `pnpm openapi`),
 * so a backend change that the frontend has not caught up with is a compile error
 * rather than a runtime surprise.
 *
 * No baseUrl: the API is same-origin in every environment. `credentials` is only
 * belt-and-braces — same-origin requests send cookies by default.
 */
export const api = createClient<paths>({ credentials: 'include' });

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: Record<string, string[]>;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    /** Field-level validation messages, keyed by the field name. */
    readonly details?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }
}

interface FetchResult<T> {
  data?: T;
  error?: unknown;
  response: Response;
}

/** Turns openapi-fetch's `{ data, error }` result into a value-or-throw. */
export async function unwrap<T>(request: Promise<FetchResult<T>>): Promise<T> {
  const { data, error, response } = await request;

  if (!response.ok) {
    const body = error as ApiErrorBody | undefined;
    throw new ApiError(
      response.status,
      body?.code ?? 'ERROR',
      body?.message ?? `Request failed with status ${response.status}`,
      body?.details,
    );
  }

  return data as T;
}
