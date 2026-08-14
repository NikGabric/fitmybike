/**
 * How hard someone may hammer the login endpoint from one address.
 *
 * Counts **every** attempt, not just failures. Counting only failures would let an
 * attacker who has one working credential keep probing the rest of the space for free,
 * and it makes the limit depend on the outcome of the thing being limited.
 *
 * Applied only to `login` — deliberately not global. The fit wizard autosaves on a
 * debounce *and* on blur, so a global limit of this size would refuse ordinary use.
 *
 * The counter is in-process. One API container makes that exact; running replicas would
 * multiply the effective limit by the replica count, at which point this needs a shared
 * store (Redis) rather than a bigger number.
 */
export const LOGIN_RATE_LIMIT = {
  /** Window, in milliseconds. */
  ttl: 60_000,
  /** Attempts permitted per address per window. */
  limit: 5,
} as const;
