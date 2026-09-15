import type { BabyEvent } from '../services/firebase/events';

/**
 * Combines the recent-activity window with the longer reference-record window.
 *
 * The two Firestore subscriptions overlap for anything logged in the last few
 * days, so entries are de-duplicated by id and the newest copy of a document
 * wins. Ordering matches the recent-activity query: newest measurement or
 * activity time first.
 */
export const mergeEventStreams = (...streams: BabyEvent[][]) => {
  const byId = new Map<string, BabyEvent>();
  const withoutId: BabyEvent[] = [];

  streams.forEach(stream => {
    stream.forEach(event => {
      if (!event.id) {
        withoutId.push(event);
        return;
      }
      const existing = byId.get(event.id);
      const isNewer =
        !existing ||
        (event.updatedAt?.getTime() || 0) >= (existing.updatedAt?.getTime() || 0);
      if (isNewer) byId.set(event.id, event);
    });
  });

  return [...byId.values(), ...withoutId].sort(
    (first, second) => second.startTime.getTime() - first.startTime.getTime(),
  );
};
