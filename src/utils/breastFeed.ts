import type { BabyEvent, BabyEventMetadata } from '../services/firebase/events';
/** Nursing is recorded accurately in seconds, but displayed in whole minutes. */
export const formatNursingDuration = (totalSeconds: number) => {
  const minutes = Math.max(0, Math.round(totalSeconds / 60));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
};

export type SingleBreastSide = 'left' | 'right';

type BreastTimingMetadata = Pick<
  BabyEventMetadata,
  | 'breastSideStartedAtMs'
  | 'leftBreastDurationSeconds'
  | 'rightBreastDurationSeconds'
  | 'lastBreastSide'
  | 'breastSide'
>;

export const runningBreastSide = (
  metadata: BabyEventMetadata | undefined,
): SingleBreastSide | null => {
  if (metadata?.breastSideStartedAtMs === undefined) return null;
  if (metadata.lastBreastSide) return metadata.lastBreastSide;
  return metadata.breastSide === 'left' || metadata.breastSide === 'right'
    ? metadata.breastSide
    : null;
};

export const trackBreastSide = (
  metadata: BabyEventMetadata | undefined,
  nextSide: SingleBreastSide,
): Pick<BabyEventMetadata, 'breastSide' | 'breastSidesUsed' | 'lastBreastSide'> => {
  const used = new Set<SingleBreastSide>(metadata?.breastSidesUsed || []);
  if (metadata?.breastSide === 'left' || metadata?.breastSide === 'right') {
    used.add(metadata.breastSide);
  } else if (metadata?.breastSide === 'both') {
    used.add('left');
    used.add('right');
  }
  used.add(nextSide);
  const breastSidesUsed = (['left', 'right'] as const).filter(side => used.has(side));

  return {
    breastSide: breastSidesUsed.length === 2 ? 'both' : nextSide,
    breastSidesUsed,
    lastBreastSide: nextSide,
  };
};

const addElapsedToCurrentSide = (
  metadata: BreastTimingMetadata | undefined,
  nowMs: number,
) => {
  const currentSide =
    metadata?.lastBreastSide ||
    (metadata?.breastSide === 'left' || metadata?.breastSide === 'right'
      ? metadata.breastSide
      : undefined);
  const startedAt = metadata?.breastSideStartedAtMs;
  const elapsedSeconds =
    currentSide && startedAt
      ? Math.max(0, Math.floor((nowMs - startedAt) / 1000))
      : 0;

  return {
    leftBreastDurationSeconds:
      (metadata?.leftBreastDurationSeconds || 0) +
      (currentSide === 'left' ? elapsedSeconds : 0),
    rightBreastDurationSeconds:
      (metadata?.rightBreastDurationSeconds || 0) +
      (currentSide === 'right' ? elapsedSeconds : 0),
  };
};

export const switchBreastSide = (
  metadata: BabyEventMetadata | undefined,
  nextSide: SingleBreastSide,
  nowMs = Date.now(),
): Pick<
  BabyEventMetadata,
  | 'breastSide'
  | 'breastSidesUsed'
  | 'lastBreastSide'
  | 'breastSideStartedAtMs'
  | 'leftBreastDurationSeconds'
  | 'rightBreastDurationSeconds'
> => ({
  ...trackBreastSide(metadata, nextSide),
  ...addElapsedToCurrentSide(metadata, nowMs),
  breastSideStartedAtMs: nowMs,
});

export const startBreastTiming = (
  side: SingleBreastSide,
  nowMs = Date.now(),
): BabyEventMetadata => ({
  feedType: 'breast',
  ...trackBreastSide(undefined, side),
  breastSideStartedAtMs: nowMs,
  leftBreastDurationSeconds: 0,
  rightBreastDurationSeconds: 0,
});

export const finishBreastTiming = (
  metadata: BabyEventMetadata | undefined,
  nowMs = Date.now(),
): BabyEventMetadata => ({
  ...metadata,
  ...addElapsedToCurrentSide(metadata, nowMs),
  breastSideStartedAtMs: undefined,
});

export const breastDurationsAt = (
  metadata: BabyEventMetadata | undefined,
  nowMs = Date.now(),
) => addElapsedToCurrentSide(metadata, nowMs);

export const adjustBreastTimingForStartChange = (
  metadata: BabyEventMetadata | undefined,
  previousStartMs: number,
  nextStartMs: number,
  nowMs = Date.now(),
): BabyEventMetadata => {
  const runningSide = runningBreastSide(metadata);
  const adjustedSide =
    runningSide ||
    metadata?.lastBreastSide ||
    (metadata?.breastSide === 'left' || metadata?.breastSide === 'right'
      ? metadata.breastSide
      : undefined);
  if (!adjustedSide) return { ...metadata };

  const current = breastDurationsAt(metadata, nowMs);
  const adjustmentSeconds = Math.round(
    (previousStartMs - nextStartMs) / 1_000,
  );
  const leftBreastDurationSeconds = Math.max(
    0,
    current.leftBreastDurationSeconds +
      (adjustedSide === 'left' ? adjustmentSeconds : 0),
  );
  const rightBreastDurationSeconds = Math.max(
    0,
    current.rightBreastDurationSeconds +
      (adjustedSide === 'right' ? adjustmentSeconds : 0),
  );

  return {
    ...metadata,
    leftBreastDurationSeconds,
    rightBreastDurationSeconds,
    breastSideStartedAtMs: runningSide ? nowMs : undefined,
  };
};

export const breastDurationsForEvent = (
  event: BabyEvent,
  nowMs = Date.now(),
) =>
  event.endTime
    ? {
        leftBreastDurationSeconds:
          event.metadata?.leftBreastDurationSeconds || 0,
        rightBreastDurationSeconds:
          event.metadata?.rightBreastDurationSeconds || 0,
      }
    : breastDurationsAt(event.metadata, nowMs);

export const summarizeNursingSides = (
  events: BabyEvent[],
  nowMs = Date.now(),
) =>
  events.reduce(
    (totals, event) => {
      if (event.type !== 'feed' || event.metadata?.feedType !== 'breast') {
        return totals;
      }

      const metadata = event.metadata;
      const hasTrackedSideTime =
        metadata.leftBreastDurationSeconds !== undefined ||
        metadata.rightBreastDurationSeconds !== undefined ||
        (!event.endTime && metadata.breastSideStartedAtMs !== undefined);

      if (hasTrackedSideTime) {
        const durations = breastDurationsForEvent(event, nowMs);
        totals.leftSeconds += durations.leftBreastDurationSeconds;
        totals.rightSeconds += durations.rightBreastDurationSeconds;
        return totals;
      }

      const manualSeconds = Math.max(0, event.durationMinutes || 0) * 60;
      if (metadata.breastSide === 'left') totals.leftSeconds += manualSeconds;
      if (metadata.breastSide === 'right') totals.rightSeconds += manualSeconds;
      return totals;
    },
    { leftSeconds: 0, rightSeconds: 0 },
  );

export const averageNursingSessionSeconds = (events: BabyEvent[]) => {
  const completedDurations = events.flatMap(event => {
    if (
      event.type !== 'feed' ||
      event.metadata?.feedType !== 'breast' ||
      !event.endTime
    ) {
      return [];
    }

    const tracked = breastDurationsForEvent(event);
    const trackedSeconds =
      tracked.leftBreastDurationSeconds + tracked.rightBreastDurationSeconds;
    const savedSeconds = Math.max(
      0,
      Math.round((event.durationMinutes || 0) * 60),
    );
    const durationSeconds = trackedSeconds > 0 ? trackedSeconds : savedSeconds;

    return durationSeconds > 0 ? [durationSeconds] : [];
  });

  if (!completedDurations.length) return null;

  return Math.round(
    completedDurations.reduce((total, seconds) => total + seconds, 0) /
      completedDurations.length,
  );
};

export const describeBreastUse = (metadata: BabyEventMetadata | undefined) => {
  if (metadata?.feedType !== 'breast') return '';
  const usedBoth =
    metadata.breastSide === 'both' || metadata.breastSidesUsed?.length === 2;
  const lastSide =
    metadata.lastBreastSide ||
    (metadata.breastSide === 'left' || metadata.breastSide === 'right'
      ? metadata.breastSide
      : undefined);

  if (usedBoth) {
    return lastSide
      ? `Both · Last ${lastSide === 'left' ? 'L' : 'R'}`
      : 'Both';
  }
  if (lastSide) return lastSide === 'left' ? 'Left' : 'Right';
  return 'Nursing';
};

export const describeBreastTiming = (
  event: BabyEvent,
  nowMs = Date.now(),
) => {
  if (event.type !== 'feed' || event.metadata?.feedType !== 'breast') return '';

  const metadata = event.metadata;
  const hasTrackedSideTime =
    metadata.leftBreastDurationSeconds !== undefined ||
    metadata.rightBreastDurationSeconds !== undefined ||
    (!event.endTime && metadata.breastSideStartedAtMs !== undefined);
  const tracked = hasTrackedSideTime
    ? breastDurationsForEvent(event, nowMs)
    : { leftBreastDurationSeconds: 0, rightBreastDurationSeconds: 0 };
  const trackedTotal =
    tracked.leftBreastDurationSeconds + tracked.rightBreastDurationSeconds;
  const savedTotal = Math.max(0, Math.round((event.durationMinutes || 0) * 60));

  let leftSeconds: number | null = tracked.leftBreastDurationSeconds;
  let rightSeconds: number | null = tracked.rightBreastDurationSeconds;
  let totalSeconds = trackedTotal;

  if (!hasTrackedSideTime || (trackedTotal === 0 && savedTotal > 0)) {
    totalSeconds = savedTotal;
    if (metadata.breastSide === 'left') {
      leftSeconds = savedTotal;
      rightSeconds = 0;
    } else if (metadata.breastSide === 'right') {
      leftSeconds = 0;
      rightSeconds = savedTotal;
    } else {
      leftSeconds = null;
      rightSeconds = null;
    }
  }

  const formatSide = (seconds: number | null) =>
    seconds === null ? '—' : formatNursingDuration(seconds);

  return [
    `Total ${formatNursingDuration(totalSeconds)}`,
    `Left ${formatSide(leftSeconds)}`,
    `Right ${formatSide(rightSeconds)}`,
  ].join(' · ');
};

/**
 * Corrects one side's time mid-feed without touching the other side's clock.
 *
 * A side that is not running simply takes the new total. The running side
 * takes it too, with its current stretch restarted from now so it carries on
 * counting up from the corrected figure. If the two sides now add up to more
 * than the feed has been going, it must have started earlier than recorded, so
 * the start moves back to fit.
 */
export const setNursingSideSeconds = (
  metadata: BabyEventMetadata | undefined,
  side: SingleBreastSide,
  seconds: number,
  startTime: Date,
  nowMs = Date.now(),
): { metadata: BabyEventMetadata; startTime: Date } => {
  const running = runningBreastSide(metadata);
  const live = breastDurationsAt(metadata, nowMs);
  const nextSeconds = Math.max(0, Math.round(seconds));
  const left = side === 'left' ? nextSeconds : live.leftBreastDurationSeconds;
  const right = side === 'right' ? nextSeconds : live.rightBreastDurationSeconds;

  const used = (['left', 'right'] as const).filter(
    item => item === running || (item === 'left' ? left : right) > 0,
  );

  const nextMetadata: BabyEventMetadata = {
    ...metadata,
    // Both totals are taken as of now, so a running side restarts its current
    // stretch from now rather than counting the old one twice.
    leftBreastDurationSeconds: left,
    rightBreastDurationSeconds: right,
    breastSideStartedAtMs: running ? nowMs : metadata?.breastSideStartedAtMs,
    breastSidesUsed: used.length ? used : metadata?.breastSidesUsed,
    breastSide:
      used.length === 2 ? 'both' : used.length === 1 ? used[0] : metadata?.breastSide,
  };

  const earliestStartMs = nowMs - (left + right) * 1000;
  return {
    metadata: nextMetadata,
    startTime:
      earliestStartMs < startTime.getTime() ? new Date(earliestStartMs) : startTime,
  };
};
