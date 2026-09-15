import { describe, expect, it } from 'vitest';
import {
  MAX_SLEEP_ENTRY_MINUTES,
  checkSleepEntry,
  parseSleepDurationMinutes,
  sleepMinutesBetween,
  sleepStartFromDuration,
  updateSleepEntry,
  type SleepTimeField,
} from '../../src/utils/sleepEntry';

const at = (iso: string) => new Date(iso);
const now = at('2026-09-08T12:00:00.000Z');

describe('sleep entry times', () => {
  it('reads the duration back from a start and end time', () => {
    expect(
      sleepMinutesBetween(
        at('2026-09-08T09:15:00.000Z'),
        at('2026-09-08T10:45:00.000Z'),
      ),
    ).toBe(90);
  });

  it('walks the start time back when a duration is typed', () => {
    expect(
      sleepStartFromDuration(at('2026-09-08T11:00:00.000Z'), 45),
    ).toEqual(at('2026-09-08T10:15:00.000Z'));
  });

  it('ignores durations that are blank or not a positive number', () => {
    expect(parseSleepDurationMinutes('')).toBeUndefined();
    expect(parseSleepDurationMinutes('  ')).toBeUndefined();
    expect(parseSleepDurationMinutes('abc')).toBeUndefined();
    expect(parseSleepDurationMinutes('0')).toBeUndefined();
    expect(parseSleepDurationMinutes('-5')).toBeUndefined();
    expect(parseSleepDurationMinutes('90')).toBe(90);
  });

  it('saves a duration that matches the times it was entered with', () => {
    const checked = checkSleepEntry(
      {
        startTime: at('2026-09-08T09:00:00.000Z'),
        endTime: at('2026-09-08T11:30:00.000Z'),
      },
      now,
    );

    expect(checked.error).toBeUndefined();
    expect(checked.times).toEqual({
      startTime: at('2026-09-08T09:00:00.000Z'),
      endTime: at('2026-09-08T11:30:00.000Z'),
      durationMinutes: 150,
    });
  });

  it('rejects an end time that has not happened yet', () => {
    expect(
      checkSleepEntry(
        {
          startTime: at('2026-09-08T11:00:00.000Z'),
          endTime: at('2026-09-08T13:00:00.000Z'),
        },
        now,
      ).error,
    ).toBe('Choose an end time that is not in the future.');
  });

  it('rejects a sleep that ends before or when it started', () => {
    expect(
      checkSleepEntry(
        {
          startTime: at('2026-09-08T10:00:00.000Z'),
          endTime: at('2026-09-08T09:00:00.000Z'),
        },
        now,
      ).error,
    ).toBe('The sleep needs to end after it started.');
    expect(
      checkSleepEntry(
        {
          startTime: at('2026-09-08T10:00:00.000Z'),
          endTime: at('2026-09-08T10:00:00.000Z'),
        },
        now,
      ).error,
    ).toBe('The sleep needs to end after it started.');
  });

  it('holds a manual sleep to the same ceiling as the sleep timer', () => {
    const startTime = new Date(
      now.getTime() - (MAX_SLEEP_ENTRY_MINUTES + 1) * 60_000,
    );

    expect(checkSleepEntry({ startTime, endTime: now }, now).error).toBe(
      'Sleep can be at most 18 hours.',
    );
    expect(
      checkSleepEntry(
        {
          startTime: new Date(now.getTime() - MAX_SLEEP_ENTRY_MINUTES * 60_000),
          endTime: now,
        },
        now,
      ).times?.durationMinutes,
    ).toBe(MAX_SLEEP_ENTRY_MINUTES);
  });
});

describe('manual sleep input combinations', () => {
  const initial = { startTime: at('2026-09-08T09:00:00Z'), endTime: at('2026-09-08T12:00:00Z'), duration: '180' };
  it.each([
    ['start', at('2026-09-08T10:00:00Z'), 'duration', '60'],
    ['duration', '60', 'start', at('2026-09-08T10:00:00Z')],
    ['end', at('2026-09-08T11:00:00Z'), 'duration', '60'],
    ['duration', '60', 'end', at('2026-09-08T11:00:00Z')],
    ['start', at('2026-09-08T10:00:00Z'), 'end', at('2026-09-08T11:00:00Z')],
    ['end', at('2026-09-08T11:00:00Z'), 'start', at('2026-09-08T10:00:00Z')],
  ])('calculates from %s followed by %s', (first, firstValue, second, secondValue) => {
    const a = updateSleepEntry(initial, [], first as SleepTimeField, firstValue);
    const b = updateSleepEntry(a, a.order, second as SleepTimeField, secondValue);
    expect(b.startTime).toEqual(at('2026-09-08T10:00:00Z'));
    expect(b.endTime).toEqual(at('2026-09-08T11:00:00Z'));
    expect(b.duration).toBe('60');
  });
  it('keeps the start anchored across repeated duration edits and midnight', () => {
    const a = updateSleepEntry(initial, [], 'start', at('2026-09-08T23:30:00Z'));
    const b = updateSleepEntry(a, a.order, 'duration', '60');
    const c = updateSleepEntry(b, b.order, 'duration', '90');
    expect(c.startTime).toEqual(a.startTime);
    expect(c.endTime).toEqual(at('2026-09-09T01:00:00Z'));
  });
});
