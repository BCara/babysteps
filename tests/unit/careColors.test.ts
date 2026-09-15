import { describe, expect, it } from 'vitest';
import { contrastRatio, relativeLuminance } from '../../src/utils/contrast';
import {
  careCardColors,
  nightCareColor,
  rgbToHsl,
} from '../../src/theme/careColors';
import { eventColors } from '../../src/theme/eventColors';

const pastels = Object.entries(eventColors);

describe('quick care card colours', () => {
  it('keeps the pastel itself during the day', () => {
    pastels.forEach(([name, pastel]) => {
      expect(careCardColors(pastel, 'standard').background, name).toBe(pastel);
    });
  });

  it('holds each card legible against its own ink in both modes', () => {
    pastels.forEach(([name, pastel]) => {
      (['standard', 'night'] as const).forEach(mode => {
        const card = careCardColors(pastel, mode);
        expect(
          contrastRatio(card.foreground, card.background),
          `${name}/${mode}`,
        ).toBeGreaterThanOrEqual(7);
      });
    });
  });

  it('darkens every card at night', () => {
    pastels.forEach(([name, pastel]) => {
      expect(
        relativeLuminance(nightCareColor(pastel)),
        name,
      ).toBeLessThan(relativeLuminance(pastel));
    });
  });

  it('carries the hue across unchanged, so a card still names its activity', () => {
    // Rounding back to 8-bit channels is the only thing allowed to move the
    // hue. It moves it most on the near-grey pastels, where a single unit of
    // channel rounding is a larger angle — the worst of them (immunisation,
    // #D7E9DF) lands at 2 degrees, far below a perceptible step.
    pastels.forEach(([name, pastel]) => {
      const drift = Math.abs(
        rgbToHsl(nightCareColor(pastel)).hue - rgbToHsl(pastel).hue,
      );
      expect(drift, name).toBeLessThan(3);
    });
  });

  it('keeps the activities distinguishable from each other at night', () => {
    // Two cards collapsing to the same dark grey would make the night home
    // screen unreadable at a glance, which is when it matters most.
    const night = pastels.map(([, pastel]) => nightCareColor(pastel));
    expect(new Set(night).size).toBe(night.length);
  });
});
