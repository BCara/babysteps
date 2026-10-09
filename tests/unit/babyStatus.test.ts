import { describe, expect, it } from 'vitest';
import type { BabyEvent } from '../../src/services/firebase/events';
import { babyStatus } from '../../src/utils/babyStatus';

const now = new Date('2026-10-05T12:00:00Z');
const event = (
  type: BabyEvent['type'],
  start: string,
  end: string | null = null,
  metadata?: BabyEvent['metadata'],
): BabyEvent => ({
  type, startTime: new Date(start), endTime: end ? new Date(end) : null, metadata, source: 'app', loggedBy: 'test',
});

describe('baby status on Home', () => {
  it('shows a running sleep first', () => {
    const status = babyStatus({
      name: 'Ada', events: [], activeSleep: event('sleep', '2026-10-05T11:15:00Z'), now,
    });
    expect(status.pose).toBe('sleep');
    expect(status.title).toBe('Ada is asleep');
    expect(status.detail).toMatch(/45m$/);
  });

  it('tells breast and bottle feeds apart', () => {
    expect(babyStatus({
      name: 'Ada', events: [], activeFeed: event('feed', '2026-10-05T11:50:00Z', null, { feedType: 'breast' }), now,
    }).pose).toBe('breastfeed');
    expect(babyStatus({
      name: 'Ada', events: [], activeFeed: event('feed', '2026-10-05T11:50:00Z', null, { feedType: 'bottle' }), now,
    }).pose).toBe('bottle');
  });

  it('shows pumping when nothing else is running', () => {
    expect(babyStatus({
      name: 'Ada', events: [], activePumping: event('pumping', '2026-10-05T11:50:00Z'), now,
    }).pose).toBe('pumping');
  });

  it('counts awake time from the last sleep and adds the last feed', () => {
    const status = babyStatus({
      name: 'Ada',
      events: [
        event('sleep', '2026-10-05T09:00:00Z', '2026-10-05T10:30:00Z'),
        event('feed', '2026-10-05T10:40:00Z', '2026-10-05T11:00:00Z'),
      ],
      now,
    });
    expect(status).toEqual({ pose: 'awake', title: 'Ada is awake', detail: 'Awake for 1h 30m · Fed 1h ago' });
  });

  it('shows a measurement straight after it is logged', () => {
    const status = babyStatus({
      name: 'Ada',
      events: [event('growth', '2026-10-05T11:50:00Z', null, { weightKg: 6.8, heightCm: 62 })],
      now,
    });
    expect(status).toEqual({ pose: 'measurement', title: 'Ada was measured', detail: '6.8 kg · 62 cm · 10m ago' });
  });

  it('lets a recent entry settle back to awake after 45 minutes', () => {
    expect(babyStatus({
      name: 'Ada', events: [event('bath', '2026-10-05T11:30:00Z')], now,
    }).pose).toBe('bath');
    expect(babyStatus({
      name: 'Ada', events: [event('bath', '2026-10-05T11:00:00Z')], now,
    }).pose).toBe('awake');
  });

  it('ignores entries logged ahead of time', () => {
    expect(babyStatus({
      name: 'Ada', events: [event('appointment', '2026-10-05T15:00:00Z')], now,
    }).pose).toBe('hello');
  });

  it('does not let care logged during a nap hide that the baby has since woken', () => {
    expect(babyStatus({
      name: 'Ada',
      events: [
        event('diaper', '2026-10-05T11:20:00Z'),
        event('sleep', '2026-10-05T11:00:00Z', '2026-10-05T11:40:00Z'),
      ],
      now,
    }).pose).toBe('awake');
  });

  it('greets a baby with nothing logged yet', () => {
    expect(babyStatus({ name: 'Ada', events: [], now }).pose).toBe('hello');
  });
});
