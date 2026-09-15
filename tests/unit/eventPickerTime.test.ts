import { describe, expect, it } from 'vitest';
import { resolveEventPickerTime } from '../../src/utils/eventEditing';

const now = new Date(2026, 8, 14, 2, 0);
const selected = (hour: number, minute = 0) => new Date(2026, 8, 14, hour, minute);

describe('past activity time entry', () => {
  it('uses yesterday at 21:00 when the current time is 02:00', () => {
    const result = resolveEventPickerTime(now, selected(21), 'time', false, now);
    expect(result).toEqual(new Date(2026, 8, 13, 21, 0));
    expect(now).toEqual(new Date(2026, 8, 14, 2, 0));
  });
  it('keeps an earlier or equal clock time on today', () => {
    expect(resolveEventPickerTime(now, selected(1), 'time', false, now)).toEqual(selected(1));
    expect(resolveEventPickerTime(now, selected(2), 'time', false, now)).toEqual(selected(2));
  });
  it('preserves a previously selected historical date', () => {
    const historical = new Date(2026, 8, 10, 2, 0);
    expect(resolveEventPickerTime(historical, selected(21), 'time', false, now))
      .toEqual(new Date(2026, 8, 10, 21, 0));
  });
  it('does not change an explicitly selected date or a future appointment time', () => {
    expect(resolveEventPickerTime(selected(21), now, 'date', false, now)).toEqual(selected(21));
    expect(resolveEventPickerTime(now, selected(21), 'time', true, now)).toEqual(selected(21));
  });
  it('rolls correctly across month and year boundaries', () => {
    const january = new Date(2026, 0, 1, 2, 0);
    expect(resolveEventPickerTime(january, selected(21, 15), 'time', false, january))
      .toEqual(new Date(2025, 11, 31, 21, 15));
  });
});
