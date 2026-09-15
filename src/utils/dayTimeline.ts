import { careActionByType } from '../constants/careActions';
import type { BabyEvent } from '../services/firebase/events';
import { getEventDurationMinutes } from './eventSummary';

/**
 * Placement maths for the to-scale day timeline on the Summary screen. Blocks
 * are positioned by start time and sized by real duration, so a half-hour sleep
 * covers half an hour of the rail. Kept apart from the view so it stays testable.
 */

export const HOUR_HEIGHT = 60;
export const DAY_MINUTES = 24 * 60;
export const DAY_HEIGHT = (DAY_MINUTES / 60) * HOUR_HEIGHT;
export const BLOCK_GAP = 3;
/** Anything without a duration still needs to be readable. */
export const MIN_BLOCK_HEIGHT = 26;
/** The shortest slot a block may hold before it crowds the one after it. */
export const MIN_SLOT_MINUTES =
  ((MIN_BLOCK_HEIGHT + BLOCK_GAP) / HOUR_HEIGHT) * 60;

export interface PlacedEvent {
  key: string;
  event: BabyEvent;
  /** Minutes past midnight on the shown day, clamped to that day. */
  startMinutes: number;
  /** Minutes of the day the block covers, before the minimum height applies. */
  spanMinutes: number;
  durationMinutes: number;
  endTime: Date | null;
  /** Runs past midnight, so the block is cut off at the bottom of the day. */
  clipped: boolean;
  /** Still running: no end time and no recorded duration. */
  ongoing: boolean;
  lane: number;
  laneCount: number;
}

export const minutesToOffset = (minutes: number) =>
  (minutes / 60) * HOUR_HEIGHT;

export const blockHeight = (spanMinutes: number) =>
  Math.max(MIN_BLOCK_HEIGHT, minutesToOffset(spanMinutes) - BLOCK_GAP);

const eventEnd = (event: BabyEvent, durationMinutes: number) => {
  if (event.endTime) return event.endTime;
  if (durationMinutes <= 0) return null;
  // A running sleep already measures up to `now`, so this lands on the minute.
  return new Date(event.startTime.getTime() + durationMinutes * 60_000);
};

/**
 * Positions events on the day, then packs overlapping ones into side-by-side
 * lanes. Lane counts are worked out per cluster of overlaps, so a lone feed at
 * 3am keeps the full width even when the evening is busy.
 */
export const placeEvents = (
  events: BabyEvent[],
  day: Date,
  now = new Date(),
): PlacedEvent[] => {
  const dayStart = new Date(day);
  dayStart.setHours(0, 0, 0, 0);

  const placed = events
    .map((event, index): PlacedEvent => {
      const startMinutes = Math.min(
        Math.max((event.startTime.getTime() - dayStart.getTime()) / 60_000, 0),
        DAY_MINUTES,
      );
      const durationMinutes = getEventDurationMinutes(event, now);
      return {
        key: event.id || `${event.startTime.getTime()}-${index}`,
        event,
        startMinutes,
        spanMinutes: Math.min(durationMinutes, DAY_MINUTES - startMinutes),
        durationMinutes,
        endTime: eventEnd(event, durationMinutes),
        clipped: startMinutes + durationMinutes > DAY_MINUTES,
        ongoing: !event.endTime && event.durationMinutes === undefined,
        lane: 0,
        laneCount: 1,
      };
    })
    .sort((left, right) => left.startMinutes - right.startMinutes);

  const slotEnd = (item: PlacedEvent) =>
    item.startMinutes + Math.max(item.spanMinutes, MIN_SLOT_MINUTES);

  let cluster: PlacedEvent[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -1;

  const closeCluster = () => {
    cluster.forEach(item => {
      item.laneCount = laneEnds.length;
    });
    cluster = [];
    laneEnds = [];
  };

  placed.forEach(item => {
    if (item.startMinutes >= clusterEnd) closeCluster();
    const free = laneEnds.findIndex(end => end <= item.startMinutes);
    if (free === -1) {
      item.lane = laneEnds.length;
      laneEnds.push(slotEnd(item));
    } else {
      item.lane = free;
      laneEnds[free] = slotEnd(item);
    }
    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, slotEnd(item));
  });
  closeCluster();

  return placed;
};

export const formatHourLabel = (hour: number) => {
  if (hour % 24 === 0) return '12am';
  if (hour === 12) return '12pm';
  return hour < 12 ? `${hour}am` : `${hour - 12}pm`;
};

export const formatClock = (date: Date) =>
  date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

const meridiem = (clock: string) => clock.match(/\s?[ap]\.?m\.?$/i)?.[0] || '';

/** "8:15–8:45 PM" rather than "8:15 PM – 8:45 PM". */
export const formatClockRange = (start: Date, end: Date) => {
  const from = formatClock(start);
  const to = formatClock(end);
  const suffix = meridiem(from);
  const shared = suffix && meridiem(to).toLowerCase() === suffix.toLowerCase();
  return `${shared ? from.slice(0, from.length - suffix.length) : from}–${to}`;
};

export const formatBlockDuration = (minutes: number) => {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const wholeHours = Math.floor(minutes / 60);
  const remainder = Math.round(minutes % 60);
  return remainder ? `${wholeHours}h ${remainder}m` : `${wholeHours}h`;
};

/** The one-line title shown inside a block. */
export const timelineEventLabel = (event: BabyEvent) => {
  if (event.type === 'feed') {
    if (event.metadata?.feedType === 'bottle') {
      const amount = event.metadata.amount;
      return amount
        ? `Bottle · ${amount}${event.metadata.unit || 'ml'}`
        : 'Bottle feed';
    }
    return event.metadata?.breastSide
      ? `Nursing · ${event.metadata.breastSide[0].toUpperCase()}${event.metadata.breastSide.slice(1)}`
      : 'Nursing';
  }
  if (event.type === 'diaper') {
    const condition = event.metadata?.diaperCondition;
    if (condition === 'both') return 'Wet + dirty nappy';
    return condition
      ? `${condition[0].toUpperCase()}${condition.slice(1)} nappy`
      : 'Nappy';
  }
  if (event.type === 'sleep') return 'Sleep';
  return careActionByType[event.type].label;
};

/** The times line under the title: a range and how long it ran, or a moment. */
export const timelineEventTiming = (item: PlacedEvent) => {
  if (!item.endTime) return formatClock(item.event.startTime);
  const range = formatClockRange(item.event.startTime, item.endTime);
  return `${range} · ${formatBlockDuration(item.durationMinutes)}${item.ongoing ? ' so far' : ''}`;
};
