import { describe, expect, it } from 'vitest';
import {
  formatElapsedMinutes,
  formatTimeSinceEvent,
  formatTimeSinceEventStart,
  formatTimerSeconds,
} from '../../src/utils/feedTiming';

describe('feed timing', () => {
  const now = new Date('2026-08-11T14:30:00+10:00');

  it('measures from the feed start time', () => {
    expect(
      formatTimeSinceEventStart(
        new Date('2026-08-11T12:15:00+10:00'),
        now,
      ),
    ).toBe('2h 15m');
  });

  it('shows minute and just-started states', () => {
    expect(
      formatTimeSinceEventStart(
        new Date('2026-08-11T14:25:00+10:00'),
        now,
      ),
    ).toBe('5m');
    expect(formatTimeSinceEventStart(now, now)).toBe('Just now');
  });

  it('does not display a negative duration for a future timestamp', () => {
    expect(
      formatTimeSinceEventStart(
        new Date('2026-08-11T14:31:00+10:00'),
        now,
      ),
    ).toBe('Just now');
  });

  it('measures completed event recency from when the event ended', () => {
    expect(
      formatTimeSinceEvent(
        {
          startTime: new Date('2026-08-11T12:15:00+10:00'),
          endTime: new Date('2026-08-11T14:00:00+10:00'),
        },
        now,
      ),
    ).toBe('30m');
  });

  it('measures feed recency from when the feed started', () => {
    expect(
      formatTimeSinceEvent(
        {
          startTime: new Date('2026-08-11T12:15:00+10:00'),
          endTime: new Date('2026-08-11T14:00:00+10:00'),
        },
        now,
        { fromStart: true },
      ),
    ).toBe('2h 15m');
  });

  it('formats a live timer with seconds', () => {
    expect(formatTimerSeconds(5)).toBe('00:05');
    expect(formatTimerSeconds(125)).toBe('02:05');
    expect(formatTimerSeconds(3665)).toBe('1:01:05');
  });

  it('formats elapsed durations as whole minutes', () => {
    expect(formatElapsedMinutes(5)).toBe('0m');
    expect(formatElapsedMinutes(125)).toBe('2m');
    expect(formatElapsedMinutes(3665)).toBe('1h 1m');
  });
});
