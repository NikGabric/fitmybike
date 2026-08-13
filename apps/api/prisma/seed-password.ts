/**
 * The password every account the seed creates is given.
 *
 * Kept in its own module because importing `seed.ts` runs it: the seed executes on
 * import, so a test cannot reach this logic without writing to a database.
 */

/** Used when SEED_PASSWORD is unset. Fine for local development, not for a public URL. */
export const DEFAULT_SEED_PASSWORD = 'changeme123';

export function resolveSeedPassword(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env['SEED_PASSWORD']?.trim();
  return configured ? configured : DEFAULT_SEED_PASSWORD;
}
