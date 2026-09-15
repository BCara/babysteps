import { describe, expect, it } from 'vitest';
import { BabyEvent } from '../../src/services/firebase/events';
import {
  eventsInSummaryPeriod,
  getEventDurationMinutes,
  isSameLocalDay,
  summarizeEvents,
} from '../../src/utils/eventSummary';

const baseEvent = (
  overrides: Partial<BabyEvent>,
): BabyEvent => ({
  type: 'feed',
  startTime: new Date('2026-07-28T08:00:00+10:00'),
  endTime: new Date('2026-07-28T08:10:00+10:00'),
  source: 'app',
  loggedBy: 'caregiver-1',
  ...overrides,
});

describe('event summaries', () => {
  it('counts feeds, nappies and completed sleep', () => {
    const events = [
      baseEvent({ type: 'feed' }),
      baseEvent({ type: 'feed' }),
      baseEvent({ type: 'diaper' }),
      baseEvent({
        type: 'sleep',
        startTime: new Date('2026-07-28T09:00:00+10:00'),
        endTime: new Date('2026-07-28T10:30:00+10:00'),
      }),
    ];

    expect(summarizeEvents(events)).toEqual({
      feeds: 2,
      diapers: 1,
      sleepMinutes: 90,
      activeSleeps: 0,
    });
  });

  it('does not include an active sleep in the completed total by default', () => {
    const event = baseEvent({
      type: 'sleep',
      startTime: new Date('2026-07-28T09:00:00+10:00'),
      endTime: null,
    });
    const now = new Date('2026-07-28T10:00:00+10:00');

    expect(summarizeEvents([event], false, now).sleepMinutes).toBe(0);
    expect(summarizeEvents([event], true, now).sleepMinutes).toBe(60);
    expect(summarizeEvents([event], true, now).activeSleeps).toBe(1);
  });

  it('prefers a stored duration when present', () => {
    const event = baseEvent({
      type: 'sleep',
      durationMinutes: 42,
      startTime: new Date('2026-07-28T09:00:00+10:00'),
      endTime: new Date('2026-07-28T10:30:00+10:00'),
    });

    expect(getEventDurationMinutes(event)).toBe(42);
  });

  it('compares dates in local calendar time', () => {
    expect(
      isSameLocalDay(
        new Date('2026-07-28T01:00:00+10:00'),
        new Date('2026-07-28T23:00:00+10:00'),
      ),
    ).toBe(true);
    expect(
      isSameLocalDay(
        new Date('2026-07-28T23:00:00+10:00'),
        new Date('2026-07-29T01:00:00+10:00'),
      ),
    ).toBe(false);
  });

  it('distinguishes today from the rolling last 24 hours', () => {
    const now = new Date(2026, 8, 2, 3, 59);
    const yesterdayEvening = baseEvent({
      startTime: new Date(2026, 8, 1, 20, 0),
    });
    const today = baseEvent({
      startTime: new Date(2026, 8, 2, 2, 0),
    });
    const tooOld = baseEvent({
      startTime: new Date(2026, 8, 1, 3, 58),
    });

    expect(eventsInSummaryPeriod([yesterdayEvening, today, tooOld], 'today', now))
      .toEqual([today]);
    expect(
      eventsInSummaryPeriod(
        [yesterdayEvening, today, tooOld],
        'last24Hours',
        now,
      ),
    ).toEqual([yesterdayEvening, today]);
  });
});
