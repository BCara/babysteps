import { describe, expect, it } from 'vitest';
import { isNightHour, resolveNursingMode } from '../../src/utils/nightMode';

const at = (hour: number, minute = 0) => new Date(2026, 8, 10, hour, minute);

describe('app appearance', () => {
  it.each([0, 6, 7, 12, 20, 21, 23])('honours manual choices at %i:00', hour => {
    expect(resolveNursingMode({ preference: 'standard', now: at(hour) })).toBe('standard');
    expect(resolveNursingMode({ preference: 'night', now: at(hour) })).toBe('night');
  });
  it.each([
    [0, 0, 'night'], [6, 59, 'night'], [7, 0, 'standard'],
    [12, 0, 'standard'], [20, 59, 'standard'], [21, 0, 'night'], [23, 59, 'night'],
  ] as const)('Auto at %i:%i uses %s', (hour, minute, expected) => {
    expect(resolveNursingMode({ preference: 'auto', now: at(hour, minute) })).toBe(expected);
    expect(isNightHour(at(hour, minute))).toBe(expected === 'night');
  });
});
