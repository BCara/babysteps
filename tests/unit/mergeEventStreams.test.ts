import { describe, expect, it } from 'vitest';
import { mergeEventStreams } from '../../src/utils/mergeEventStreams';
import type { BabyEvent } from '../../src/services/firebase/events';

const event = (
  id: string,
  type: BabyEvent['type'],
  startTime: string,
  updatedAt?: string,
): BabyEvent => ({
  id,
  type,
  startTime: new Date(startTime),
  endTime: null,
  source: 'app',
  loggedBy: 'caregiver',
  ...(updatedAt ? { updatedAt: new Date(updatedAt) } : {}),
});

describe('merging the recent and reference event streams', () => {
  it('keeps a reference record that falls outside the recent window', () => {
    const recent = [
      event('feed-1', 'feed', '2026-09-05T06:00:00Z'),
      event('feed-2', 'feed', '2026-08-22T00:28:00Z'),
    ];
    const reference = [event('growth-1', 'growth', '2026-08-21T04:00:00Z')];

    expect(mergeEventStreams(recent, reference).map(item => item.id)).toEqual([
      'feed-1',
      'feed-2',
      'growth-1',
    ]);
  });

  it('de-duplicates records present in both streams and keeps the newest copy', () => {
    const stale = event('growth-1', 'growth', '2026-08-21T04:00:00Z', '2026-08-21T04:00:00Z');
    const fresh = event('growth-1', 'growth', '2026-08-21T04:00:00Z', '2026-09-01T09:00:00Z');
    fresh.notes = 'Reviewed at the six week check';

    const merged = mergeEventStreams([stale], [fresh]);

    expect(merged).toHaveLength(1);
    expect(merged[0].notes).toBe('Reviewed at the six week check');
  });

  it('orders every stream by start time, newest first', () => {
    const merged = mergeEventStreams(
      [event('b', 'feed', '2026-09-02T10:00:00Z')],
      [
        event('a', 'appointment', '2026-09-04T10:00:00Z'),
        event('c', 'growth', '2026-07-01T10:00:00Z'),
      ],
    );

    expect(merged.map(item => item.id)).toEqual(['a', 'b', 'c']);
  });
});
