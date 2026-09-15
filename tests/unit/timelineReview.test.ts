import { describe, expect, it } from 'vitest';
import { reviewTimeline } from '../../src/utils/timelineReview';
import type { BabyEvent } from '../../src/services/firebase/events';

const now = new Date('2026-09-13T12:00:00Z');
const at = (minutes: number) => new Date(now.getTime() + minutes * 60_000);
const event = (id: string, start: number, end: number | null, overrides: Partial<BabyEvent> = {}): BabyEvent => ({
  id, type: 'feed', startTime: at(start), endTime: end === null ? null : at(end),
  source: 'app', loggedBy: 'parent', metadata: { feedType: 'breast' }, ...overrides,
});

describe('timeline review prompts', () => {
  it.each([['feed', 90], ['pumping', 60], ['sleep', 720]] as const)(
    'flags %s above its review threshold, including running timers', (type, limit) => {
      expect(reviewTimeline([event('a', -limit, 0, { type })], now).size).toBe(0);
      expect(reviewTimeline([event('a', -limit - 1, 0, { type })], now).get('a')?.reasons).toHaveLength(1);
      expect(reviewTimeline([event('a', -limit - 1, null, { type })], now).get('a')?.reasons[0]).toContain(type === 'feed' ? 'Logged feeding time' : 'Timer running');
    },
  );
  it('checks recorded duration as well as the timestamp span', () => {
    expect(reviewTimeline([event('a', -5, 0, { durationMinutes: 95 })], now).get('a')?.reasons[0]).toContain('Logged feeding time');
  });
  it('distinguishes ten minutes of nursing from a long saved time span', () => {
    const reviews = reviewTimeline([event('a', -240, -10, {
      durationMinutes: 230,
      metadata: { feedType: 'breast', leftBreastDurationSeconds: 300, rightBreastDurationSeconds: 300 },
    })], now);
    expect(reviews.has('a')).toBe(false);
  });
  it('flags invalid timing without treating future appointments as errors', () => {
    const reviews = reviewTimeline([
      event('backwards', -5, -10), event('future', 10, 20),
      event('appointment', 10, 20, { type: 'appointment' }),
    ], now);
    expect(reviews.get('backwards')?.reasons).toContain('End time is before start time.');
    expect(reviews.has('future')).toBe(true);
    expect(reviews.has('appointment')).toBe(false);
  });
  it('suggests compatible completed pairs up to ten minutes apart, in either input order', () => {
    const a = event('a', -40, -30);
    const b = event('b', -20, -10, { metadata: { feedType: 'breast', breastSide: 'right' } });
    const reviews = reviewTimeline([b, a], now);
    expect(reviews.get('a')?.mergeWithId).toBe('b');
    expect(reviews.get('b')?.mergeWithId).toBe('a');
  });
  it('does not suggest merging running, distant, or different feed types', () => {
    for (const b of [event('b', -19, -10), event('b', -20, null),
      event('b', -20, -10, { metadata: { feedType: 'bottle' } })]) {
      expect(reviewTimeline([event('a', -40, -30), b], now).get('a')?.mergeWithId).toBeUndefined();
    }
  });
  it('flags overlaps instead of suggesting a merge that would double count duration', () => {
    const reviews = reviewTimeline([event('a', -40, -20), event('b', -30, -10)], now);
    expect(reviews.get('a')?.reasons[0]).toContain('Overlaps');
    expect(reviews.get('b')?.mergeWithId).toBeUndefined();
  });
  it('withdraws a pair if a later neighbour reveals overlapping timestamps', () => {
    const reviews = reviewTimeline([event('a', -50, -40), event('b', -35, -20), event('c', -30, -10)], now);
    expect(reviews.get('a')?.mergeWithId).toBeUndefined();
    expect(reviews.get('b')?.mergeWithId).toBeUndefined();
  });
  it('does not suggest combining sleep with different locations or an intervening feed', () => {
    const sleepA = event('a', -60, -30, { type: 'sleep', metadata: { sleepType: 'cot' } });
    const sleepB = event('b', -20, -10, { type: 'sleep', metadata: { sleepType: 'pram' } });
    expect(reviewTimeline([sleepA, sleepB], now).size).toBe(0);
    expect(reviewTimeline([sleepA, event('feed', -29, -21), { ...sleepB, metadata: sleepA.metadata }], now).size).toBe(0);
  });
  it('does not mutate input or include deleted entries', () => {
    const entries = [event('b', -20, -10), event('a', -40, -30, { deletedAt: now })];
    expect(reviewTimeline(entries, now).size).toBe(0);
    expect(entries.map(item => item.id)).toEqual(['b', 'a']);
  });
});
