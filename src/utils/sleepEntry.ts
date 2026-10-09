import { TIMER_LIMIT_MINUTES, timerLimitLabel } from './timerLimits';

export const MAX_SLEEP_ENTRY_MINUTES = TIMER_LIMIT_MINUTES.sleep;

export interface SleepEntryTimes {
  startTime: Date;
  endTime: Date;
  durationMinutes: number;
}

export type SleepEntryCheck =
  | { error: string; times?: undefined }
  | { error?: undefined; times: SleepEntryTimes };

export const sleepMinutesBetween = (startTime: Date, endTime: Date) =>
  Math.round((endTime.getTime() - startTime.getTime()) / 60_000);

/**
 * The end time is the anchor a caregiver is surest about ("she just woke up"),
 * so typing a duration walks the start time back rather than pushing the end
 * time into the future.
 */
export const sleepStartFromDuration = (endTime: Date, minutes: number) =>
  new Date(endTime.getTime() - minutes * 60_000);

export const parseSleepDurationMinutes = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const minutes = Number(trimmed);
  return Number.isFinite(minutes) && minutes > 0 ? minutes : undefined;
};

/**
 * Start time, end time and duration are three views of the same sleep, so they
 * are validated together and saved together — a record where the duration
 * disagrees with its own times reports differently in the timeline than it does
 * in the daily totals.
 */
export const checkSleepEntry = (
  entry: { startTime: Date; endTime: Date; durationInput?: string },
  now = new Date(),
): SleepEntryCheck => {
  if (
    !Number.isFinite(entry.startTime.getTime()) ||
    !Number.isFinite(entry.endTime.getTime())
  ) {
    return { error: 'Choose valid start and end times.' };
  }
  if (
    entry.durationInput !== undefined &&
    parseSleepDurationMinutes(entry.durationInput) === undefined
  ) {
    return { error: 'Enter a duration greater than zero.' };
  }
  if (entry.endTime.getTime() > now.getTime()) {
    return { error: 'Choose an end time that is not in the future.' };
  }

  const durationMinutes = sleepMinutesBetween(entry.startTime, entry.endTime);
  if (durationMinutes <= 0) {
    return { error: 'The sleep needs to end after it started.' };
  }
  if (durationMinutes > MAX_SLEEP_ENTRY_MINUTES) {
    return {
      error: `Sleep can be at most ${timerLimitLabel(MAX_SLEEP_ENTRY_MINUTES)}.`,
    };
  }

  return {
    times: {
      startTime: entry.startTime,
      endTime: entry.endTime,
      durationMinutes,
    },
  };
};

export type SleepTimeField = 'start' | 'end' | 'duration';

/** The two most recently edited fields are inputs; the third is calculated. */
export const updateSleepEntry = (
  entry: { startTime: Date; endTime: Date; duration: string },
  previous: SleepTimeField[],
  field: SleepTimeField,
  value: Date | string,
) => {
  const order = [...previous.filter(item => item !== field), field].slice(-2);
  const next = { ...entry };
  if (field === 'start') next.startTime = value as Date;
  if (field === 'end') next.endTime = value as Date;
  if (field === 'duration') next.duration = value as string;
  const inputs = order.length === 2
    ? order
    : field === 'duration' ? ['end', field] : ['start', 'end'];
  if (!inputs.includes('duration')) {
    next.duration = String(
      Math.max(0, sleepMinutesBetween(next.startTime, next.endTime)),
    );
  } else {
    const minutes = parseSleepDurationMinutes(next.duration);
    if (minutes !== undefined) {
      if (inputs.includes('start')) {
        next.endTime = new Date(next.startTime.getTime() + minutes * 60_000);
      } else {
        next.startTime = sleepStartFromDuration(next.endTime, minutes);
      }
    }
  }
  return { ...next, order };
};

/**
 * Times for a duration typed against a known start.
 *
 * The woke-up time moves to match — the usual case when writing down a sleep
 * from earlier. If that would put it in the future, the sleep must have just
 * ended instead, so the end stays at now and the start walks back.
 */
export const sleepTimesForDuration = (
  startTime: Date,
  minutes: number,
  now: Date,
) => {
  const endTime = new Date(startTime.getTime() + minutes * 60_000);
  if (endTime.getTime() <= now.getTime()) return { startTime, endTime };
  return {
    startTime: new Date(now.getTime() - minutes * 60_000),
    endTime: new Date(now.getTime()),
  };
};
