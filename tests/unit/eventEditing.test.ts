import { describe, expect, it, vi } from 'vitest';
import type { BabyEvent } from '../../src/services/firebase/events';
import {
  careEventTimes,
  isActiveBabyEvent,
  mergeEventDateTimePart,
  resolveManualEntryStartTime,
  saveEventEditAndFinishStartedNursing,
  shiftedEventTimes,
  usesEventEditModal,
} from '../../src/utils/eventEditing';

const pumpingEvent = (endTime: Date | null): BabyEvent => ({
  id: 'pumping-1',
  type: 'pumping',
  startTime: new Date('2026-08-12T10:00:00.000Z'),
  endTime,
  source: 'app',
  loggedBy: 'caregiver-1',
});

describe('event editing', () => {
  it('anchors a corrected five-minute feed to its original start', () => {
    const event: BabyEvent = {
      ...pumpingEvent(new Date('2026-09-15T20:00:00Z')),
      type: 'feed', startTime: new Date('2026-09-15T15:11:00Z'),
      durationMinutes: 289,
    };
    const times = shiftedEventTimes(event, event.startTime, 5);
    expect(times.startTime).toEqual(event.startTime);
    expect(times.endTime).toEqual(new Date('2026-09-15T15:16:00Z'));
  });

  it('does not overwrite a manually supplied end by stopping the timer again', async () => {
    const event: BabyEvent = { ...pumpingEvent(null), type: 'feed', metadata: { feedType: 'breast' } };
    const updates = { ...shiftedEventTimes(event, event.startTime, 5), durationMinutes: 5 };
    const save = vi.fn().mockResolvedValue(undefined);
    const stop = vi.fn();
    await saveEventEditAndFinishStartedNursing(event, updates, save, stop);
    expect(save).toHaveBeenCalledWith(event.id, updates);
    expect(stop).not.toHaveBeenCalled();
  });
  it('routes pumping through the standard timed-activity editor', () => {
    expect(usesEventEditModal('pumping')).toBe(true);
    expect(usesEventEditModal('solids')).toBe(false);
  });

  it('allows a completed pumping record to be edited', () => {
    expect(
      isActiveBabyEvent(pumpingEvent(new Date('2026-08-12T10:20:00.000Z')), {
        pumping: 'pumping-1',
      }),
    ).toBe(false);
  });

  it('protects only the exact pumping record that is still running', () => {
    expect(
      isActiveBabyEvent(pumpingEvent(null), { pumping: 'pumping-1' }),
    ).toBe(true);
    expect(
      isActiveBabyEvent(pumpingEvent(null), { pumping: 'pumping-2' }),
    ).toBe(false);
  });

  it('moves a completed event without changing its elapsed duration', () => {
    const event = pumpingEvent(new Date('2026-08-12T10:20:00.000Z'));
    const moved = shiftedEventTimes(
      event,
      new Date('2026-08-12T09:30:00.000Z'),
    );

    expect(moved.startTime.toISOString()).toBe('2026-08-12T09:30:00.000Z');
    expect(moved.endTime?.toISOString()).toBe('2026-08-12T09:50:00.000Z');
  });

  it('uses a selected past date for an instantaneous care record', () => {
    const selectedDate = new Date('2026-07-03T09:15:00.000Z');
    const times = careEventTimes(
      { startTime: selectedDate },
      new Date('2026-08-22T10:00:00.000Z'),
    );

    expect(times.startTime).toBe(selectedDate);
    expect(times.endTime).toBe(selectedDate);
  });

  it('keeps a scheduled future appointment and its duration', () => {
    const scheduled = new Date('2026-09-03T04:30:00.000Z');
    const times = careEventTimes(
      { startTime: scheduled, durationMinutes: 45 },
      new Date('2026-08-30T01:00:00.000Z'),
    );

    expect(times.startTime).toBe(scheduled);
    expect(times.endTime.toISOString()).toBe('2026-09-03T05:15:00.000Z');
  });

  it('keeps the existing duration-based care timing when no date is selected', () => {
    const times = careEventTimes(
      { durationMinutes: 20 },
      new Date('2026-08-22T10:00:00.000Z'),
    );

    expect(times.startTime.toISOString()).toBe('2026-08-22T09:40:00.000Z');
    expect(times.endTime.toISOString()).toBe('2026-08-22T10:00:00.000Z');
  });

  it('changes a nappy clock time without resetting its selected date', () => {
    const current = new Date(2026, 6, 3, 14, 45, 30, 500);
    const selectedTime = new Date(2026, 7, 26, 9, 20, 15, 250);

    const result = mergeEventDateTimePart(current, selectedTime, 'time');

    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(6);
    expect(result.getDate()).toBe(3);
    expect(result.getHours()).toBe(9);
    expect(result.getMinutes()).toBe(20);
    expect(result.getSeconds()).toBe(0);
    expect(result.getMilliseconds()).toBe(0);
  });

  it('changes a nappy date without resetting its chosen clock time', () => {
    const current = new Date(2026, 7, 26, 9, 20, 0, 0);
    const selectedDate = new Date(2026, 6, 3, 17, 55, 0, 0);

    const result = mergeEventDateTimePart(current, selectedDate, 'date');

    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(6);
    expect(result.getDate()).toBe(3);
    expect(result.getHours()).toBe(9);
    expect(result.getMinutes()).toBe(20);
  });

  it('hands a selected Quick Care time into manual entry ahead of defaults', () => {
    const selected = new Date('2026-08-30T03:15:00.000Z');
    const active = new Date('2026-08-30T03:20:00.000Z');
    const now = new Date('2026-08-30T03:30:00.000Z');

    const result = resolveManualEntryStartTime(selected, active, now);

    expect(result.toISOString()).toBe(selected.toISOString());
    expect(result).not.toBe(selected);
  });

  it('uses the active event time when Quick Care has no explicit selection', () => {
    const active = new Date('2026-08-30T03:20:00.000Z');
    const now = new Date('2026-08-30T03:30:00.000Z');

    expect(
      resolveManualEntryStartTime(undefined, active, now).toISOString(),
    ).toBe(active.toISOString());
  });

  it('saves and finishes the same edited nursing record in one action', async () => {
    const event: BabyEvent = {
      id: 'nursing-1',
      type: 'feed',
      startTime: new Date('2026-08-22T10:00:00.000Z'),
      endTime: null,
      source: 'app',
      loggedBy: 'caregiver-1',
      metadata: {
        feedType: 'breast',
        leftBreastDurationSeconds: 120,
        rightBreastDurationSeconds: 0,
      },
    };
    const updates = {
      startTime: new Date('2026-08-22T09:55:00.000Z'),
      durationMinutes: 5,
      metadata: {
        ...event.metadata,
        leftBreastDurationSeconds: 180,
        rightBreastDurationSeconds: 120,
      },
    };
    const saveEvent = vi.fn().mockResolvedValue(undefined);
    const finishFeed = vi.fn().mockResolvedValue(undefined);

    const finished = await saveEventEditAndFinishStartedNursing(
      event,
      updates,
      saveEvent,
      finishFeed,
    );

    expect(finished).toBe(true);
    expect(saveEvent).toHaveBeenCalledWith('nursing-1', updates);
    expect(finishFeed).toHaveBeenCalledWith({ ...event, ...updates });
    expect(saveEvent.mock.invocationCallOrder[0]).toBeLessThan(
      finishFeed.mock.invocationCallOrder[0],
    );
  });

  it('does not finish a nursing record that was already completed', async () => {
    const event: BabyEvent = {
      id: 'nursing-2',
      type: 'feed',
      startTime: new Date('2026-08-22T10:00:00.000Z'),
      endTime: new Date('2026-08-22T10:10:00.000Z'),
      source: 'app',
      loggedBy: 'caregiver-1',
      metadata: { feedType: 'breast' },
    };
    const saveEvent = vi.fn().mockResolvedValue(undefined);
    const finishFeed = vi.fn().mockResolvedValue(undefined);

    const finished = await saveEventEditAndFinishStartedNursing(
      event,
      { notes: 'Updated' },
      saveEvent,
      finishFeed,
    );

    expect(finished).toBe(false);
    expect(saveEvent).toHaveBeenCalledOnce();
    expect(finishFeed).not.toHaveBeenCalled();
  });
});
