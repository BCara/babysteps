import type { BabyEvent } from '../services/firebase/events';
import { mergeBlocker } from './mergeEvents';
import { breastDurationsForEvent } from './breastFeed';

// Data-review prompts, not clinical limits or a reason to change a record.
export const REVIEW_MINUTES = { feed: 90, pumping: 60, sleep: 720 } as const;
export const MERGE_GAP_MINUTES = 10;
export interface TimelineReview {
  reasons: string[];
  mergeWithId?: string;
  mergeReason?: string;
}

export function reviewTimeline(events: BabyEvent[], now = new Date()) {
  const reviews = new Map<string, TimelineReview>();
  const entries = events.filter(event => event.id && !event.deletedAt);
  const get = (event: BabyEvent) => {
    let review = reviews.get(event.id!);
    if (!review) { review = { reasons: [] }; reviews.set(event.id!, review); }
    return review;
  };
  for (const event of entries) {
    const start = event.startTime.getTime();
    const end = event.endTime?.getTime();
    const reasons: string[] = [];
    if (!Number.isFinite(start) || (end !== undefined && !Number.isFinite(end))) {
      reasons.push('Check the date: a timestamp is missing or invalid.');
    } else {
      if (end !== undefined && end < start) reasons.push('End time is before start time.');
      if (event.type !== 'appointment' && (start > now.getTime() + 300_000 || (end ?? 0) > now.getTime() + 300_000)) {
        reasons.push('This entry is dated in the future.');
      }
      const limit = REVIEW_MINUTES[event.type as keyof typeof REVIEW_MINUTES];
      const spanMinutes = ((end ?? now.getTime()) - start) / 60_000;
      const nursing = event.type === 'feed' && event.metadata?.feedType === 'breast';
      const sides = nursing ? breastDurationsForEvent(event, now.getTime()) : null;
      const trackedMinutes = sides
        ? (sides.leftBreastDurationSeconds + sides.rightBreastDurationSeconds) / 60 : 0;
      // Match the nursing total displayed on the card; pauses and merged
      // sessions can have a much longer timestamp span than active feeding.
      const minutes = nursing
        ? trackedMinutes > 0 ? trackedMinutes : event.durationMinutes ?? spanMinutes
        : Math.max(event.durationMinutes ?? 0, spanMinutes);
      if (limit && minutes > limit) {
        const label = limit < 120 ? `${limit} minutes` : `${limit / 60} hours`;
        reasons.push(`${nursing ? 'Logged feeding time' : event.endTime ? 'Duration' : 'Timer running'} over ${label}. Check this entry.`);

      }
    }
    if (event.durationMinutes !== undefined && (!Number.isFinite(event.durationMinutes) || event.durationMinutes < 0)) {
      reasons.push('Recorded duration is invalid.');
    }
    if (reasons.length) get(event).reasons.push(...reasons);
  }

  const ordered = [...entries].filter(event => Number.isFinite(event.startTime.getTime()))
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  for (let index = 1; index < ordered.length; index++) {
    const previous = ordered[index - 1];
    const current = ordered[index];
    if (!previous.endTime || !current.endTime || previous.type !== current.type) continue;
    if (!['feed', 'sleep', 'pumping'].includes(current.type)) continue;
    if (mergeBlocker([previous, current])) continue;
    const gap = (current.startTime.getTime() - previous.endTime.getTime()) / 60_000;
    if (gap < 0) {
      const reason = 'Overlaps another saved time range of the same type. Check timestamps or duplicates; this does not necessarily mean the active sessions overlapped.';
      get(previous).reasons.push(reason);
      get(current).reasons.push(reason);
      continue;
    }
    if (gap > MERGE_GAP_MINUTES || !Number.isFinite(gap)) continue;
    if (current.type === 'sleep' && current.metadata?.sleepType !== previous.metadata?.sleepType) continue;
    if (get(previous).reasons.length || get(current).reasons.length) continue;
    if (get(previous).mergeWithId || get(current).mergeWithId) continue;
    const reason = gap === 0 ? 'Back-to-back sessions - possibly one session.'
      : `Sessions ${Math.ceil(gap)} min apart - possibly one session.`;
    Object.assign(get(previous), { mergeWithId: current.id, mergeReason: reason });
    Object.assign(get(current), { mergeWithId: previous.id, mergeReason: reason });
  }
  // Only keep entries which actually need a badge.
  for (const [id, review] of reviews) {
    if (review.mergeWithId && (review.reasons.length || reviews.get(review.mergeWithId)?.reasons.length)) {
      const other = reviews.get(review.mergeWithId);
      if (other) { delete other.mergeWithId; delete other.mergeReason; }
      delete review.mergeWithId;
      delete review.mergeReason;
    }
  }
  for (const [id, review] of reviews) {
    if (!review.reasons.length && !review.mergeWithId) reviews.delete(id);
  }
  return reviews;
}
