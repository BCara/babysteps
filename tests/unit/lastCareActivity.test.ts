import { describe, expect, it } from 'vitest';
import type { BabyEvent } from '../../src/services/firebase/events';
import { homeCareActions } from '../../src/constants/careActions';
import { lastActivityAgo, lastCareActivity } from '../../src/utils/lastCareActivity';

const now = new Date('2026-09-14T12:00:00Z');
const event = (type: BabyEvent['type'], time: string, metadata?: BabyEvent['metadata']): BabyEvent => ({
  type, startTime: new Date(time), endTime: null, metadata, source: 'app', loggedBy: 'test',
});

describe('last activity in care headers', () => {
  // Built from the reader's own locale, so the expectation is too rather than
  // pinning the suite to whichever timezone it happens to run in.
  const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  it('gives the clock time and the gap since', () => {
    expect(lastActivityAgo(new Date('2026-09-14T08:38:00Z'), now)).toBe(`${clock('2026-09-14T08:38:00Z')} · 3h 22m ago`);
    expect(lastActivityAgo(new Date('2026-09-14T11:38:00Z'), now)).toBe(`${clock('2026-09-14T11:38:00Z')} · 22m ago`);
    expect(lastActivityAgo(new Date('2026-09-14T09:00:00Z'), now)).toBe(`${clock('2026-09-14T09:00:00Z')} · 3h ago`);
    expect(lastActivityAgo(now, now)).toBe(`${clock('2026-09-14T12:00:00Z')} · Just now`);
  });
  it('leads with something clock-shaped, whatever the locale makes of it', () => {
    expect(lastActivityAgo(new Date('2026-09-14T08:38:00Z'), now)).toMatch(/^\d{1,2}[:.]\d{2}/);
  });
  it('keeps nursing and bottle history separate', () => {
    const nursing = event('feed', '2026-09-14T08:00:00Z', { feedType: 'breast' });
    const bottle = event('feed', '2026-09-14T10:00:00Z', { feedType: 'bottle' });
    expect(lastCareActivity([bottle, nursing], 'mother-nurse', now)).toBe(nursing);
    expect(lastCareActivity([nursing, bottle], 'baby-bottle-outline', now)).toBe(bottle);
  });
  it.each(homeCareActions.filter(action => !['nursing', 'bottle'].includes(action.type)))('finds the latest $label regardless of list order', action => {
    const type = action.type as BabyEvent['type'];
    const older = event(type, '2026-09-13T08:00:00Z');
    const latest = event(type, '2026-09-14T10:00:00Z');
    const future = event(type, '2026-09-15T10:00:00Z');
    expect(lastCareActivity([future, older, latest, event(type, 'invalid')], action.icon, now)).toBe(latest);
  });
  it('has no last entry when none exists for the activity', () => {
    expect(lastCareActivity([event('sleep', '2026-09-14T10:00:00Z')], 'water-outline', now)).toBeNull();
  });
});
