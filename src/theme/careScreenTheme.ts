import { nursingTokens, type NursingMode, type NursingTokens } from './nursingTheme';
import { careCardColors, hslToRgb, rgbToHsl } from './careColors';

const cache = new Map<string, Record<NursingMode, NursingTokens>>();
/** Keep Quick Care's exact activity hue throughout its forms and controls. */
export function careScreenTokens(pastel: string) {
  const existing = cache.get(pastel);
  if (existing) return existing;
  const { hue, saturation } = rgbToHsl(pastel);
  const tint = (lightness: number, scale = 0.4) => hslToRgb({ hue, saturation: saturation * scale, lightness });
  const build = (mode: NursingMode): NursingTokens => {
    const card = careCardColors(pastel, mode);
    const dark = mode === 'night';
    return {
      ...nursingTokens[mode],
      bgPage: tint(dark ? 0.06 : 0.085, 0.12),
      bgCard: tint(dark ? 0.105 : 0.14, 0.16),
      bgCardActive: tint(dark ? 0.14 : 0.18, 0.3),
      bgHeader: card.background,
      bgPrimary: card.background,
      bgPillActive: card.background,
      textOnFill: card.foreground,
      textOnHeader: card.foreground,
      accent: tint(dark ? 0.7 : 0.78, 0.65),
      borderActive: tint(0.55, 0.5),
      borderControl: tint(0.47, 0.15),
    };
  };
  const palettes = { standard: build('standard'), night: build('night') };
  cache.set(pastel, palettes);
  return palettes;
}
