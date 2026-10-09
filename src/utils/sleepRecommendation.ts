import type { BabyEvent } from '../services/firebase/events';

/**
 * Typical time awake between sleeps, by age.
 *
 * These are the ranges parenting literature and sleep consultants converge on.
 * They are a starting point for a baby with no history yet, not a target: the
 * moment there are enough of this baby's own wake windows to go on, they take
 * over. Minutes, and the first band whose `upToWeeks` is not yet passed wins.
 */
export const AGE_WAKE_WINDOWS: Array<{
  upToWeeks: number;
  min: number;
  typical: number;
  max: number;
}> = [
  { upToWeeks: 6, min: 45, typical: 55, max: 70 },
  { upToWeeks: 10, min: 60, typical: 75, max: 90 },
  { upToWeeks: 14, min: 75, typical: 90, max: 105 },
  { upToWeeks: 18, min: 90, typical: 105, max: 120 },
  { upToWeeks: 26, min: 120, typical: 135, max: 150 },
  { upToWeeks: 39, min: 150, typical: 165, max: 180 },
  { upToWeeks: 52, min: 180, typical: 210, max: 240 },
  { upToWeeks: 78, min: 240, typical: 270, max: 300 },
  { upToWeeks: Number.POSITIVE_INFINITY, min: 300, typical: 330, max: 360 },
];

/** A gap longer than this is a missed log or a night, not time spent awake. */
export const MAX_WAKE_WINDOW_MINUTES = 8 * 60;

/**
 * How fast this baby's own history displaces the age band. At eight windows
 * the two count equally; by thirty the age band barely registers. Shrinking
 * toward the norm like this keeps one odd afternoon from moving the estimate
 * much while there is little else to weigh it against.
 */
const PERSONAL_WEIGHT_HALF_LIFE = 8;

export type RecommendationBasis = 'age' | 'learning' | 'personal';

export type SleepRecommendation =
  | { state: 'asleep' }
  | { state: 'unknown' }
  | {
      state: 'due';
      /** Start of the suggested window. */
      from: Date;
      /** End of the suggested window. */
      to: Date;
      /** Minutes awake the suggestion is built on. */
      typicalMinutes: number;
      /** How much of that came from this baby rather than the age band. */
      basis: RecommendationBasis;
      /** Wake windows found in the history used. */
      sampleSize: number;
      awakeSince: Date;
    };

export const ageInWeeks = (dateOfBirth: Date, now: Date) =>
  (now.getTime() - dateOfBirth.getTime()) / (7 * 24 * 60 * 60 * 1000);

export const ageWakeWindow = (weeks: number) =>
  AGE_WAKE_WINDOWS.find(band => weeks < band.upToWeeks) ??
  AGE_WAKE_WINDOWS[AGE_WAKE_WINDOWS.length - 1];

const sortedAscending = (events: BabyEvent[]) =>
  [...events].sort((left, right) => left.startTime.getTime() - right.startTime.getTime());

const percentile = (sorted: number[], fraction: number) => {
  if (sorted.length === 0) return 0;
  const position = (sorted.length - 1) * fraction;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
};

export const median = (values: number[]) =>
  percentile([...values].sort((left, right) => left - right), 0.5);

/**
 * Minutes this baby has actually spent awake between one sleep ending and the
 * next beginning, most recent first. Overnight and anything long enough to be
 * a forgotten timer are left out, so what remains is the gap between naps.
 */
export const observedWakeWindows = (
  events: BabyEvent[],
  now: Date,
  windowDays = 14,
) => {
  const since = now.getTime() - windowDays * 24 * 60 * 60 * 1000;
  const sleeps = sortedAscending(
    events.filter(
      event =>
        event.type === 'sleep' &&
        event.endTime &&
        event.startTime.getTime() >= since,
    ),
  );

  const windows: number[] = [];
  for (let index = 1; index < sleeps.length; index += 1) {
    const previousEnd = sleeps[index - 1].endTime;
    if (!previousEnd) continue;
    const minutes =
      (sleeps[index].startTime.getTime() - previousEnd.getTime()) / 60_000;
    if (minutes > 0 && minutes <= MAX_WAKE_WINDOW_MINUTES) {
      windows.push(minutes);
    }
  }
  return windows.reverse();
};

/**
 * When the next sleep is likely to be wanted.
 *
 * The age band says what is usual for a baby this old; the log says what is
 * usual for this one. The answer is a weighted blend of the two, offered as a
 * window rather than a time because the spread between one day and the next is
 * wider than any single minute could honestly claim.
 */
export const recommendNextSleep = ({
  dateOfBirth,
  events,
  now,
  windowDays = 14,
}: {
  dateOfBirth: Date;
  events: BabyEvent[];
  now: Date;
  windowDays?: number;
}): SleepRecommendation => {
  const sleeps = sortedAscending(events.filter(event => event.type === 'sleep'));
  const running = sleeps.find(event => !event.endTime);
  if (running) return { state: 'asleep' };

  const lastFinished = [...sleeps].reverse().find(event => event.endTime);
  const awakeSince = lastFinished?.endTime;
  if (!awakeSince) return { state: 'unknown' };

  const band = ageWakeWindow(ageInWeeks(dateOfBirth, now));
  const observed = observedWakeWindows(events, now, windowDays);
  const sampleSize = observed.length;

  const personalWeight =
    sampleSize / (sampleSize + PERSONAL_WEIGHT_HALF_LIFE);
  const typicalMinutes = Math.round(
    personalWeight * (sampleSize ? median(observed) : band.typical) +
      (1 - personalWeight) * band.typical,
  );

  // Five windows is enough to say something about this baby's spread; below
  // that the age band's own range is the more honest description of it.
  const sorted = [...observed].sort((left, right) => left - right);
  const spread =
    sampleSize >= 5
      ? Math.min(45, Math.max(10, (percentile(sorted, 0.75) - percentile(sorted, 0.25)) / 2))
      : (band.max - band.min) / 2;

  const centre = awakeSince.getTime() + typicalMinutes * 60_000;
  return {
    state: 'due',
    from: new Date(centre - spread * 60_000),
    to: new Date(centre + spread * 60_000),
    typicalMinutes,
    basis: sampleSize >= 8 ? 'personal' : sampleSize >= 3 ? 'learning' : 'age',
    sampleSize,
    awakeSince,
  };
};
