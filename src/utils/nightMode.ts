import type { NursingMode } from '../theme/nursingTheme';

// Keep stored values compatible: standard is Day, night is Dark.
export type NursingModePreference = 'auto' | 'standard' | 'night';
export const NIGHT_START_HOUR = 21;
export const NIGHT_END_HOUR = 7;

export const isNightHour = (now: Date) => {
  const hour = now.getHours();
  return hour >= NIGHT_START_HOUR || hour < NIGHT_END_HOUR;
};

export interface NursingModeInputs {
  preference: NursingModePreference;
  now: Date;
}

/** Manual choices always win. Auto follows the local clock across the app. */
export const resolveNursingMode = ({ preference, now }: NursingModeInputs): NursingMode =>
  preference === 'auto' ? (isNightHour(now) ? 'night' : 'standard') : preference;
