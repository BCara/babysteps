import type { BabyEvent, BabyEventType } from '../services/firebase/events';

export type TimelineTypeFilter = BabyEventType | 'all';

export const filterTimelineEvents = (
  events: BabyEvent[],
  selectedType: TimelineTypeFilter,
) =>
  selectedType === 'all'
    ? events
    : events.filter(event => event.type === selectedType);
