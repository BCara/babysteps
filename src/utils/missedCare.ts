import type { BabyEvent } from '../services/firebase/events';
import { median } from './sleepRecommendation';

/**
 * Spotting a sleep or feed that probably happened but was never written down.
 *
 * The cost of a wrong guess is a caregiver being asked about something that
 * did not happen, so every rule here leans towards staying quiet:
 *
 * - Nothing is said until there is enough of this baby's own log to know what
 *   a normal gap looks like for them. Age norms are not used: a family that
 *   only logs some naps would be told about the rest every day.
 * - A gap has to be long against this baby's typical one, and also rare in
 *   their own history. Gaps that long happening routinely — a night that is
 *   never logged, say — are a habit of the log, not a slip.
 * - Time asleep is not counted against feeds, so a logged night is not a
 *   missed feed.
 * - Only the last day is looked at, and only one suggestion is offered.
 */

export type MissedCareKind = 'sleep' | 'feed';

export interface MissedCareSuggestion {
  kind: MissedCareKind;
  /** Stable across re-renders and across the gap later being closed. */
  key: string;
  /** Nothing of this kind was logged between these two times. */
  gapStart: Date;
  gapEnd: Date;
  /** The gap is still open: it runs up to now. */
  open: boolean;
  /** A starting point for the entry, to be adjusted before saving. */
  startTime: Date;
  endTime?: Date;
  durationMinutes?: number;
  feedType?: 'breast' | 'bottle';
  amount?: number;
  unit?: 'ml' | 'oz';
}

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

/** How much history the baby's rhythm is learnt from. */
const HISTORY_DAYS = 14;
/** Only gaps that ended this recently are worth asking about. */
const LOOKBACK_MS = DAY;
/** Below this many gaps there is not enough to say what normal is. */
const MIN_SLEEP_GAPS = 8;
const MIN_FEED_GAPS = 10;
/**
 * A gap this long or longer must be at most this common in the baby's own
 * history to count as unusual. One in ten leaves room for the odd long day
 * while still catching a log that routinely skips the night.
 */
const MAX_LONG_GAP_SHARE = 0.1;
/** Past this the app simply was not in use; there is nothing to fill in. */
const MAX_GAP_MS = 16 * 60 * MINUTE;
/** Longer sleeps are nights; naps are what a missed daytime sleep looks like. */
const MAX_NAP_MINUTES = 3 * 60;
const DEFAULT_NAP_MINUTES = 45;

const roundTo5Minutes = (time: number) =>
  Math.round(time / (5 * MINUTE)) * 5 * MINUTE;

const isValid = (event: BabyEvent) =>
  Number.isFinite(event.startTime.getTime()) && !event.deletedAt;

const endOf = (event: BabyEvent, now: number) => {
  if (event.endTime) return event.endTime.getTime();
  if (event.durationMinutes) {
    return event.startTime.getTime() + event.durationMinutes * MINUTE;
  }
  return event.type === 'sleep' ? now : event.startTime.getTime();
};

/** Minutes of [from, to] the baby was logged as asleep. */
const asleepMinutesBetween = (
  sleeps: BabyEvent[],
  from: number,
  to: number,
  now: number,
) =>
  sleeps.reduce((total, sleep) => {
    const overlap =
      Math.min(to, endOf(sleep, now)) - Math.max(from, sleep.startTime.getTime());
    return overlap > 0 ? total + overlap / MINUTE : total;
  }, 0);

/**
 * True when `candidate` is long against the baby's typical gap and long gaps
 * are rare for them. `history` must not contain the candidate itself.
 */
const isUnusualGap = (
  candidate: number,
  history: number[],
  minimumGaps: number,
  extraMinutes: number,
) => {
  if (history.length < minimumGaps) return false;
  const typical = median(history);
  const threshold = Math.max(2 * typical, typical + extraMinutes);
  if (candidate < threshold) return false;
  const longOnes = history.filter(gap => gap >= threshold).length;
  return longOnes / history.length <= MAX_LONG_GAP_SHARE;
};

interface Gap {
  key: string;
  start: number;
  end: number;
  open: boolean;
  /** The event the gap follows. */
  before: BabyEvent;
  /** Minutes that count towards the gap being long. */
  measure: number;
}

const sleepSuggestion = (
  events: BabyEvent[],
  now: number,
  isDismissed: (key: string) => boolean,
): MissedCareSuggestion | null => {
  const sleeps = events
    .filter(event => event.type === 'sleep')
    .sort((left, right) => left.startTime.getTime() - right.startTime.getTime());

  const gaps: Gap[] = [];
  for (let index = 0; index < sleeps.length; index += 1) {
    const before = sleeps[index];
    // A running sleep closes the gap before it and has none after it yet.
    if (!before.endTime) continue;
    const after = sleeps[index + 1];
    const start = before.endTime.getTime();
    const end = after ? after.startTime.getTime() : now;
    if (end <= start || end - start > MAX_GAP_MS) continue;
    gaps.push({
      key: `sleep:${before.id ?? start}`,
      start,
      end,
      open: !after,
      before,
      measure: (end - start) / MINUTE,
    });
  }

  const awakeWindows = gaps.filter(gap => !gap.open).map(gap => gap.measure);
  const candidates = gaps
    .filter(gap => gap.end >= now - LOOKBACK_MS && !isDismissed(gap.key))
    .reverse();

  for (const gap of candidates) {
    const history = gaps
      .filter(other => other !== gap && !other.open)
      .map(other => other.measure);
    if (!isUnusualGap(gap.measure, history, MIN_SLEEP_GAPS, 90)) continue;

    const typicalAwake = median(awakeWindows.filter(window => window <= 8 * 60));
    const naps = sleeps
      .filter(sleep => sleep.endTime)
      .map(sleep => (sleep.endTime!.getTime() - sleep.startTime.getTime()) / MINUTE)
      .filter(minutes => minutes > 0 && minutes <= MAX_NAP_MINUTES);
    const napMinutes = naps.length ? median(naps) : DEFAULT_NAP_MINUTES;

    // Place the nap where the baby would usually have gone down, then step
    // past any feed it would otherwise overlap.
    const latestEnd = gap.end - (gap.open ? 5 : 15) * MINUTE;
    let start = roundTo5Minutes(gap.start + (typicalAwake || 60) * MINUTE);
    const feedsInGap = events
      .filter(
        event =>
          event.type === 'feed' &&
          event.startTime.getTime() < latestEnd &&
          endOf(event, now) > gap.start,
      )
      .sort((left, right) => left.startTime.getTime() - right.startTime.getTime());
    for (const feed of feedsInGap) {
      const overlaps =
        feed.startTime.getTime() < start + napMinutes * MINUTE &&
        endOf(feed, now) > start;
      if (overlaps) start = roundTo5Minutes(endOf(feed, now) + 5 * MINUTE);
    }
    const end = Math.min(start + napMinutes * MINUTE, latestEnd);
    const durationMinutes = Math.round((end - start) / MINUTE);
    if (durationMinutes < 10) continue;

    return {
      kind: 'sleep',
      key: gap.key,
      gapStart: new Date(gap.start),
      gapEnd: new Date(gap.end),
      open: gap.open,
      startTime: new Date(start),
      endTime: new Date(end),
      durationMinutes,
    };
  }
  return null;
};

const feedSuggestion = (
  events: BabyEvent[],
  now: number,
  isDismissed: (key: string) => boolean,
): MissedCareSuggestion | null => {
  const feeds = events
    .filter(event => event.type === 'feed')
    .sort((left, right) => left.startTime.getTime() - right.startTime.getTime());
  const sleeps = events.filter(event => event.type === 'sleep');

  const gaps: Gap[] = [];
  for (let index = 0; index < feeds.length; index += 1) {
    const before = feeds[index];
    const after = feeds[index + 1];
    // A feed still running has no gap after it yet.
    if (!after && !before.endTime) continue;
    const start = before.startTime.getTime();
    const end = after ? after.startTime.getTime() : now;
    if (end <= start || end - start > MAX_GAP_MS) continue;
    gaps.push({
      key: `feed:${before.id ?? start}`,
      start,
      end,
      open: !after,
      before,
      // Babies are not fed in their sleep: only time awake makes a gap long.
      measure: (end - start) / MINUTE - asleepMinutesBetween(sleeps, start, end, now),
    });
  }

  const intervals = gaps.filter(gap => !gap.open).map(gap => (gap.end - gap.start) / MINUTE);
  const candidates = gaps
    .filter(gap => gap.end >= now - LOOKBACK_MS && !isDismissed(gap.key))
    .reverse();

  for (const gap of candidates) {
    const history = gaps
      .filter(other => other !== gap && !other.open)
      .map(other => other.measure);
    if (!isUnusualGap(gap.measure, history, MIN_FEED_GAPS, 120)) continue;

    // When the next feed would usually have come, nudged out of any sleep.
    const latest = gap.end - (gap.open ? 5 : 15) * MINUTE;
    let start = roundTo5Minutes(gap.start + median(intervals) * MINUTE);
    for (const sleep of sleeps) {
      if (sleep.startTime.getTime() <= start && endOf(sleep, now) > start) {
        start = roundTo5Minutes(endOf(sleep, now) + 5 * MINUTE);
      }
    }
    if (start >= latest) continue;

    const feedType = gap.before.metadata?.feedType || 'breast';
    const recentBottles = feeds
      .filter(
        feed =>
          feed.metadata?.feedType === 'bottle' &&
          feed.metadata.amount &&
          feed.metadata.unit === (gap.before.metadata?.unit || 'ml'),
      )
      .slice(-5)
      .map(feed => feed.metadata!.amount!);

    return {
      kind: 'feed',
      key: gap.key,
      gapStart: new Date(gap.start),
      gapEnd: new Date(gap.end),
      open: gap.open,
      startTime: new Date(start),
      feedType,
      ...(feedType === 'bottle' && recentBottles.length
        ? { amount: Math.round(median(recentBottles)), unit: gap.before.metadata?.unit || 'ml' }
        : {}),
    };
  }
  return null;
};

/**
 * The one most likely missed sleep or feed in the last day, or null.
 * `isDismissed` is asked about each gap's key so a caregiver who has said
 * "no" to a gap is never asked about it again.
 */
export const findMissedCare = ({
  events,
  now = new Date(),
  isDismissed = () => false,
}: {
  events: BabyEvent[];
  now?: Date;
  isDismissed?: (key: string) => boolean;
}): MissedCareSuggestion | null => {
  const nowMs = now.getTime();
  const recent = events.filter(
    event =>
      isValid(event) &&
      event.startTime.getTime() >= nowMs - HISTORY_DAYS * DAY &&
      event.startTime.getTime() <= nowMs,
  );
  const options = [
    sleepSuggestion(recent, nowMs, isDismissed),
    feedSuggestion(recent, nowMs, isDismissed),
  ].filter((option): option is MissedCareSuggestion => option !== null);
  // The more recent gap is the one the caregiver is likeliest to remember.
  return (
    options.sort((left, right) => right.gapEnd.getTime() - left.gapEnd.getTime())[0] ?? null
  );
};
