import { describe, expect, it } from 'vitest';
import {
  adjustBreastTimingForStartChange,
  averageNursingSessionSeconds,
  describeBreastTiming,
  breastDurationsAt,
  breastDurationsForEvent,
  describeBreastUse,
  finishBreastTiming,
  runningBreastSide,
  startBreastTiming,
  summarizeNursingSides,
  switchBreastSide,
  trackBreastSide,
} from '../../src/utils/breastFeed';

describe('breast feed tracking', () => {
  it('starts timing the selected side immediately', () => {
    expect(startBreastTiming('left', 1_000)).toMatchObject({
      breastSide: 'left',
      lastBreastSide: 'left',
      breastSideStartedAtMs: 1_000,
      leftBreastDurationSeconds: 0,
      rightBreastDurationSeconds: 0,
    });
  });

  it('counts an earlier selected start time in the running side', () => {
    const timing = startBreastTiming('right', 60_000);

    expect(breastDurationsAt(timing, 660_000)).toEqual({
      leftBreastDurationSeconds: 0,
      rightBreastDurationSeconds: 600,
    });
  });

  it('records both sides and the finishing side after a switch', () => {
    const result = trackBreastSide(
      { feedType: 'breast', breastSide: 'left' },
      'right',
    );
    expect(result).toEqual({
      breastSide: 'both',
      breastSidesUsed: ['left', 'right'],
      lastBreastSide: 'right',
    });
    expect(describeBreastUse({ feedType: 'breast', ...result })).toBe(
      'Both · Last R',
    );
  });

  it('totals tracked, running, and single-side manual nursing time', () => {
    const base = {
      type: 'feed' as const,
      startTime: new Date(0),
      endTime: new Date(1_000),
      source: 'app' as const,
      loggedBy: 'caregiver-1',
    };

    expect(
      summarizeNursingSides(
        [
          {
            ...base,
            metadata: {
              feedType: 'breast',
              breastSide: 'both',
              lastBreastSide: 'right',
              leftBreastDurationSeconds: 90,
              rightBreastDurationSeconds: 30,
              breastSideStartedAtMs: 10_000,
            },
            endTime: null,
          },
          {
            ...base,
            durationMinutes: 4,
            metadata: { feedType: 'breast', breastSide: 'left' },
          },
          {
            ...base,
            durationMinutes: 20,
            metadata: { feedType: 'bottle' },
          },
        ],
        40_000,
      ),
    ).toEqual({ leftSeconds: 330, rightSeconds: 60 });
  });

  it('averages completed breastfeed sittings with tracked and legacy durations', () => {
    const base = {
      type: 'feed' as const,
      startTime: new Date(0),
      endTime: new Date(1_000),
      source: 'app' as const,
      loggedBy: 'caregiver-1',
    };

    expect(
      averageNursingSessionSeconds([
        {
          ...base,
          durationMinutes: 12,
          metadata: {
            feedType: 'breast',
            breastSide: 'both',
            leftBreastDurationSeconds: 420,
            rightBreastDurationSeconds: 300,
          },
        },
        {
          ...base,
          durationMinutes: 18,
          metadata: { feedType: 'breast', breastSide: 'left' },
        },
        {
          ...base,
          endTime: null,
          durationMinutes: 40,
          metadata: { feedType: 'breast', breastSide: 'right' },
        },
        {
          ...base,
          durationMinutes: 30,
          metadata: { feedType: 'bottle' },
        },
      ]),
    ).toBe(900);
  });

  it('has no sitting average until a completed breastfeed has a duration', () => {
    expect(
      averageNursingSessionSeconds([
        {
          type: 'feed',
          startTime: new Date(0),
          endTime: null,
          source: 'app',
          loggedBy: 'caregiver-1',
          metadata: { feedType: 'breast', breastSide: 'left' },
        },
      ]),
    ).toBeNull();
  });

  it('keeps a single side compact and supports old records', () => {
    expect(describeBreastUse({ feedType: 'breast', breastSide: 'left' })).toBe(
      'Left',
    );
  });

  it('keeps separate durations when switching sides and stopping', () => {
    const onLeft = switchBreastSide({ feedType: 'breast' }, 'left', 1_000);
    const onRight = switchBreastSide(
      { feedType: 'breast', ...onLeft },
      'right',
      91_000,
    );

    expect(onRight.leftBreastDurationSeconds).toBe(90);
    expect(breastDurationsAt(onRight, 121_000)).toEqual({
      leftBreastDurationSeconds: 90,
      rightBreastDurationSeconds: 30,
    });
    expect(finishBreastTiming(onRight, 121_000)).toMatchObject({
      leftBreastDurationSeconds: 90,
      rightBreastDurationSeconds: 30,
      breastSideStartedAtMs: undefined,
    });
  });

  it('continues a stopped timer without losing either side total', () => {
    const stopped = finishBreastTiming(
      {
        feedType: 'breast',
        breastSide: 'right',
        lastBreastSide: 'right',
        breastSidesUsed: ['left', 'right'],
        breastSideStartedAtMs: 91_000,
        leftBreastDurationSeconds: 90,
        rightBreastDurationSeconds: 0,
      },
      121_000,
    );

    const continued = switchBreastSide(stopped, 'left', 200_000);

    expect(continued).toMatchObject({
      breastSide: 'both',
      lastBreastSide: 'left',
      breastSideStartedAtMs: 200_000,
      leftBreastDurationSeconds: 90,
      rightBreastDurationSeconds: 30,
    });
    expect(breastDurationsAt(continued, 215_000)).toEqual({
      leftBreastDurationSeconds: 105,
      rightBreastDurationSeconds: 30,
    });
  });

  it('describes total, left, and right time for a tracked breastfeed', () => {
    expect(
      describeBreastTiming({
        type: 'feed',
        startTime: new Date(0),
        endTime: new Date(330_000),
        durationMinutes: 5.5,
        source: 'app',
        loggedBy: 'caregiver-1',
        metadata: {
          feedType: 'breast',
          breastSide: 'both',
          leftBreastDurationSeconds: 125,
          rightBreastDurationSeconds: 205,
        },
      }),
    ).toBe('Total 6m · Left 2m · Right 3m');
  });

  it('does not keep accumulating a completed feed with a stale side timer', () => {
    const completed = {
      type: 'feed' as const,
      startTime: new Date('2026-08-14T21:49:34.565Z'),
      endTime: new Date('2026-08-14T22:55:33.376Z'),
      durationMinutes: 21.533333333333335,
      source: 'app' as const,
      loggedBy: 'caregiver-1',
      metadata: {
        feedType: 'breast' as const,
        breastSide: 'both' as const,
        lastBreastSide: 'left' as const,
        breastSideStartedAtMs: 1_786_744_762_741,
        leftBreastDurationSeconds: 900,
        rightBreastDurationSeconds: 392,
      },
    };

    expect(breastDurationsForEvent(completed, 1_786_856_400_000)).toEqual({
      leftBreastDurationSeconds: 900,
      rightBreastDurationSeconds: 392,
    });
    expect(describeBreastTiming(completed, 1_786_856_400_000)).toBe(
      'Total 22m · Left 15m · Right 7m',
    );
    expect(summarizeNursingSides([completed], 1_786_856_400_000)).toEqual({
      leftSeconds: 900,
      rightSeconds: 392,
    });
  });

  it('shows the known side for a legacy single-side breastfeed', () => {
    expect(
      describeBreastTiming({
        type: 'feed',
        startTime: new Date(0),
        endTime: new Date(240_000),
        durationMinutes: 4,
        source: 'app',
        loggedBy: 'caregiver-1',
        metadata: { feedType: 'breast', breastSide: 'left' },
      }),
    ).toBe('Total 4m · Left 4m · Right 0m');
  });

  it('pauses one side without finishing the feed, then continues as both', () => {
    const onLeft = startBreastTiming('left', 1_000);
    const paused = finishBreastTiming(onLeft, 61_000);

    expect(runningBreastSide(paused)).toBeNull();
    expect(paused.leftBreastDurationSeconds).toBe(60);

    const onRight = switchBreastSide(paused, 'right', 91_000);
    expect(runningBreastSide(onRight)).toBe('right');
    expect(onRight).toMatchObject({
      breastSide: 'both',
      breastSidesUsed: ['left', 'right'],
      leftBreastDurationSeconds: 60,
      rightBreastDurationSeconds: 0,
    });
  });

  it('adds an earlier start-time adjustment to the active breast', () => {
    expect(
      adjustBreastTimingForStartChange(
        {
          feedType: 'breast',
          breastSide: 'both',
          lastBreastSide: 'right',
          breastSideStartedAtMs: 120_000,
          leftBreastDurationSeconds: 60,
          rightBreastDurationSeconds: 0,
        },
        60_000,
        30_000,
        150_000,
      ),
    ).toMatchObject({
      leftBreastDurationSeconds: 60,
      rightBreastDurationSeconds: 60,
      breastSideStartedAtMs: 150_000,
    });
  });

  it('subtracts a later start-time adjustment from the active breast', () => {
    expect(
      adjustBreastTimingForStartChange(
        {
          feedType: 'breast',
          breastSide: 'left',
          lastBreastSide: 'left',
          breastSideStartedAtMs: 60_000,
          leftBreastDurationSeconds: 30,
          rightBreastDurationSeconds: 0,
        },
        30_000,
        60_000,
        120_000,
      ),
    ).toMatchObject({
      leftBreastDurationSeconds: 60,
      rightBreastDurationSeconds: 0,
      breastSideStartedAtMs: 120_000,
    });
  });
});
