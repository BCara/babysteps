import { describe, expect, it } from 'vitest';
import type { BabyEvent, BabyEventType } from '../../src/services/firebase/events';
import {
  blockHeight,
  formatBlockDuration,
  formatHourLabel,
  HOUR_HEIGHT,
  minutesToOffset,
  placeEvents,
  timelineEventTiming,
} from '../../src/utils/dayTimeline';

const day = new Date(2026, 8, 9);

const at = (hour: number, minute = 0) => new Date(2026, 8, 9, hour, minute);

const event = (
  id: string,
  type: BabyEventType,
  start: Date,
  options: Partial<BabyEvent> = {},
): BabyEvent => ({
  id,
  type,
  startTime: start,
  endTime: null,
  source: 'app',
  loggedBy: 'caregiver-1',
  ...options,
});

describe('day timeline placement', () => {
  it('sizes a block by how long the activity ran', () => {
    const [nap] = placeEvents(
      [event('nap', 'sleep', at(13), { endTime: at(13, 30) })],
      day,
    );

    expect(nap.startMinutes).toBe(13 * 60);
    expect(nap.spanMinutes).toBe(30);
    expect(blockHeight(nap.spanMinutes)).toBeCloseTo(HOUR_HEIGHT / 2 - 3);
    expect(minutesToOffset(nap.startMinutes)).toBe(13 * HOUR_HEIGHT);
  });

  it('gives an entry with no duration the readable minimum height', () => {
    const [nappy] = placeEvents([event('nappy', 'diaper', at(9, 20))], day);

    expect(nappy.spanMinutes).toBe(0);
    expect(nappy.endTime).toBeNull();
    expect(blockHeight(nappy.spanMinutes)).toBe(26);
  });

  it('keeps a lone entry full width and splits overlapping ones', () => {
    const placed = placeEvents(
      [
        event('sleep', 'sleep', at(2), { endTime: at(4) }),
        event('feed', 'feed', at(3), { durationMinutes: 20 }),
        event('bath', 'bath', at(18), { durationMinutes: 15 }),
      ],
      day,
    );
    const byId = Object.fromEntries(placed.map(item => [item.event.id, item]));

    expect(byId.sleep.laneCount).toBe(2);
    expect(byId.feed.laneCount).toBe(2);
    expect(byId.sleep.lane).toBe(0);
    expect(byId.feed.lane).toBe(1);
    expect(byId.bath.laneCount).toBe(1);
    expect(byId.bath.lane).toBe(0);
  });

  it('reuses a lane once the earlier entry has finished', () => {
    const placed = placeEvents(
      [
        event('first', 'feed', at(6), { durationMinutes: 30 }),
        event('second', 'feed', at(7), { durationMinutes: 30 }),
      ],
      day,
    );

    expect(placed.map(item => item.lane)).toEqual([0, 0]);
    expect(placed.map(item => item.laneCount)).toEqual([1, 1]);
  });

  it('clips an entry that runs past midnight', () => {
    const [overnight] = placeEvents(
      [event('overnight', 'sleep', at(23), { durationMinutes: 8 * 60 })],
      day,
    );

    expect(overnight.clipped).toBe(true);
    expect(overnight.spanMinutes).toBe(60);
    expect(overnight.durationMinutes).toBe(8 * 60);
  });

  it('describes a running sleep up to now', () => {
    const now = at(15, 45);
    const [running] = placeEvents(
      [event('running', 'sleep', at(15))],
      day,
      now,
    );

    expect(running.ongoing).toBe(true);
    expect(running.durationMinutes).toBe(45);
    expect(timelineEventTiming(running)).toContain('45m so far');
  });

  it('reads a moment as a single time and a block as a range', () => {
    const [moment] = placeEvents([event('nappy', 'diaper', at(9, 20))], day);
    const [block] = placeEvents(
      [event('nap', 'sleep', at(13), { endTime: at(14, 5) })],
      day,
    );

    expect(timelineEventTiming(moment)).not.toContain('–');
    expect(timelineEventTiming(block)).toContain('–');
    expect(timelineEventTiming(block)).toContain('1h 5m');
  });
});

describe('day timeline labels', () => {
  it('labels the hours either side of noon and midnight', () => {
    expect(formatHourLabel(0)).toBe('12am');
    expect(formatHourLabel(9)).toBe('9am');
    expect(formatHourLabel(12)).toBe('12pm');
    expect(formatHourLabel(21)).toBe('9pm');
    expect(formatHourLabel(24)).toBe('12am');
  });

  it('formats durations in minutes and hours', () => {
    expect(formatBlockDuration(25)).toBe('25m');
    expect(formatBlockDuration(60)).toBe('1h');
    expect(formatBlockDuration(95)).toBe('1h 35m');
  });
});
