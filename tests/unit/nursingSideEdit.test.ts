import { describe, expect, it } from 'vitest';
import type { BabyEventMetadata } from '../../src/services/firebase/events';
import {
  breastDurationsAt,
  setNursingSideSeconds,
} from '../../src/utils/breastFeed';

const now = Date.UTC(2026, 8, 28, 17, 22, 0);
const start = new Date(now - 32 * 60_000);

/** Left ran for 31m 12s, and right has been running for the last 16s. */
const rightRunning: BabyEventMetadata = {
  feedType: 'breast',
  breastSide: 'both',
  breastSidesUsed: ['left', 'right'],
  lastBreastSide: 'right',
  leftBreastDurationSeconds: 31 * 60 + 12,
  rightBreastDurationSeconds: 0,
  breastSideStartedAtMs: now - 16_000,
};

describe('setNursingSideSeconds', () => {
  it('corrects the idle side and leaves the running side counting', () => {
    const { metadata } = setNursingSideSeconds(rightRunning, 'left', 600, start, now);
    const later = breastDurationsAt(metadata, now + 10_000);
    expect(later.leftBreastDurationSeconds).toBe(600);
    expect(later.rightBreastDurationSeconds).toBe(26);
  });

  it('corrects the running side and keeps it running from the new figure', () => {
    const { metadata } = setNursingSideSeconds(rightRunning, 'right', 300, start, now);
    expect(breastDurationsAt(metadata, now).rightBreastDurationSeconds).toBe(300);
    expect(breastDurationsAt(metadata, now + 5_000).rightBreastDurationSeconds).toBe(305);
    expect(metadata.lastBreastSide).toBe('right');
  });

  it('keeps the start when the corrected total still fits', () => {
    const result = setNursingSideSeconds(rightRunning, 'left', 600, start, now);
    expect(result.startTime).toEqual(start);
  });

  it('moves the start back when the sides add up to more than the feed', () => {
    const result = setNursingSideSeconds(rightRunning, 'left', 60 * 60, start, now);
    expect(result.startTime.getTime()).toBe(now - (60 * 60 + 16) * 1000);
  });

  it('drops a side from the sides used when it is set to nothing', () => {
    const { metadata } = setNursingSideSeconds(rightRunning, 'left', 0, start, now);
    expect(metadata.breastSidesUsed).toEqual(['right']);
    expect(metadata.breastSide).toBe('right');
  });
});
