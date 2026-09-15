import { describe, expect, it } from 'vitest';
import {
  buildMergePlan,
  canMergeEvents,
  mergeBlocker,
} from '../../src/utils/mergeEvents';
import type { BabyEvent } from '../../src/services/firebase/events';

const event = (overrides: Partial<BabyEvent> & { id: string }): BabyEvent => ({
  type: 'feed',
  startTime: new Date('2026-08-13T09:00:00Z'),
  endTime: new Date('2026-08-13T09:12:00Z'),
  source: 'app',
  loggedBy: 'parent-1',
  ...overrides,
});

const nursing = (
  id: string,
  side: 'left' | 'right',
  seconds: number,
  startIso: string,
) =>
  event({
    id,
    startTime: new Date(startIso),
    endTime: new Date(new Date(startIso).getTime() + seconds * 1000),
    durationMinutes: Math.max(1, Math.round(seconds / 60)),
    metadata: {
      feedType: 'breast',
      breastSide: side,
      breastSidesUsed: [side],
      lastBreastSide: side,
      leftBreastDurationSeconds: side === 'left' ? seconds : 0,
      rightBreastDurationSeconds: side === 'right' ? seconds : 0,
    },
  });

describe('mergeBlocker', () => {
  it('needs at least two activities', () => {
    expect(mergeBlocker([nursing('a', 'left', 600, '2026-08-13T09:00:00Z')])).toBe(
      'Select two or more activities to merge.',
    );
  });

  it('rejects mixed activity types', () => {
    expect(
      mergeBlocker([
        nursing('a', 'left', 600, '2026-08-13T09:00:00Z'),
        event({ id: 'b', type: 'sleep' }),
      ]),
    ).toBe('Only activities of the same type can be merged.');
  });

  it('rejects a running timer', () => {
    expect(
      mergeBlocker([
        nursing('a', 'left', 600, '2026-08-13T09:00:00Z'),
        event({ id: 'b', endTime: null }),
      ]),
    ).toBe('Stop the running timer before merging.');
  });

  it('rejects nursing merged with a bottle', () => {
    expect(
      mergeBlocker([
        nursing('a', 'left', 600, '2026-08-13T09:00:00Z'),
        event({ id: 'b', metadata: { feedType: 'bottle', amount: 90, unit: 'ml' } }),
      ]),
    ).toBe('Nursing and bottle feeds cannot be merged together.');
  });

  it('rejects bottles recorded in different units', () => {
    expect(
      mergeBlocker([
        event({ id: 'a', metadata: { feedType: 'bottle', amount: 90, unit: 'ml' } }),
        event({ id: 'b', metadata: { feedType: 'bottle', amount: 3, unit: 'oz' } }),
      ]),
    ).toBe('Bottles must use the same unit to merge.');
  });

  it('rejects activity types where combining loses meaning', () => {
    expect(
      mergeBlocker([
        event({ id: 'a', type: 'growth', metadata: { weightKg: 5 } }),
        event({ id: 'b', type: 'growth', metadata: { weightKg: 5.2 } }),
      ]),
    ).toBe('Growth cannot be merged.');
  });

  it('allows two finished nursing sessions', () => {
    expect(
      canMergeEvents([
        nursing('a', 'left', 600, '2026-08-13T09:00:00Z'),
        nursing('b', 'right', 480, '2026-08-13T09:12:00Z'),
      ]),
    ).toBe(true);
  });
});

describe('buildMergePlan', () => {
  it('combines left and right nursing into one feed', () => {
    const plan = buildMergePlan([
      nursing('b', 'right', 480, '2026-08-13T09:12:00Z'),
      nursing('a', 'left', 600, '2026-08-13T09:00:00Z'),
    ]);

    expect(plan.targetId).toBe('a');
    expect(plan.removedIds).toEqual(['b']);
    expect(plan.updates.startTime).toEqual(new Date('2026-08-13T09:00:00Z'));
    expect(plan.updates.endTime).toEqual(new Date('2026-08-13T09:20:00Z'));
    expect(plan.updates.metadata).toMatchObject({
      feedType: 'breast',
      breastSide: 'both',
      breastSidesUsed: ['left', 'right'],
      lastBreastSide: 'right',
      leftBreastDurationSeconds: 600,
      rightBreastDurationSeconds: 480,
    });
    expect(plan.updates.durationMinutes).toBe(18);
  });

  it('keeps side totals when a nursing session was logged manually', () => {
    const plan = buildMergePlan([
      event({
        id: 'a',
        startTime: new Date('2026-08-13T09:00:00Z'),
        endTime: new Date('2026-08-13T09:10:00Z'),
        durationMinutes: 10,
        metadata: { feedType: 'breast', breastSide: 'left' },
      }),
      event({
        id: 'b',
        startTime: new Date('2026-08-13T09:10:00Z'),
        endTime: new Date('2026-08-13T09:15:00Z'),
        durationMinutes: 5,
        metadata: { feedType: 'breast', breastSide: 'right' },
      }),
    ]);

    expect(plan.updates.metadata).toMatchObject({
      breastSide: 'both',
      leftBreastDurationSeconds: 600,
      rightBreastDurationSeconds: 300,
    });
    expect(plan.updates.durationMinutes).toBe(15);
  });

  it('adds bottle amounts together', () => {
    const plan = buildMergePlan([
      event({
        id: 'a',
        durationMinutes: 8,
        metadata: { feedType: 'bottle', amount: 90, unit: 'ml' },
      }),
      event({
        id: 'b',
        startTime: new Date('2026-08-13T09:30:00Z'),
        endTime: new Date('2026-08-13T09:36:00Z'),
        durationMinutes: 6,
        metadata: { feedType: 'bottle', amount: 30, unit: 'ml' },
      }),
    ]);

    expect(plan.updates.metadata).toMatchObject({
      feedType: 'bottle',
      amount: 120,
      unit: 'ml',
    });
    expect(plan.updates.durationMinutes).toBe(14);
  });

  it('combines nappies into a wet and dirty change', () => {
    const plan = buildMergePlan([
      event({
        id: 'a',
        type: 'diaper',
        metadata: { diaperCondition: 'wet', diaperAmount: 'light' },
      }),
      event({
        id: 'b',
        type: 'diaper',
        startTime: new Date('2026-08-13T09:01:00Z'),
        endTime: new Date('2026-08-13T09:01:00Z'),
        metadata: { diaperCondition: 'dirty', diaperAmount: 'heavy' },
      }),
    ]);

    expect(plan.updates.metadata).toMatchObject({
      diaperCondition: 'both',
      wetDiaperAmount: 'light',
      dirtyDiaperAmount: 'heavy',
    });
    expect(plan.updates.metadata?.diaperAmount).toBeUndefined();
  });

  it('adds sleep segments together and keeps both notes', () => {
    const plan = buildMergePlan([
      event({
        id: 'a',
        type: 'sleep',
        durationMinutes: 40,
        notes: 'Fussy start',
        metadata: { sleepType: 'nap' },
      }),
      event({
        id: 'b',
        type: 'sleep',
        startTime: new Date('2026-08-13T09:20:00Z'),
        endTime: new Date('2026-08-13T09:50:00Z'),
        durationMinutes: 30,
        notes: 'Resettled',
        metadata: { sleepType: 'nap' },
      }),
    ]);

    expect(plan.updates.durationMinutes).toBe(70);
    expect(plan.updates.endTime).toEqual(new Date('2026-08-13T09:50:00Z'));
    expect(plan.updates.notes).toBe('Fussy start\nResettled');
  });
});
