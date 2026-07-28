import { BabyEvent } from '../services/firebase/events';

export interface EventSummary {
  feeds: number;
  diapers: number;
  sleepMinutes: number;
  activeSleeps: number;
}

export const getEventDurationMinutes = (event: BabyEvent, now = new Date()) => {
  if (event.durationMinutes !== undefined) {
    return Math.max(0, event.durationMinutes);
  }

  if (event.type !== 'sleep') return 0;
  const endTime = event.endTime || now;
  return Math.max(
    0,
    Math.round((endTime.getTime() - event.startTime.getTime()) / 60000),
  );
};

export const summarizeEvents = (
  events: BabyEvent[],
  includeActiveSleep = false,
  now = new Date(),
): EventSummary =>
  events.reduce<EventSummary>(
    (summary, event) => {
      if (event.type === 'feed') summary.feeds += 1;
      if (event.type === 'diaper') summary.diapers += 1;
      if (event.type === 'sleep') {
        if (!event.endTime) summary.activeSleeps += 1;
        if (event.endTime || includeActiveSleep) {
          summary.sleepMinutes += getEventDurationMinutes(event, now);
        }
      }
      return summary;
    },
    { feeds: 0, diapers: 0, sleepMinutes: 0, activeSleeps: 0 },
  );

export const isSameLocalDay = (left: Date, right: Date) =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();
