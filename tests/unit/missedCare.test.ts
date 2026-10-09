import { describe, expect, it } from 'vitest';
import type { BabyEvent } from '../../src/services/firebase/events';
import { findMissedCare } from '../../src/utils/missedCare';
import {
  QUIET_AFTER_DECLINES,
  acceptMissedCare,
  canSuggestMissedCare,
  declineMissedCare,
  initialMissedCarePromptState,
  parseMissedCarePromptState,
} from '../../src/utils/missedCarePrompts';

const now = new Date('2026-09-26T18:00:00Z');
const MINUTE = 60_000;
const at = (minutesAgo: number) => new Date(now.getTime() - minutesAgo * MINUTE);

let nextId = 0;
const sleep = (startAgo: number, endAgo: number): BabyEvent => ({
  id: `sleep-${nextId++}`,
  type: 'sleep',
  startTime: at(startAgo),
  endTime: at(endAgo),
  source: 'app',
  loggedBy: 'test',
});
const feed = (startAgo: number, minutes = 20): BabyEvent => ({
  id: `feed-${nextId++}`,
  type: 'feed',
  startTime: at(startAgo),
  endTime: at(startAgo - minutes),
  durationMinutes: minutes,
  source: 'app',
  loggedBy: 'test',
  metadata: { feedType: 'bottle', amount: 120, unit: 'ml' },
});

/**
 * Three-hour cycles back from now: a feed on waking, two hours awake, then a
 * one-hour sleep. `cycle` 0 is the most recent; its sleep ended 30 min ago.
 */
const CYCLE = 180;
const cycleSleep = (cycle: number) =>
  sleep(30 + cycle * CYCLE + 60, 30 + cycle * CYCLE);
const cycleFeed = (cycle: number) => feed(30 + cycle * CYCLE + 60 + 120 - 5);
const routine = (cycles: number, skip: { sleep?: number[]; feed?: number[] } = {}) => {
  const events: BabyEvent[] = [];
  for (let cycle = 0; cycle < cycles; cycle += 1) {
    if (!skip.sleep?.includes(cycle)) events.push(cycleSleep(cycle));
    if (!skip.feed?.includes(cycle)) events.push(cycleFeed(cycle));
  }
  return events;
};

describe('findMissedCare', () => {
  it('says nothing about a log that follows its usual rhythm', () => {
    expect(findMissedCare({ events: routine(24), now })).toBeNull();
  });

  it('suggests the sleep missing from an otherwise regular day', () => {
    const suggestion = findMissedCare({ events: routine(24, { sleep: [3] }), now });

    expect(suggestion?.kind).toBe('sleep');
    // The gap runs from the end of cycle 4's sleep to the start of cycle 2's.
    expect(suggestion?.gapStart).toEqual(cycleSleep(4).endTime);
    expect(suggestion?.gapEnd).toEqual(cycleSleep(2).startTime);
    expect(suggestion?.open).toBe(false);
    // Placed about where the baby usually goes down, as long as usual naps.
    expect(suggestion!.startTime.getTime()).toBeGreaterThan(suggestion!.gapStart.getTime());
    expect(suggestion!.endTime!.getTime()).toBeLessThan(suggestion!.gapEnd.getTime());
    expect(suggestion?.durationMinutes).toBe(60);
  });

  it('keeps a suggested sleep clear of a feed logged in the gap', () => {
    const suggestion = findMissedCare({ events: routine(24, { sleep: [3] }), now });
    const feeds = routine(24).filter(event => event.type === 'feed');
    for (const logged of feeds) {
      const overlaps =
        logged.startTime < suggestion!.endTime! && logged.endTime! > suggestion!.startTime;
      expect(overlaps).toBe(false);
    }
  });

  it('stays quiet until there is enough history to know what normal is', () => {
    expect(findMissedCare({ events: routine(5, { sleep: [2] }), now })).toBeNull();
  });

  it('stays quiet when long gaps are a habit of the log, not a slip', () => {
    // Every fourth sleep is never logged — a night nobody writes down, say.
    const habit = [3, 7, 11, 15, 19, 23];
    expect(findMissedCare({ events: routine(28, { sleep: habit }), now })).toBeNull();
  });

  it('never asks again about a gap that was answered', () => {
    const events = routine(24, { sleep: [3] });
    const first = findMissedCare({ events, now });
    expect(first).not.toBeNull();
    expect(
      findMissedCare({ events, now, isDismissed: key => key === first!.key }),
    ).toBeNull();
  });

  it('suggests a missed feed, carrying over the usual bottle', () => {
    const suggestion = findMissedCare({ events: routine(24, { feed: [3] }), now });

    expect(suggestion?.kind).toBe('feed');
    expect(suggestion?.feedType).toBe('bottle');
    expect(suggestion?.amount).toBe(120);
    expect(suggestion?.unit).toBe('ml');
    expect(suggestion!.startTime.getTime()).toBeGreaterThan(suggestion!.gapStart.getTime());
    expect(suggestion!.startTime.getTime()).toBeLessThan(suggestion!.gapEnd.getTime());
  });

  it('does not count time asleep towards a missed feed', () => {
    // A long logged sleep in place of a feed: the baby slept through it.
    const events = routine(24, { feed: [3], sleep: [3] });
    events.push(sleep(30 + 3 * CYCLE + 170, 30 + 3 * CYCLE - 50));
    expect(findMissedCare({ events, now })?.kind).not.toBe('feed');
  });

  it('only looks back a day', () => {
    // Cycle 10 is about 31 hours ago.
    expect(findMissedCare({ events: routine(24, { sleep: [10] }), now })).toBeNull();
  });
});

describe('missed care prompts', () => {
  const HOUR = 60 * MINUTE;
  const t = now.getTime();

  it('backs off further with each "no" in a row', () => {
    let state = declineMissedCare(initialMissedCarePromptState, 'a', t);
    expect(state.quietUntil).toBe(t + QUIET_AFTER_DECLINES[0]);
    state = declineMissedCare(state, 'b', t);
    expect(state.quietUntil).toBe(t + QUIET_AFTER_DECLINES[1]);
    state = declineMissedCare(state, 'c', t);
    state = declineMissedCare(state, 'd', t);
    expect(state.quietUntil).toBe(t + QUIET_AFTER_DECLINES[2]);
    expect(canSuggestMissedCare(state, t + 71 * HOUR)).toBe(false);
    expect(canSuggestMissedCare(state, t + 72 * HOUR)).toBe(true);
  });

  it('resets the back-off once a suggestion is taken up', () => {
    let state = declineMissedCare(initialMissedCarePromptState, 'a', t);
    state = declineMissedCare(state, 'b', t);
    state = acceptMissedCare(state, 'c');
    expect(state.declinesInARow).toBe(0);
    expect(state.answered).toEqual(['a', 'b', 'c']);
    expect(declineMissedCare(state, 'd', t).quietUntil).toBe(t + QUIET_AFTER_DECLINES[0]);
  });

  it('can be switched off', () => {
    expect(
      canSuggestMissedCare({ ...initialMissedCarePromptState, enabled: false }, t),
    ).toBe(false);
  });

  it('falls back to defaults for missing or damaged storage', () => {
    expect(parseMissedCarePromptState(null)).toEqual(initialMissedCarePromptState);
    expect(parseMissedCarePromptState('{oops')).toEqual(initialMissedCarePromptState);
    expect(parseMissedCarePromptState('{"enabled":false,"answered":["x",3]}')).toEqual({
      ...initialMissedCarePromptState,
      enabled: false,
      answered: ['x'],
    });
  });
});
