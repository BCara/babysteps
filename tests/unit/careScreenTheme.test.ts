import { describe, expect, it } from 'vitest';
import { eventColors } from '../../src/theme/eventColors';
import { careCardColors } from '../../src/theme/careColors';
import { careScreenTokens } from '../../src/theme/careScreenTheme';
import { contrastRatio, relativeLuminance } from '../../src/utils/contrast';

describe('shared activity screen palettes', () => {
  for (const [activity, color] of Object.entries(eventColors)) {
    for (const mode of ['standard', 'night'] as const) {
      it(`${activity}/${mode} keeps its Quick Care colour and readable dark fields`, () => {
        const tokens = careScreenTokens(color)[mode];
        const card = careCardColors(color, mode);
        expect(tokens.bgHeader).toBe(card.background);
        expect(tokens.bgPrimary).toBe(card.background);
        expect(relativeLuminance(tokens.bgPage)).toBeLessThan(0.05);
        expect(relativeLuminance(tokens.bgCard)).toBeLessThan(0.05);
        expect(contrastRatio(tokens.textOnFill, tokens.bgPrimary)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(tokens.textPrimary, tokens.bgCard)).toBeGreaterThanOrEqual(7);
        expect(contrastRatio(tokens.accent, tokens.bgCard)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
  it('reuses stable palettes during timer redraws', () => {
    expect(careScreenTokens(eventColors.pumping)).toBe(careScreenTokens(eventColors.pumping));
  });
});
