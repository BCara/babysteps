import type { BabyEvent } from '../services/firebase/events';

export const TIMER_LIMIT_MINUTES = {
  feed: 180,
  pumping: 120,
  sleep: 1_080,
} as const;

export type LimitedTimerType = keyof typeof TIMER_LIMIT_MINUTES;

export const isLimitedTimer = (
  event: BabyEvent,
): event is BabyEvent & { type: LimitedTimerType } =>
  event.type === 'feed' || event.type === 'sleep' || event.type === 'pumping';

export const timerLimitMinutes = (event: Pick<BabyEvent, 'type'>) =>
  event.type === 'feed' || event.type === 'sleep' || event.type === 'pumping'
    ? TIMER_LIMIT_MINUTES[event.type]
    : null;

export const timerDeadline = (event: Pick<BabyEvent, 'type' | 'startTime'>) => {
  const limitMinutes = timerLimitMinutes(event);
  return limitMinutes === null
    ? null
    : new Date(event.startTime.getTime() + limitMinutes * 60_000);
};

export const cappedTimerEnd = (
  event: Pick<BabyEvent, 'type' | 'startTime'>,
  requestedEnd = new Date(),
) => {
  const deadline = timerDeadline(event);
  return deadline && requestedEnd > deadline ? deadline : requestedEnd;
};

export const timerLimitLabel = (minutes: number) => {
  const hours = minutes / 60;
  return Number.isInteger(hours) ? `${hours} hour${hours === 1 ? '' : 's'}` : `${minutes} minutes`;
};
