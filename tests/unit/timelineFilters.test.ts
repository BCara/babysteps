import { describe, expect, it } from 'vitest';
import type { BabyEvent, BabyEventType } from '../../src/services/firebase/events';
import { filterTimelineEvents } from '../../src/utils/timelineFilters';

const event = (id: string, type: BabyEventType): BabyEvent => ({
  id,
  type,
  startTime: new Date('2026-08-22T10:00:00.000Z'),
  endTime: new Date('2026-08-22T10:00:00.000Z'),
  source: 'app',
  loggedBy: 'caregiver-1',
});

const events = [
  event('feed-1', 'feed'),
  event('growth-1', 'growth'),
  event('sleep-1', 'sleep'),
];

describe('timeline type filtering', () => {
  it('keeps the complete timeline when all activity is selected', () => {
    expect(filterTimelineEvents(events, 'all')).toEqual(events);
  });

  it('shows only the selected care type', () => {
    expect(filterTimelineEvents(events, 'growth')).toEqual([events[1]]);
  });
});
