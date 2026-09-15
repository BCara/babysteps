import { describe, expect, it } from 'vitest';
import {
  canShowInterstitial,
  INTERSTITIAL_MIN_INTERVAL_MS,
} from '../../src/utils/interstitialFrequency';

describe('interstitial frequency', () => {
  const now = Date.UTC(2026, 6, 30, 12);

  it('allows the first eligible interstitial', () => {
    expect(canShowInterstitial(null, now)).toBe(true);
  });

  it('blocks another interstitial for 24 hours', () => {
    expect(canShowInterstitial(String(now - 60 * 60 * 1000), now)).toBe(false);
    expect(
      canShowInterstitial(
        String(now - INTERSTITIAL_MIN_INTERVAL_MS + 1),
        now,
      ),
    ).toBe(false);
  });

  it('allows another interstitial after 24 hours', () => {
    expect(
      canShowInterstitial(String(now - INTERSTITIAL_MIN_INTERVAL_MS), now),
    ).toBe(true);
  });
});
