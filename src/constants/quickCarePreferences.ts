export type ConfigurableQuickCareKey =
  | 'nursing'
  | 'bottle'
  | 'sleep'
  | 'diaper'
  | 'pumping';

import {
  isBuiltInSleepLocation,
  isCustomSleepLocation,
  type SleepLocation,
} from '../utils/sleepLocation';

export interface QuickCarePreference {
  mode: 'auto' | 'specific';
  breastSide?: 'left' | 'right';
  bottleAmount?: number;
  bottleUnit?: 'ml' | 'oz';
  sleepType?: SleepLocation;
  diaperCondition?: 'wet' | 'dirty' | 'both';
  pumpingSide?: 'left' | 'right' | 'both';
}

export type QuickCarePreferences = Partial<
  Record<ConfigurableQuickCareKey, QuickCarePreference>
>;

const configurableKeys: ConfigurableQuickCareKey[] = [
  'nursing',
  'bottle',
  'sleep',
  'diaper',
  'pumping',
];

export const sanitizeQuickCarePreferences = (
  value: unknown,
): QuickCarePreferences => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  return configurableKeys.reduce<QuickCarePreferences>((result, key) => {
    const candidate = (value as Record<string, unknown>)[key];
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      return result;
    }

    const raw = candidate as Record<string, unknown>;
    const mode = raw.mode === 'specific' ? 'specific' : 'auto';
    const preference: QuickCarePreference = { mode };

    if (raw.breastSide === 'left' || raw.breastSide === 'right') {
      preference.breastSide = raw.breastSide;
    }
    if (
      typeof raw.bottleAmount === 'number' &&
      Number.isFinite(raw.bottleAmount) &&
      raw.bottleAmount > 0
    ) {
      preference.bottleAmount = raw.bottleAmount;
    }
    if (raw.bottleUnit === 'ml' || raw.bottleUnit === 'oz') {
      preference.bottleUnit = raw.bottleUnit;
    }
    if (
      typeof raw.sleepType === 'string' &&
      (isBuiltInSleepLocation(raw.sleepType) ||
        isCustomSleepLocation(raw.sleepType))
    ) {
      // A custom place is kept even if its definition has since been deleted:
      // the sleep screen falls back on its own, and dropping it here would
      // silently reset a caregiver's pinned choice.
      preference.sleepType = raw.sleepType;
    } else if (raw.sleepType === 'nap' || raw.sleepType === 'night') {
      preference.sleepType = 'cot';
    }
    if (
      raw.diaperCondition === 'wet' ||
      raw.diaperCondition === 'dirty' ||
      raw.diaperCondition === 'both'
    ) {
      preference.diaperCondition = raw.diaperCondition;
    }
    if (
      raw.pumpingSide === 'left' ||
      raw.pumpingSide === 'right' ||
      raw.pumpingSide === 'both'
    ) {
      preference.pumpingSide = raw.pumpingSide;
    }

    result[key] = preference;
    return result;
  }, {});
};
