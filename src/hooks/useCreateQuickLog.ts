import { useEvents } from '../providers/EventProvider';
import type { QuickLogInput } from '../components/LogModal';

/**
 * Writes a new feed, sleep or nappy from the quick log form and reports what
 * to say about it. Creating is the same wherever the form was opened from, so
 * Home and Activity share this rather than each keeping their own copy of the
 * argument order.
 */
export function useCreateQuickLog() {
  const { logFeed, logSleep, logDiaper } = useEvents();

  return async (input: QuickLogInput): Promise<string> => {
    if (input.type === 'feed') {
      await logFeed(input);
      return 'Feed logged';
    }
    if (input.type === 'diaper') {
      await logDiaper(
        input.condition,
        input.notes,
        input.startTime,
        input.diaperAmount,
        input.wetDiaperAmount,
        input.dirtyDiaperAmount,
      );
      return 'Nappy logged';
    }
    await logSleep(
      input.durationMinutes,
      input.notes,
      input.sleepType,
      { startTime: input.startTime, endTime: input.endTime },
      {
        settlingMinutes: input.settlingMinutes,
        settlingDifficulty: input.settlingDifficulty,
      },
    );
    return 'Sleep logged';
  };
}
