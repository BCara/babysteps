import { describe, expect, it } from 'vitest';
import { formatNursingDate } from '../../src/components/nursing/startTime';

const now = new Date(2026, 8, 27, 17, 0);

describe('formatNursingDate', () => {
  it('leaves the year off a date in the current year', () => {
    const text = formatNursingDate(new Date(2026, 8, 27), now);
    expect(text).not.toMatch(/2026/);
    expect(text).toMatch(/27/);
  });

  it('keeps the year on a date from another year', () => {
    expect(formatNursingDate(new Date(2025, 11, 31), now)).toMatch(/2025/);
  });
});
