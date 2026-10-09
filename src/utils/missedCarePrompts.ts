/**
 * How often a caregiver is asked about a possibly missed sleep or feed.
 *
 * Saying "no" to a gap means that gap is never raised again. Saying "no"
 * repeatedly means the suggestions are not useful right now, so each one in a
 * row buys a longer quiet spell. Adding one resets that: they were useful.
 */

export interface MissedCarePromptState {
  enabled: boolean;
  /** Gap keys the caregiver has answered, newest last. */
  answered: string[];
  /** "No"s since the last suggestion that was taken up. */
  declinesInARow: number;
  /** Epoch ms before which nothing new is suggested. */
  quietUntil: number;
}

export const initialMissedCarePromptState: MissedCarePromptState = {
  enabled: true,
  answered: [],
  declinesInARow: 0,
  quietUntil: 0,
};

const HOUR = 60 * 60 * 1000;
/** Quiet spell after the first, second and third-or-later "no" in a row. */
export const QUIET_AFTER_DECLINES = [3 * HOUR, 12 * HOUR, 72 * HOUR];
/** Gaps only reach back a day, so a short memory of answers is plenty. */
const MAX_ANSWERED = 60;

const remember = (answered: string[], key: string) =>
  [...answered.filter(item => item !== key), key].slice(-MAX_ANSWERED);

export const declineMissedCare = (
  state: MissedCarePromptState,
  key: string,
  now: number,
): MissedCarePromptState => {
  const declinesInARow = state.declinesInARow + 1;
  const quiet =
    QUIET_AFTER_DECLINES[Math.min(declinesInARow, QUIET_AFTER_DECLINES.length) - 1];
  return {
    ...state,
    answered: remember(state.answered, key),
    declinesInARow,
    quietUntil: now + quiet,
  };
};

export const acceptMissedCare = (
  state: MissedCarePromptState,
  key: string,
): MissedCarePromptState => ({
  ...state,
  answered: remember(state.answered, key),
  declinesInARow: 0,
});

export const canSuggestMissedCare = (state: MissedCarePromptState, now: number) =>
  state.enabled && now >= state.quietUntil;

export const parseMissedCarePromptState = (raw: string | null): MissedCarePromptState => {
  if (!raw) return initialMissedCarePromptState;
  try {
    const value = JSON.parse(raw) as Partial<MissedCarePromptState>;
    return {
      enabled: value.enabled !== false,
      answered: Array.isArray(value.answered)
        ? value.answered.filter((item): item is string => typeof item === 'string')
        : [],
      declinesInARow: Number.isFinite(value.declinesInARow) ? Number(value.declinesInARow) : 0,
      quietUntil: Number.isFinite(value.quietUntil) ? Number(value.quietUntil) : 0,
    };
  } catch {
    return initialMissedCarePromptState;
  }
};
