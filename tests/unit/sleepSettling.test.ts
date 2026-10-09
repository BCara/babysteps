import { describe, expect, it } from 'vitest';
import {
  MAX_SETTLING_MINUTES,
  checkSettlingMinutes,
  describeSettling,
  settlingChipSelected,
  settlingDifficultyLabel,
  settlingMinutesInput,
  toggleSettlingChip,
  toggleSettlingDifficulty,
} from '../../src/utils/sleepSettling';

describe('checkSettlingMinutes', () => {
  it('treats a blank field as nothing recorded rather than an error', () => {
    expect(checkSettlingMinutes('')).toEqual({ minutes: undefined });
    expect(checkSettlingMinutes('   ')).toEqual({ minutes: undefined });
  });

  it('keeps a recorded zero, which is not the same as leaving it blank', () => {
    expect(checkSettlingMinutes('0')).toEqual({ minutes: 0 });
  });

  it('rounds a typed value to whole minutes', () => {
    expect(checkSettlingMinutes('12.4').minutes).toBe(12);
    expect(checkSettlingMinutes(' 20 ').minutes).toBe(20);
  });

  it('rejects text and negative numbers', () => {
    expect(checkSettlingMinutes('ages').error).toBeTruthy();
    expect(checkSettlingMinutes('-5').error).toBeTruthy();
  });

  it('caps settling so a forgotten field cannot become a second sleep', () => {
    expect(checkSettlingMinutes(String(MAX_SETTLING_MINUTES)).minutes).toBe(
      MAX_SETTLING_MINUTES,
    );
    expect(checkSettlingMinutes(String(MAX_SETTLING_MINUTES + 1)).error).toBe(
      'Settling can be at most 4 hours.',
    );
  });
});

describe('settlingMinutesInput', () => {
  it('shows a stored value and leaves an unrecorded one blank', () => {
    expect(settlingMinutesInput(25)).toBe('25');
    expect(settlingMinutesInput(0)).toBe('0');
    expect(settlingMinutesInput(undefined)).toBe('');
  });
});

describe('toggleSettlingDifficulty', () => {
  it('chooses a difficulty, and clears it when it is chosen again', () => {
    expect(toggleSettlingDifficulty(undefined, 'hard')).toBe('hard');
    expect(toggleSettlingDifficulty('easy', 'hard')).toBe('hard');
    expect(toggleSettlingDifficulty('hard', 'hard')).toBeUndefined();
  });
});

describe('settling chips', () => {
  it('marks the chip matching the typed minutes', () => {
    expect(settlingChipSelected('20', 20)).toBe(true);
    expect(settlingChipSelected('21', 20)).toBe(false);
    expect(settlingChipSelected('', 20)).toBe(false);
  });

  it('fills the field from a chip and empties it when the same chip is tapped', () => {
    expect(toggleSettlingChip('', 10)).toBe('10');
    expect(toggleSettlingChip('30', 10)).toBe('10');
    expect(toggleSettlingChip('10', 10)).toBe('');
  });
});

describe('settlingDifficultyLabel', () => {
  it('names a known difficulty and ignores anything else', () => {
    expect(settlingDifficultyLabel('someFuss')).toBe('Some fuss');
    expect(settlingDifficultyLabel(undefined)).toBeUndefined();
    // Records written by an older or newer build must not print a raw id.
    expect(
      settlingDifficultyLabel('impossible' as never),
    ).toBeUndefined();
  });
});

describe('describeSettling', () => {
  it('reads both halves when both were recorded', () => {
    expect(
      describeSettling({ settlingMinutes: 20, settlingDifficulty: 'hard' }),
    ).toBe('20 min to settle · Hard');
  });

  it('reads whichever half was recorded on its own', () => {
    expect(describeSettling({ settlingMinutes: 5 })).toBe('5 min to settle');
    expect(describeSettling({ settlingDifficulty: 'easy' })).toBe('Easy');
  });

  it('says a no-fuss bedtime in words rather than as zero minutes', () => {
    expect(describeSettling({ settlingMinutes: 0 })).toBe(
      'Settled straight away',
    );
  });

  it('says nothing for a sleep nobody recorded settling for', () => {
    expect(describeSettling(undefined)).toBeUndefined();
    expect(describeSettling({})).toBeUndefined();
  });
});
