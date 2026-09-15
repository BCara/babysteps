import { homeCareActions, type HomeActionKey } from '../constants/careActions';
import type { BabyEvent } from '../services/firebase/events';
import { runningBreastSide } from './breastFeed';
import { formatTimeSinceEvent } from './feedTiming';
import {
  sleepLocationLabel,
  type CustomSleepLocation,
} from './sleepLocation';
import { formatDiaperAmountDetail } from './diaperAmounts';

export interface QuickCareWidgetSnapshot {
  key: HomeActionKey;
  label: string;
  summary: string;
  detail?: string;
  active: boolean;
  lastEventAtMs?: number;
  timerStartedAtMs?: number;
  leftSeconds?: number;
  rightSeconds?: number;
  activeSide?: 'left' | 'right';
  activeSideStartedAtMs?: number;
}

const relativeTime = (event: BabyEvent | undefined, now: Date) => {
  if (!event) return 'Not logged yet';
  const elapsed = formatTimeSinceEvent(event, now);
  return elapsed === 'Just now' ? elapsed : `${elapsed} ago`;
};

const appointmentTime = (event: BabyEvent, now: Date) =>
  event.startTime.getTime() > now.getTime()
    ? `Upcoming ${event.startTime.toLocaleDateString('en-AU', {
        day: 'numeric',
        month: 'short',
      })}, ${event.startTime.toLocaleTimeString('en-AU', {
        hour: 'numeric',
        minute: '2-digit',
      })}`
    : relativeTime(event, now);

const sentenceCase = (value: string | undefined) =>
  value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : undefined;

const eventDetail = (
  event: BabyEvent | undefined,
  customSleepLocations: readonly CustomSleepLocation[] = [],
) => {
  if (!event) return undefined;
  const metadata = event.metadata;

  switch (event.type) {
    case 'feed':
      return metadata?.amount
        ? `${metadata.amount} ${metadata.unit || 'ml'}`
        : undefined;
    case 'sleep':
      return metadata?.sleepType
        ? sleepLocationLabel(metadata.sleepType, customSleepLocations)
        : undefined;
    case 'diaper':
      return [
        metadata?.diaperCondition === 'both'
          ? 'Wet + dirty'
          : sentenceCase(metadata?.diaperCondition),
        formatDiaperAmountDetail(metadata),
      ].filter(Boolean).join(' · ') || undefined;
    case 'pumping': {
      const parts = [
        sentenceCase(metadata?.pumpingSide),
        metadata?.amount ? `${metadata.amount} ${metadata.unit || 'ml'}` : undefined,
      ];
      return parts.filter(Boolean).join(' · ') || undefined;
    }
    case 'solids':
      return [metadata?.food, metadata?.foodAmount].filter(Boolean).join(' · ') || undefined;
    case 'growth': {
      const parts = [
        metadata?.weightKg ? `${metadata.weightKg} kg` : undefined,
        metadata?.heightCm ? `${metadata.heightCm} cm` : undefined,
        metadata?.headCircumferenceCm
          ? `Head ${metadata.headCircumferenceCm} cm`
          : undefined,
      ];
      return parts.filter(Boolean).join(' · ') || undefined;
    }
    case 'potty':
      return [sentenceCase(metadata?.pottyType), sentenceCase(metadata?.pottyOutcome)]
        .filter(Boolean)
        .join(' · ') || undefined;
    case 'temperature':
      return metadata?.temperature
        ? `${metadata.temperature}°${metadata.temperatureUnit || 'C'}`
        : undefined;
    case 'medication':
      return [
        metadata?.medicineName,
        metadata?.doseAmount
          ? `${metadata.doseAmount} ${metadata.doseUnit || ''}`.trim()
          : undefined,
      ].filter(Boolean).join(' · ') || undefined;
    case 'milestone':
      return metadata?.milestone;
    case 'symptom':
      return metadata?.observation;
    case 'appointment':
      return [
        metadata?.appointmentType,
        metadata?.provider,
        metadata?.appointmentLocation,
      ].filter(Boolean).join(' · ') || undefined;
    case 'immunization':
      return [
        metadata?.immunization,
        metadata?.provider,
        metadata?.immunizationLocation,
      ].filter(Boolean).join(' · ') || undefined;
    case 'teething':
      return metadata?.tooth;
    case 'tummyTime':
    case 'bath':
      return event.durationMinutes ? `${event.durationMinutes} min` : undefined;
    default:
      return undefined;
  }
};

export const buildQuickCareWidgetSnapshots = (
  events: BabyEvent[],
  now = new Date(),
  customSleepLocations: readonly CustomSleepLocation[] = [],
): QuickCareWidgetSnapshot[] => {
  const detailFor = (event: BabyEvent | undefined) =>
    eventDetail(event, customSleepLocations);
  const activeFeed = events.find(event => event.type === 'feed' && !event.endTime);
  const activeNursing =
    activeFeed && activeFeed.metadata?.feedType !== 'bottle' ? activeFeed : undefined;
  const activeBottle =
    activeFeed?.metadata?.feedType === 'bottle' ? activeFeed : undefined;
  const lastNursing = events.find(
    event =>
      event.type === 'feed' &&
      event.metadata?.feedType !== 'bottle' &&
      Boolean(event.endTime),
  );
  const lastBottle = events.find(
    event =>
      event.type === 'feed' &&
      event.metadata?.feedType === 'bottle' &&
      Boolean(event.endTime),
  );

  return homeCareActions.map(definition => {
    if (definition.type === 'nursing') {
      const displayEvent = activeNursing || lastNursing;
      // Native widgets and Wear tiles advance the active side from
      // activeSideStartedAtMs. Keep these as persisted base totals so the
      // current interval is not counted once here and a second time natively.
      const durations = displayEvent
        ? {
            leftBreastDurationSeconds:
              displayEvent.metadata?.leftBreastDurationSeconds || 0,
            rightBreastDurationSeconds:
              displayEvent.metadata?.rightBreastDurationSeconds || 0,
          }
        : undefined;
      const activeSide = activeNursing
        ? runningBreastSide(activeNursing.metadata) || undefined
        : undefined;
      return {
        key: definition.type,
        label: definition.label,
        summary: activeNursing
          ? activeSide
            ? `${sentenceCase(activeSide)} side active`
            : 'Nursing paused'
          : relativeTime(lastNursing, now),
        detail: activeNursing ? 'Nursing now' : lastNursing ? 'Last nursing' : undefined,
        active: Boolean(activeNursing),
        lastEventAtMs: lastNursing?.startTime.getTime(),
        timerStartedAtMs: activeNursing?.startTime.getTime(),
        leftSeconds: durations?.leftBreastDurationSeconds,
        rightSeconds: durations?.rightBreastDurationSeconds,
        activeSide,
        activeSideStartedAtMs: activeNursing?.metadata?.breastSideStartedAtMs,
      };
    }

    if (definition.type === 'bottle') {
      return {
        key: definition.type,
        label: definition.label,
        summary: activeBottle ? 'Bottle running' : relativeTime(lastBottle, now),
        detail: activeBottle ? detailFor(activeBottle) : detailFor(lastBottle),
        active: Boolean(activeBottle),
        lastEventAtMs: (lastBottle?.endTime || lastBottle?.startTime)?.getTime(),
        timerStartedAtMs: activeBottle?.startTime.getTime(),
      };
    }

    const eventType = definition.type;
    const activeEvent = events.find(
      event => event.type === eventType && !event.endTime,
    );
    const lastEvent = events.find(
      event => event.type === eventType && Boolean(event.endTime),
    );
    const timed = eventType === 'sleep' || eventType === 'pumping';

    return {
      key: definition.type,
      label: definition.label,
      summary:
        activeEvent && timed
          ? eventType === 'sleep'
            ? 'Sleeping now'
            : 'Pumping now'
          : eventType === 'appointment' && lastEvent
            ? appointmentTime(lastEvent, now)
            : relativeTime(lastEvent, now),
      detail: detailFor(activeEvent || lastEvent),
      active: Boolean(activeEvent && timed),
      lastEventAtMs: (lastEvent?.endTime || lastEvent?.startTime)?.getTime(),
      timerStartedAtMs:
        activeEvent && timed ? activeEvent.startTime.getTime() : undefined,
    };
  });
};
