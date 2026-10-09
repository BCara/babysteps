import { describe, expect, it } from 'vitest';
import { timelineSectionLabel } from '../../src/utils/timelineSections';

const now = new Date(2026, 8, 17, 21, 30);

describe('timelineSectionLabel', () => {
  it('names the current day Today and keeps its weekday in the subtitle', () => {
    const label = timelineSectionLabel(new Date(2026, 8, 17, 3, 15), now);
    expect(label.title).toBe('Today');
    expect(label.subtitle).toMatch(/Thu/);
    expect(label.subtitle).toMatch(/Sep/);
  });

  it('names the day before Yesterday, whatever the clock times', () => {
    expect(timelineSectionLabel(new Date(2026, 8, 16, 23, 59), now).title).toBe(
      'Yesterday',
    );
    expect(timelineSectionLabel(new Date(2026, 8, 16, 0, 1), now).title).toBe(
      'Yesterday',
    );
  });

  it('names older days by weekday and drops the weekday from the subtitle', () => {
    const label = timelineSectionLabel(new Date(2026, 8, 14), now);
    expect(label.title).toBe('Monday');
    expect(label.subtitle).not.toMatch(/Mon/);
  });

  it('adds the year once the day falls outside the current one', () => {
    expect(timelineSectionLabel(new Date(2025, 11, 30), now).subtitle).toMatch(
      /2025/,
    );
  });

  it('treats a future day as a named weekday rather than Today', () => {
    expect(timelineSectionLabel(new Date(2026, 8, 18), now).title).toBe('Friday');
  });
});
