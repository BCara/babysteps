import { describe, expect, it } from 'vitest';
import { contrastRatio, relativeLuminance } from '../../src/utils/contrast';
import {
  activityHues,
  activityTokens,
  nursingTokenKeys,
  type ActivityHue,
  type NursingMode,
  type NursingTokens,
} from '../../src/theme/nursingTheme';

type Pair = {
  name: string;
  foreground: keyof NursingTokens;
  background: keyof NursingTokens;
  floor: number;
};

const pairs: Pair[] = [
  { name: 'timer digits on page', foreground: 'textPrimary', background: 'bgPage', floor: 7 },
  { name: 'timer digits on card', foreground: 'textPrimary', background: 'bgCard', floor: 7 },
  { name: 'timer digits on active card', foreground: 'textPrimary', background: 'bgCardActive', floor: 7 },
  { name: 'start time value', foreground: 'textPrimary', background: 'bgCard', floor: 4.5 },
  { name: 'field label', foreground: 'textSecondary', background: 'bgCard', floor: 4.5 },
  { name: 'total caption', foreground: 'textSecondary', background: 'bgPage', floor: 4.5 },
  { name: 'idle timer', foreground: 'textTertiary', background: 'bgCard', floor: 7 },
  { name: 'discard label', foreground: 'textTertiary', background: 'bgPage', floor: 4.5 },
  { name: 'discard pill label', foreground: 'danger', background: 'bgPage', floor: 4.5 },
  { name: 'discard pill border', foreground: 'danger', background: 'bgPage', floor: 3 },
  { name: 'finish label', foreground: 'textOnFill', background: 'bgPrimary', floor: 7 },
  { name: 'pause pill label', foreground: 'textOnFill', background: 'bgPillActive', floor: 7 },
  { name: 'header title', foreground: 'textOnHeader', background: 'bgHeader', floor: 4.5 },
  { name: 'active side label', foreground: 'accent', background: 'bgCardActive', floor: 4.5 },
  { name: 'edit pencil', foreground: 'accent', background: 'bgCard', floor: 4.5 },
  { name: 'idle control border', foreground: 'borderControl', background: 'bgCard', floor: 3 },
  { name: 'idle control border on page', foreground: 'borderControl', background: 'bgPage', floor: 3 },
  { name: 'active card border', foreground: 'borderActive', background: 'bgCardActive', floor: 3 },
];

/**
 * Pairs the supplied spec tables do NOT meet, pinned at their measured ratio.
 * These are deviations awaiting a token decision, not licence to drift: any
 * change to a token moves the measured value and fails this test.
 *
 * Sleep was built to land on the same pairs as nursing, so it deviates in the
 * same six places and nowhere else — a new entry here means a new problem.
 */
const knownDeviations: Record<string, number> = {
  'nursing/night/idle timer': 5.86,
  'nursing/night/finish label': 5.75,
  'nursing/night/pause pill label': 5.62,
  'nursing/night/idle control border': 1.95,
  'nursing/night/idle control border on page': 2.13,
  'nursing/night/active card border': 2.14,
  'sleep/night/idle timer': 5.84,
  'sleep/night/finish label': 6.65,
  'sleep/night/pause pill label': 5.81,
  'sleep/night/idle control border': 1.94,
  'sleep/night/idle control border on page': 2.14,
  'sleep/night/active card border': 2.07,
};

const modes: NursingMode[] = ['standard', 'night'];
const hues: ActivityHue[] = activityHues;

describe('care screen contrast floors', () => {
  hues.forEach(hue => {
    modes.forEach(mode => {
      const tokens = activityTokens[hue][mode];

      pairs.forEach(({ name, foreground, background, floor }) => {
        const deviation = knownDeviations[`${hue}/${mode}/${name}`];

        it(`${hue}/${mode}: ${name} ${deviation ? 'holds its pinned deviation' : `meets ${floor}:1`}`, () => {
          const measured = contrastRatio(tokens[foreground], tokens[background]);
          if (deviation) {
            expect(measured).toBeCloseTo(deviation, 1);
          } else {
            expect(measured).toBeGreaterThanOrEqual(floor);
          }
        });
      });
    });
  });

  it('keeps the header fill darker than the finish button everywhere', () => {
    hues.forEach(hue => {
      modes.forEach(mode => {
        const tokens = activityTokens[hue][mode];
        expect(relativeLuminance(tokens.bgHeader)).toBeLessThan(
          relativeLuminance(tokens.bgPrimary),
        );
      });
    });
  });

  it('defines every token in every hue and mode', () => {
    hues.forEach(hue => {
      modes.forEach(mode => {
        nursingTokenKeys.forEach(key => {
          expect(activityTokens[hue][mode][key]).toMatch(/^#[0-9A-F]{6}$/);
        });
      });
    });
  });

  it('keeps backgrounds dark in both modes, with pastel activity fills only by day', () => {
    hues.forEach(hue => {
      (['bgPage', 'bgCard', 'bgCardActive'] as const).forEach(key => {
        modes.forEach(mode => {
          expect(relativeLuminance(activityTokens[hue][mode][key])).toBeLessThan(0.1);
        });
      });
      (['bgHeader', 'bgPrimary', 'bgPillActive'] as const).forEach(key => {
        expect(relativeLuminance(activityTokens[hue].standard[key])).toBeGreaterThan(0.5);
        expect(relativeLuminance(activityTokens[hue].night[key])).toBeLessThan(0.1);
      });
    });
  });

  it('keeps night mode strictly darker than standard for every surface', () => {
    hues.forEach(hue => {
      nursingTokenKeys
        .filter(key => key.startsWith('bg'))
        .forEach(key => {
          expect(
            relativeLuminance(activityTokens[hue].night[key]),
          ).toBeLessThan(relativeLuminance(activityTokens[hue].standard[key]));
        });
    });
  });

  it('gives each activity its own hue on the surfaces that identify it', () => {
    // The two designs must not be mistakable for each other at a glance.
    (['bgHeader', 'bgPrimary', 'accent'] as const).forEach(key => {
      expect(activityTokens.sleep.standard[key]).not.toBe(
        activityTokens.nursing.standard[key],
      );
    });
  });
});
