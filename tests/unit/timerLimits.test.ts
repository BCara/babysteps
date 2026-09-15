import { describe, expect, it } from 'vitest';
import type { BabyEvent } from '../../src/services/firebase/events';
import {
  TIMER_LIMIT_MINUTES,
  cappedTimerEnd,
  isLimitedTimer,
  timerDeadline,
  timerLimitLabel,
} from '../../src/utils/timerLimits';

const event = (type: BabyEvent['type'], startTime = new Date('2026-08-12T08:00:00+10:00')): BabyEvent => ({
  type,
  startTime,
  endTime: null,
  source: 'app',
  loggedBy: 'caregiver',
});

describe('timer safety limits', () => {
  it('sets distinct caps for feed, pumping and sleep', () => {
    expect(TIMER_LIMIT_MINUTES).toEqual({ feed: 180, pumping: 120, sleep: 1080 });
    expect(timerDeadline(event('feed'))?.toISOString()).toBe('2026-08-12T01:00:00.000Z');
    expect(timerDeadline(event('pumping'))?.toISOString()).toBe('2026-08-12T00:00:00.000Z');
    expect(timerDeadline(event('sleep'))?.toISOString()).toBe('2026-08-12T16:00:00.000Z');
  });

  it('caps an overdue stop at the deadline but preserves an earlier manual stop', () => {
    const feed = event('feed');
    expect(cappedTimerEnd(feed, new Date('2026-08-12T12:00:00+10:00'))).toEqual(
      new Date('2026-08-12T11:00:00+10:00'),
    );
    expect(cappedTimerEnd(feed, new Date('2026-08-12T09:00:00+10:00'))).toEqual(
      new Date('2026-08-12T09:00:00+10:00'),
    );
  });

  it('does not treat instant care records as timers', () => {
    expect(isLimitedTimer(event('temperature'))).toBe(false);
    expect(timerDeadline(event('temperature'))).toBeNull();
    expect(timerLimitLabel(180)).toBe('3 hours');
  });
});
