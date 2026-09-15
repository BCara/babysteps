import type { NursingMode } from './nursingTheme';

/**
 * How a Quick Care card is coloured in each appearance mode.
 *
 * The pastels identify the activity and the mode sets the luminance, which is
 * the same contract the full-screen care designs keep. So a card and the screen
 * it opens read as one activity in daylight and again at 3am, without the home
 * screen having to go dark in the middle of the afternoon.
 */
export interface CareCardColors {
  /** The card itself. */
  background: string;
  /** Titles, values and icons on the card. */
  foreground: string;
  /** The rounded well behind the card's own icon. */
  badge: string;
  /** A quick action pill. */
  tile: string;
  /** A quick action pill that is the running one. */
  tileActive: string;
  /** The small well behind a quick action's icon. */
  iconWell: string;
  /** The ring drawn around the card while its panel is open. */
  selectedBorder: string;
}

/** The ink the pastel cards were designed around. */
const DAY_INK = '#302C3B';

/** Night cards sit at this lightness, whatever pastel they started from. */
const NIGHT_LIGHTNESS = 0.19;
/** Pastels are near-white, so night keeps only a portion of their saturation. */
const NIGHT_SATURATION_SCALE = 0.62;
const NIGHT_INK = '#E4E1DA';

const toRgb = (hex: string) =>
  [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255);

const toHex = (rgb: number[]) =>
  `#${rgb
    .map(channel =>
      Math.round(Math.min(1, Math.max(0, channel)) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`.toUpperCase();

interface Hsl {
  hue: number;
  saturation: number;
  lightness: number;
}

export const rgbToHsl = (hex: string): Hsl => {
  const [red, green, blue] = toRgb(hex);
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  const delta = max - min;

  if (delta === 0) return { hue: 0, saturation: 0, lightness };

  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  const hue =
    max === red
      ? ((green - blue) / delta) % 6
      : max === green
        ? (blue - red) / delta + 2
        : (red - green) / delta + 4;

  return { hue: (hue * 60 + 360) % 360, saturation, lightness };
};

export const hslToRgb = ({ hue, saturation, lightness }: Hsl) => {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const secondary = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const match = lightness - chroma / 2;
  const sector = Math.floor(hue / 60) % 6;
  const rgb = [
    [chroma, secondary, 0],
    [secondary, chroma, 0],
    [0, chroma, secondary],
    [0, secondary, chroma],
    [secondary, 0, chroma],
    [chroma, 0, secondary],
  ][sector];

  return toHex(rgb.map(channel => channel + match));
};

/**
 * The night version of a Quick Care pastel: the same hue, taken down to a
 * surface a dark room can carry. Hue is preserved exactly, so the card still
 * names its activity — only the luminance moves, matching how the care screens
 * treat their own two modes.
 */
export const nightCareColor = (pastel: string) => {
  const { hue, saturation } = rgbToHsl(pastel);
  return hslToRgb({
    hue,
    saturation: saturation * NIGHT_SATURATION_SCALE,
    lightness: NIGHT_LIGHTNESS,
  });
};

export const careCardColors = (
  pastel: string,
  mode: NursingMode,
): CareCardColors =>
  mode === 'night'
    ? {
        background: nightCareColor(pastel),
        foreground: NIGHT_INK,
        badge: 'rgba(255,255,255,0.10)',
        tile: 'rgba(255,255,255,0.13)',
        tileActive: 'rgba(255,255,255,0.26)',
        iconWell: 'rgba(0,0,0,0.24)',
        selectedBorder: NIGHT_INK,
      }
    : {
        background: pastel,
        foreground: DAY_INK,
        badge: 'rgba(255,255,255,0.46)',
        tile: 'rgba(255,255,255,0.62)',
        tileActive: 'rgba(48,44,59,0.18)',
        iconWell: 'rgba(48,44,59,0.09)',
        selectedBorder: DAY_INK,
      };
