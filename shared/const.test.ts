import { describe, it, expect } from 'vitest';
import { COOKIE_NAME, ONE_YEAR_MS } from './const';

describe('shared constants', () => {
  it('exports COOKIE_NAME', () => {
    expect(COOKIE_NAME).toBe('app_session_id');
  });

  it('exports ONE_YEAR_MS with correct value', () => {
    expect(ONE_YEAR_MS).toBe(1000 * 60 * 60 * 24 * 365);
    expect(ONE_YEAR_MS).toBe(31536000000);
  });
});
