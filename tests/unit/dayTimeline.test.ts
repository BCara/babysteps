import { describe, expect, it } from 'vitest';
import type { BabyEvent, BabyEventType } from '../../src/services/firebase/events';
import {
  blockHeight,
  canDragPlaced,
  canResizePlaced,
  clampDragDelta,
  dragDeltaMinutes,
  draggedEventTimes,
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

describe('nursing blocks', () => {
  it('draws a nursing feed by its time on the breast, not its timer span', () => {
    const day = new Date(2026, 8, 28);
    const start = new Date(2026, 8, 28, 3, 18);
    const [placed] = placeEvents(
      [
        {
          type: 'feed',
          startTime: start,
          endTime: new Date(2026, 8, 28, 6, 18),
          durationMinutes: 180,
          metadata: {
            feedType: 'breast',
            leftBreastDurationSeconds: 6 * 60,
            rightBreastDurationSeconds: 0,
          },
          source: 'app',
          loggedBy: 'test',
        },
      ],
      day,
      new Date(2026, 8, 28, 21, 0),
    );
    expect(placed.spanMinutes).toBe(6);
    expect(placed.endTime).toEqual(new Date(2026, 8, 28, 3, 24));
  });
});

describe('dragging blocks on the day timeline', () => {
  const evening = new Date(2026, 8, 9, 23, 0);
  const sleep = event('s1', 'sleep', at(13), { endTime: at(14, 30) });
  const placedSleep = () => placeEvents([sleep], day, evening)[0];

  it('snaps a drag to five-minute marks', () => {
    expect(dragDeltaMinutes(minutesToOffset(12))).toBe(10);
    expect(dragDeltaMinutes(minutesToOffset(13))).toBe(15);
    expect(dragDeltaMinutes(-minutesToOffset(31))).toBe(-30);
  });

  it('moves the whole block, keeping its length', () => {
    expect(draggedEventTimes(placedSleep(), 'move', 45)).toEqual({
      startTime: at(13, 45),
      endTime: at(15, 15),
    });
  });

  it('resizes by stretching the end only', () => {
    expect(draggedEventTimes(placedSleep(), 'resize', -30)).toEqual({
      endTime: at(14),
    });
    const timed = event('p1', 'pumping', at(9), {
      endTime: at(9, 20),
      durationMinutes: 20,
    });
    expect(
      draggedEventTimes(placeEvents([timed], day, evening)[0], 'resize', 10),
    ).toEqual({ endTime: at(9, 30), durationMinutes: 30 });
  });

  it('keeps a move on the day and out of the future', () => {
    const item = placedSleep();
    expect(clampDragDelta(item, 'move', -24 * 60, day, evening)).toBe(-13 * 60);
    // Ninety minutes long, so it can end no later than 11pm "now".
    expect(clampDragDelta(item, 'move', 24 * 60, day, evening)).toBe(8 * 60 + 30);
  });

  it('never resizes a block below five minutes', () => {
    expect(clampDragDelta(placedSleep(), 'resize', -200, day, evening)).toBe(-85);
  });

  it('only lifts finished blocks that start on the shown day', () => {
    expect(canDragPlaced(placedSleep(), day)).toBe(true);
    const overnight = event('s2', 'sleep', new Date(2026, 8, 8, 22), {
      endTime: at(5),
    });
    expect(canDragPlaced(placeEvents([overnight], day, evening)[0], day)).toBe(false);
    const running = event('s3', 'sleep', at(20));
    expect(canDragPlaced(placeEvents([running], day, evening)[0], day)).toBe(false);
  });

  it('only offers a resize edge on timed, non-nursing blocks', () => {
    expect(canResizePlaced(placedSleep())).toBe(true);
    const nappy = event('d1', 'diaper', at(8), { endTime: at(8) });
    expect(canResizePlaced(placeEvents([nappy], day, evening)[0])).toBe(false);
    const nursing = event('f1', 'feed', at(7), {
      endTime: at(7, 20),
      metadata: { feedType: 'breast', leftBreastDurationSeconds: 600 },
    });
    expect(canResizePlaced(placeEvents([nursing], day, evening)[0])).toBe(false);
  });
});
