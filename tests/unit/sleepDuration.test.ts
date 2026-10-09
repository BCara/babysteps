import { describe, expect, it } from 'vitest';
import { sleepTimesForDuration } from '../../src/utils/sleepEntry';

const now = new Date('2026-09-27T18:00:00Z');

describe('sleepTimesForDuration', () => {
  it('moves the woke-up time when the sleep fits before now', () => {
    const start = new Date('2026-09-27T14:00:00Z');
    const result = sleepTimesForDuration(start, 90, now);
    expect(result.startTime).toEqual(start);
    expect(result.endTime).toEqual(new Date('2026-09-27T15:30:00Z'));
  });

  it('walks the start back instead of ending in the future', () => {
    const start = new Date('2026-09-27T17:30:00Z');
    const result = sleepTimesForDuration(start, 90, now);
    expect(result.endTime).toEqual(now);
    expect(result.startTime).toEqual(new Date('2026-09-27T16:30:00Z'));
  });

  it('treats ending exactly now as fitting', () => {
    const start = new Date('2026-09-27T16:30:00Z');
    const result = sleepTimesForDuration(start, 90, now);
    expect(result.startTime).toEqual(start);
    expect(result.endTime).toEqual(now);
  });
});
