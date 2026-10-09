import {
  selectedSleepLocations,
  sleepLocationLabel,
  type CustomSleepLocation,
  type SleepType,
} from '../../utils/sleepLocation';
import {
  SETTLING_DIFFICULTY_DEFINITIONS,
  type SettlingDifficulty,
} from '../../utils/sleepSettling';

/**
 * What the collapsed details already hold, in a few words — "Cot · Easy · 10m"
 * — so nothing filled in below the fold is out of sight as well as out of mind.
 */
export const sleepDetailsSummary = ({
  sleepType,
  customSleepLocations,
  settlingDifficulty,
  settlingMinutes,
}: {
  sleepType?: SleepType;
  customSleepLocations: readonly CustomSleepLocation[];
  settlingDifficulty?: SettlingDifficulty;
  settlingMinutes?: number;
}) =>
  [
    selectedSleepLocations(sleepType).length
      ? sleepLocationLabel(sleepType, customSleepLocations)
      : undefined,
    SETTLING_DIFFICULTY_DEFINITIONS.find(item => item.id === settlingDifficulty)?.label,
    settlingMinutes ? `${settlingMinutes}m` : undefined,
  ]
    .filter(Boolean)
    .join(' · ');
