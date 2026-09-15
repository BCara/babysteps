/** Dark backgrounds throughout; activity fills are pastel by day and darker at night. */
export type NursingMode = 'standard' | 'night';

/** The activities that have a full-screen design of their own. */
export type ActivityHue = 'nursing' | 'sleep';

export interface NursingTokens {
  bgPage: string;
  bgCard: string;
  bgCardActive: string;
  bgHeader: string;
  bgPrimary: string;
  bgPillActive: string;
  borderHairline: string;
  borderControl: string;
  borderActive: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textOnFill: string;
  textOnHeader: string;
  accent: string;
  /** Discarding, and nothing else: the one colour that is not a warm neutral. */
  danger: string;
}

const standard: NursingTokens = {
  bgPage: '#151514',
  bgCard: '#232220',
  bgCardActive: '#2E211C',
  bgHeader: '#FFB5A7',
  bgPrimary: '#FFD0BE',
  bgPillActive: '#F5C4B2',
  borderHairline: '#383733',
  borderControl: '#7D7B74',
  borderActive: '#B07A62',
  textPrimary: '#E4E1DA',
  textSecondary: '#A5A199',
  textTertiary: '#B0ADA7',
  textOnFill: '#302C2A',
  textOnHeader: '#302C2A',
  accent: '#D99A7E',
  danger: '#E2796A',
};

const night: NursingTokens = {
  bgPage: '#0F0F0E',
  bgCard: '#1A1918',
  bgCardActive: '#241A15',
  bgHeader: '#5A3024',
  bgPrimary: '#77412B',
  bgPillActive: '#6B4939',
  borderHairline: '#2B2A27',
  borderControl: '#4A4945',
  borderActive: '#6B4939',
  textPrimary: '#C4C1BA',
  textSecondary: '#8E8C86',
  textTertiary: '#97958F',
  textOnFill: '#E8D5CC',
  textOnHeader: '#DCC5BB',
  accent: '#B07A62',
  danger: '#C4685A',
};

/**
 * Sleep, at the same luminance levels as nursing with the hue carried over from
 * its Quick Care card. Every contrast pair lands where nursing's does, so the
 * two share one audit and one set of pinned deviations.
 */
const sleepStandard: NursingTokens = {
  ...standard,
  bgPage: '#14161A',
  bgCard: '#20242A',
  bgCardActive: '#1C2836',
  bgHeader: '#A9DEF9',
  bgPrimary: '#C4E8FC',
  bgPillActive: '#B5D9EF',
  borderHairline: '#33373D',
  borderControl: '#747D87',
  borderActive: '#628FB0',
  textPrimary: '#DAE0E6',
  textSecondary: '#99A3AD',
  textTertiary: '#A7B0BA',
  textOnFill: '#293039',
  textOnHeader: '#293039',
  accent: '#7EBAD9',
};

const sleepNight: NursingTokens = {
  bgPage: '#0E1013',
  bgCard: '#181B20',
  bgCardActive: '#151E28',
  bgHeader: '#21374A',
  bgPrimary: '#284A63',
  bgPillActive: '#3A5266',
  borderHairline: '#272A2F',
  borderControl: '#454A52',
  borderActive: '#3A5266',
  textPrimary: '#BAC0C6',
  textSecondary: '#868E97',
  textTertiary: '#8F97A0',
  textOnFill: '#CCDCE8',
  textOnHeader: '#BBCCDC',
  accent: '#628FB0',
  danger: '#C4685A',
};

export const activityTokens: Record<
  ActivityHue,
  Record<NursingMode, NursingTokens>
> = {
  nursing: { standard, night },
  sleep: { standard: sleepStandard, night: sleepNight },
};

export const activityHues = Object.keys(activityTokens) as ActivityHue[];

export const nursingTokens = activityTokens.nursing;

export const nursingTokenKeys = Object.keys(standard) as Array<
  keyof NursingTokens
>;

/** Header title and icons sit one step down from full strength. */
export const HEADER_ICON_OPACITY = 0.78;

/** Cross-fade duration when the mode changes, in milliseconds. */
export const MODE_FADE_MS = 400;
