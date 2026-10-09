import { timerLimitLabel } from './timerLimits';

/**
 * How hard the baby was to get down, and how long it took.
 *
 * This is deliberately separate from the sleep itself. A sleep record's
 * `startTime` is the moment the baby fell asleep and `durationMinutes` is how
 * long they stayed that way — the number the daily totals are built from. The
 * forty minutes of walking the hallway beforehand is not sleep, so folding it
 * into either would make the totals lie. It lives in its own two fields.
 */
export const SETTLING_DIFFICULTIES = ['easy', 'someFuss', 'hard'] as const;

export type SettlingDifficulty = (typeof SETTLING_DIFFICULTIES)[number];

export interface SettlingDifficultyDefinition {
  id: SettlingDifficulty;
  label: string;
  icon: string;
}

export const SETTLING_DIFFICULTY_DEFINITIONS: SettlingDifficultyDefinition[] = [
  { id: 'easy', label: 'Easy', icon: 'emoticon-happy-outline' },
  { id: 'someFuss', label: 'Some fuss', icon: 'emoticon-neutral-outline' },
  { id: 'hard', label: 'Hard', icon: 'emoticon-sad-outline' },
];

const difficultyLabels: Record<SettlingDifficulty, string> = {
  easy: 'Easy',
  someFuss: 'Some fuss',
  hard: 'Hard',
};

export const isSettlingDifficulty = (
  value: string | undefined,
): value is SettlingDifficulty =>
  SETTLING_DIFFICULTIES.includes(value as SettlingDifficulty);

export const settlingDifficultyLabel = (value: SettlingDifficulty | undefined) =>
  value && isSettlingDifficulty(value) ? difficultyLabels[value] : undefined;

/**
 * Nothing here is required, so choosing the difficulty that is already chosen
 * clears it — the same "tap again to clear" the sleep places use.
 */
export const toggleSettlingDifficulty = (
  current: SettlingDifficulty | undefined,
  next: SettlingDifficulty,
) => (current === next ? undefined : next);

/**
 * The handful of answers that cover most nights, so the usual log is one tap
 * rather than a keyboard. Anything else is typed.
 */
export const SETTLING_MINUTE_CHIPS = [5, 10, 20, 30, 45] as const;

/** Past this it stopped being settling and became a night. */
export const MAX_SETTLING_MINUTES = 240;

export type SettlingCheck =
  | { error: string; minutes?: undefined }
  | { error?: undefined; minutes: number | undefined };

/**
 * Reads the typed minutes.
 *
 * Blank is a real answer — it means nobody recorded it — and is kept distinct
 * from a recorded zero, which means the baby went down without a murmur.
 */
export const checkSettlingMinutes = (value: string): SettlingCheck => {
  const trimmed = value.trim();
  if (!trimmed) return { minutes: undefined };

  const minutes = Number(trimmed);
  if (!Number.isFinite(minutes) || minutes < 0) {
    return {
      error: 'Enter how many minutes settling took, or leave it blank.',
    };
  }
  if (minutes > MAX_SETTLING_MINUTES) {
    return {
      error: `Settling can be at most ${timerLimitLabel(MAX_SETTLING_MINUTES)}.`,
    };
  }

  return { minutes: Math.round(minutes) };
};

/** The stored minutes as the text field wants them: a number, or nothing. */
export const settlingMinutesInput = (minutes: number | undefined) =>
  typeof minutes === 'number' && Number.isFinite(minutes) && minutes >= 0
    ? String(Math.round(minutes))
    : '';

/** True when the typed value already matches this chip, so tapping it clears. */
export const settlingChipSelected = (value: string, chipMinutes: number) =>
  checkSettlingMinutes(value).minutes === chipMinutes;

export const toggleSettlingChip = (value: string, chipMinutes: number) =>
  settlingChipSelected(value, chipMinutes) ? '' : String(chipMinutes);

export interface SettlingMetadata {
  settlingMinutes?: number;
  settlingDifficulty?: SettlingDifficulty;
}

/**
 * How a settled sleep reads in the timeline and the export — "20 min to
 * settle · Hard", or whichever half of it was recorded.
 */
export const describeSettling = (
  metadata: SettlingMetadata | undefined,
): string | undefined => {
  if (!metadata) return undefined;

  const parts: string[] = [];
  const minutes = metadata.settlingMinutes;
  if (typeof minutes === 'number' && Number.isFinite(minutes) && minutes >= 0) {
    parts.push(
      minutes === 0
        ? 'Settled straight away'
        : `${Math.round(minutes)} min to settle`,
    );
  }

  const difficulty = settlingDifficultyLabel(metadata.settlingDifficulty);
  if (difficulty) parts.push(difficulty);

  return parts.length ? parts.join(' · ') : undefined;
};
