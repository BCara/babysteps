import { describe, expect, it } from 'vitest';
import type { BabyEvent } from '../../src/services/firebase/events';
import {
  ageWakeWindow,
  observedWakeWindows,
  recommendNextSleep,
} from '../../src/utils/sleepRecommendation';

const now = new Date('2026-09-26T12:00:00Z');
const minutesBefore = (minutes: number) =>
  new Date(now.getTime() - minutes * 60_000);

const sleep = (startMinutesAgo: number, endMinutesAgo: number | null): BabyEvent => ({
  type: 'sleep',
  startTime: minutesBefore(startMinutesAgo),
  endTime: endMinutesAgo === null ? null : minutesBefore(endMinutesAgo),
  source: 'app',
  loggedBy: 'test',
});

/** Naps of 40 minutes with `gap` minutes awake between them, oldest last. */
const napsEvery = (gap: number, count: number) => {
  const events: BabyEvent[] = [];
  let cursor = 60;
  for (let index = 0; index < count; index += 1) {
    events.push(sleep(cursor + 40, cursor));
    cursor += 40 + gap;
  }
  return events;
};

describe('ageWakeWindow', () => {
  it('lengthens the window as the baby gets older', () => {
    expect(ageWakeWindow(2).typical).toBeLessThan(ageWakeWindow(12).typical);
    expect(ageWakeWindow(12).typical).toBeLessThan(ageWakeWindow(30).typical);
    expect(ageWakeWindow(30).typical).toBeLessThan(ageWakeWindow(60).typical);
  });

  it('holds the oldest band open for any age beyond the table', () => {
    expect(ageWakeWindow(500).typical).toBe(ageWakeWindow(200).typical);
  });
});

describe('observedWakeWindows', () => {
  it('measures the gap from one sleep ending to the next beginning', () => {
    const events = [sleep(200, 160), sleep(100, 60)];
    expect(observedWakeWindows(events, now)).toEqual([60]);
  });

  it('ignores overnight gaps and forgotten timers', () => {
    const events = [sleep(1000, 900), sleep(100, 60)];
    expect(observedWakeWindows(events, now)).toEqual([]);
  });

  it('ignores sleeps that never ended', () => {
    const events = [sleep(200, 160), sleep(100, null)];
    expect(observedWakeWindows(events, now)).toEqual([]);
  });

  it('only looks back as far as it is asked to', () => {
    // Enough naps to span several days, or both windows catch the same set.
    const events = napsEvery(90, 30);
    expect(observedWakeWindows(events, now, 14).length).toBeGreaterThan(
      observedWakeWindows(events, now, 1).length,
    );
  });
});

describe('recommendNextSleep', () => {
  const dateOfBirth = new Date('2026-08-01T00:00:00Z');

  it('says nothing while a sleep is running', () => {
    const result = recommendNextSleep({
      dateOfBirth,
      events: [sleep(30, null)],
      now,
    });
    expect(result.state).toBe('asleep');
  });

  it('says nothing before there is a finished sleep to measure from', () => {
    expect(recommendNextSleep({ dateOfBirth, events: [], now }).state).toBe(
      'unknown',
    );
  });

  it('falls back to the age band when the baby has no history', () => {
    const result = recommendNextSleep({
      dateOfBirth,
      events: [sleep(100, 60)],
      now,
    });
    if (result.state !== 'due') throw new Error('expected a recommendation');
    expect(result.basis).toBe('age');
    // Roughly eight weeks old, so the 60-90 minute band.
    expect(result.typicalMinutes).toBe(ageWakeWindow(8).typical);
  });

  it('moves toward this baby once there are windows to learn from', () => {
    const shortNapper = recommendNextSleep({
      dateOfBirth,
      events: napsEvery(40, 14),
      now,
    });
    if (shortNapper.state !== 'due') throw new Error('expected a recommendation');
    expect(shortNapper.basis).toBe('personal');
    // Well below the 75-minute age band, because this baby's own gaps are 40.
    expect(shortNapper.typicalMinutes).toBeLessThan(55);
    expect(shortNapper.typicalMinutes).toBeGreaterThan(40);
  });

  it('weighs a thin history against the age band rather than trusting it', () => {
    const thin = recommendNextSleep({
      dateOfBirth,
      events: napsEvery(40, 4),
      now,
    });
    const rich = recommendNextSleep({
      dateOfBirth,
      events: napsEvery(40, 20),
      now,
    });
    if (thin.state !== 'due' || rich.state !== 'due') {
      throw new Error('expected recommendations');
    }
    expect(thin.basis).toBe('learning');
    expect(thin.typicalMinutes).toBeGreaterThan(rich.typicalMinutes);
  });

  it('offers a window around the estimate, not a single minute', () => {
    const result = recommendNextSleep({
      dateOfBirth,
      events: napsEvery(60, 12),
      now,
    });
    if (result.state !== 'due') throw new Error('expected a recommendation');
    expect(result.to.getTime()).toBeGreaterThan(result.from.getTime());
    const centre = result.awakeSince.getTime() + result.typicalMinutes * 60_000;
    expect(centre - result.from.getTime()).toBe(result.to.getTime() - centre);
  });

  it('counts the wake window from when the baby last woke', () => {
    const result = recommendNextSleep({
      dateOfBirth,
      events: [sleep(100, 60)],
      now,
    });
    if (result.state !== 'due') throw new Error('expected a recommendation');
    expect(result.awakeSince).toEqual(minutesBefore(60));
  });
});
