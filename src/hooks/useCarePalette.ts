import { useAppearance } from '../providers/AppearanceProvider';
import { careCardColors } from '../theme/careColors';
import { eventColors } from '../theme/eventColors';
import type { NursingMode } from '../theme/nursingTheme';

const buildPalette = (mode: NursingMode) => {
  const cache = new Map<string, string>();
  const careColor = (pastel: string) => {
    let color = cache.get(pastel);
    if (!color) {
      color = careCardColors(pastel, mode).background;
      cache.set(pastel, color);
    }
    return color;
  };
  const card = careCardColors(eventColors.feed, mode);
  return {
    careColor,
    careInk: card.foreground,
    careBadge: card.badge,
    colors: Object.fromEntries(Object.entries(eventColors).map(([key, color]) =>
      [key, careColor(color)],
    )) as typeof eventColors,
  };
};

// Palettes are fixed: share their values across cards and timer ticks.
const palettes = { standard: buildPalette('standard'), night: buildPalette('night') };

export function useCarePalette() {
  const { mode } = useAppearance();
  return palettes[mode];
}
