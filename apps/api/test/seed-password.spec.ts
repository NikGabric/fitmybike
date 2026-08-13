import { describe, expect, it } from 'vitest';
import { DEFAULT_SEED_PASSWORD, resolveSeedPassword } from '../prisma/seed-password';

describe('resolveSeedPassword', () => {
  it('falls back to the development default when SEED_PASSWORD is unset', () => {
    expect(resolveSeedPassword({})).toBe(DEFAULT_SEED_PASSWORD);
  });

  it('uses SEED_PASSWORD when it is set', () => {
    expect(resolveSeedPassword({ SEED_PASSWORD: 'a-real-password' })).toBe('a-real-password');
  });

  // An empty or whitespace-only value in a .env file is a mistake, not an intent to
  // use "" as a password — treat it as unset rather than seeding an account whose
  // password is a single space.
  it('treats a blank SEED_PASSWORD as unset', () => {
    expect(resolveSeedPassword({ SEED_PASSWORD: '   ' })).toBe(DEFAULT_SEED_PASSWORD);
  });

  it('does not trim a password that has meaningful surrounding characters', () => {
    expect(resolveSeedPassword({ SEED_PASSWORD: ' pad ded ' })).toBe('pad ded');
  });
});
