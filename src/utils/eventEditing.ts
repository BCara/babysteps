import type { BabyEvent, BabyEventType } from '../services/firebase/events';

export type EventEditUpdates = Partial<
  Pick<
    BabyEvent,
    'startTime' | 'endTime' | 'durationMinutes' | 'notes' | 'metadata'
  >
>;

interface ActiveEventIds {
  feed?: string | null;
  sleep?: string | null;
  pumping?: string | null;
}

export const usesEventEditModal = (type: BabyEventType) =>
  type === 'feed' ||
  type === 'sleep' ||
  type === 'diaper' ||
  type === 'pumping';

export const isActiveBabyEvent = (
  event: BabyEvent,
  activeEventIds: ActiveEventIds,
) =>
  Boolean(
    !event.endTime &&
      event.id &&
      (event.id === activeEventIds.feed ||
        event.id === activeEventIds.sleep ||
        event.id === activeEventIds.pumping),
  );

export const shiftedEventTimes = (event: BabyEvent, startTime: Date, durationMinutes?: number) => {
  // An explicit manual duration is anchored to the selected start, not save time.
  if (durationMinutes !== undefined && Number.isFinite(durationMinutes) && durationMinutes > 0) {
    return { startTime, endTime: new Date(startTime.getTime() + durationMinutes * 60_000) };
  }
  const offsetMs = startTime.getTime() - event.startTime.getTime();
  return {
    startTime,
    ...(event.endTime
      ? { endTime: new Date(event.endTime.getTime() + offsetMs) }
      : {}),
  };
};

export const mergeEventDateTimePart = (
  current: Date,
  selected: Date,
  mode: 'date' | 'time',
) => {
  const next = new Date(current);
  if (mode === 'date') {
    next.setFullYear(
      selected.getFullYear(),
      selected.getMonth(),
      selected.getDate(),
    );
  } else {
    next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
  }
  return next;
};

export const resolveManualEntryStartTime = (
  selectedStartTime?: Date,
  activeEventStartTime?: Date,
  now = new Date(),
) => new Date((selectedStartTime || activeEventStartTime || now).getTime());

/** A later clock time entered for today describes yesterday's care activity. */
export const resolveEventPickerTime = (
  current: Date,
  selected: Date,
  mode: 'date' | 'time',
  allowFuture = false,
  now = new Date(),
) => {
  const next = mergeEventDateTimePart(current, selected, mode);
  if (
    mode === 'time' && !allowFuture && next > now &&
    next.getFullYear() === now.getFullYear() &&
    next.getMonth() === now.getMonth() &&
    next.getDate() === now.getDate()
  ) {
    // Calendar arithmetic preserves the chosen local time across DST changes.
    next.setDate(next.getDate() - 1);
  }
  return next;
};

export const saveEventEditAndFinishStartedNursing = async (
  event: BabyEvent,
  updates: EventEditUpdates,
  saveEvent: (eventId: string, updates: EventEditUpdates) => Promise<void>,
  finishFeed: (event: BabyEvent) => Promise<void>,
) => {
  if (!event.id) throw new Error('Event is missing its ID.');

  await saveEvent(event.id, updates);

  const shouldFinishNursing =
    event.type === 'feed' &&
    !event.endTime &&
    !updates.endTime &&
    event.metadata?.feedType !== 'bottle';

  if (shouldFinishNursing) {
    await finishFeed({ ...event, ...updates });
  }

  return shouldFinishNursing;
};

export const careEventTimes = (
  input: { startTime?: Date; durationMinutes?: number },
  now = new Date(),
) => {
  if (input.startTime) {
    return {
      startTime: input.startTime,
      endTime: input.durationMinutes
        ? new Date(input.startTime.getTime() + input.durationMinutes * 60_000)
        : input.startTime,
    };
  }

  return {
    startTime: input.durationMinutes
      ? new Date(now.getTime() - input.durationMinutes * 60_000)
      : now,
    endTime: now,
  };
};
