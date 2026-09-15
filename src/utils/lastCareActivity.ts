import type { BabyEvent } from '../services/firebase/events';
import { homeCareActions } from '../constants/careActions';
import { formatTimeSinceEventStart } from './feedTiming';

export function lastActivityAgo(startTime: Date, now = new Date()) {
  const elapsed = formatTimeSinceEventStart(startTime, now);
  return elapsed === 'Just now' ? 'Just now' : `${elapsed} ago`;
}

export function lastCareActivity(events: BabyEvent[], icon: string, now = new Date()) {
  const action = homeCareActions.find(item => item.icon === icon);
  if (!action) return null;
  return events.reduce<BabyEvent | null>((latest, event) => {
    const matches = action.type === 'nursing'
      ? event.type === 'feed' && event.metadata?.feedType === 'breast'
      : action.type === 'bottle'
        ? event.type === 'feed' && event.metadata?.feedType === 'bottle'
        : event.type === action.type;
    const time = event.startTime.getTime();
    if (!matches || !Number.isFinite(time) || time > now.getTime()) return latest;
    return !latest || time > latest.startTime.getTime() ? event : latest;
  }, null);
}
