import { describe, expect, it } from 'vitest';
import type { BabyEvent } from '../../src/services/firebase/events';
import { buildQuickCareWidgetSnapshots } from '../../src/utils/widgetSnapshots';

const event = (overrides: Partial<BabyEvent>): BabyEvent => ({
  type: 'sleep',
  startTime: new Date('2026-08-18T00:00:00.000Z'),
  endTime: new Date('2026-08-18T01:00:00.000Z'),
  source: 'app',
  loggedBy: 'caregiver',
  ...overrides,
});

describe('buildQuickCareWidgetSnapshots', () => {
  it('builds one snapshot for every configurable widget action', () => {
    const snapshots = buildQuickCareWidgetSnapshots([], new Date('2026-08-18T02:00:00.000Z'));

    expect(snapshots).toHaveLength(17);
    expect(snapshots.map(snapshot => snapshot.key)).toContain('nursing');
    expect(snapshots.map(snapshot => snapshot.key)).toContain('immunization');
  });

  it('exposes persisted nursing totals and the active-side clock separately', () => {
    const snapshots = buildQuickCareWidgetSnapshots(
      [
        event({
          type: 'feed',
          endTime: null,
          metadata: {
            feedType: 'breast',
            breastSide: 'left',
            lastBreastSide: 'left',
            breastSideStartedAtMs: new Date('2026-08-18T01:58:00.000Z').getTime(),
            leftBreastDurationSeconds: 30,
            rightBreastDurationSeconds: 45,
          },
        }),
      ],
      new Date('2026-08-18T02:00:00.000Z'),
    );

    expect(snapshots.find(snapshot => snapshot.key === 'nursing')).toMatchObject({
      active: true,
      activeSide: 'left',
      summary: 'Left side active',
      leftSeconds: 30,
      rightSeconds: 45,
      activeSideStartedAtMs: new Date('2026-08-18T01:58:00.000Z').getTime(),
    });
  });

  it('shows last-care details for inactive cards', () => {
    const snapshots = buildQuickCareWidgetSnapshots(
      [
        event({
          type: 'diaper',
          startTime: new Date('2026-08-18T01:30:00.000Z'),
          endTime: new Date('2026-08-18T01:30:00.000Z'),
          metadata: {
            diaperCondition: 'both',
            wetDiaperAmount: 'heavy',
            dirtyDiaperAmount: 'light',
          },
        }),
      ],
      new Date('2026-08-18T02:00:00.000Z'),
    );

    expect(snapshots.find(snapshot => snapshot.key === 'diaper')).toMatchObject({
      active: false,
      summary: '30m ago',
      detail: 'Wet + dirty · Wet: Heavy · Dirty: Light',
    });
  });

  it('includes the provider and location in appointment snapshots', () => {
    const snapshots = buildQuickCareWidgetSnapshots(
      [
        event({
          type: 'appointment',
          metadata: {
            appointmentType: 'Paediatric review',
            provider: 'Dr Nguyen',
            appointmentLocation: 'Children\'s clinic',
          },
        }),
      ],
      new Date('2026-08-18T02:00:00.000Z'),
    );

    expect(snapshots.find(snapshot => snapshot.key === 'appointment')).toMatchObject({
      detail: 'Paediatric review · Dr Nguyen · Children\'s clinic',
    });
  });

  it('labels a scheduled appointment as upcoming instead of just logged', () => {
    const snapshots = buildQuickCareWidgetSnapshots(
      [
        event({
          type: 'appointment',
          startTime: new Date(2026, 7, 20, 4, 30),
          endTime: new Date(2026, 7, 20, 5, 15),
          metadata: { appointmentType: 'Paediatric review' },
        }),
      ],
      new Date(2026, 7, 18, 2, 0),
    );

    expect(snapshots.find(snapshot => snapshot.key === 'appointment')?.summary)
      .toMatch(/^Upcoming 20 Aug,/);
  });

  it('includes the provider and optional location in immunisation snapshots', () => {
    const snapshots = buildQuickCareWidgetSnapshots(
      [
        event({
          type: 'immunization',
          metadata: {
            immunization: 'Influenza vaccine',
            provider: 'Community Health Clinic',
            immunizationLocation: 'Immunisation room 2',
          },
        }),
      ],
      new Date('2026-08-18T02:00:00.000Z'),
    );

    expect(snapshots.find(snapshot => snapshot.key === 'immunization')).toMatchObject({
      detail: 'Influenza vaccine · Community Health Clinic · Immunisation room 2',
    });
  });
});
