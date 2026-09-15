import { describe, expect, it } from 'vitest';
import {
  distributeNursingDuration,
  nursingDurationInputsFromSeconds,
  parseManualNursing,
  updateNursingDurationInputs,
} from '../../src/utils/manualNursing';

describe('manual nursing', () => {
  it('prefills tracked nursing duration as consistent whole minutes', () => {
    expect(nursingDurationInputsFromSeconds(756, 0)).toEqual({
      total: '13',
      left: '13',
      right: '',
    });
    expect(nursingDurationInputsFromSeconds(190, 130)).toEqual({
      total: '5',
      left: '3',
      right: '2',
    });
  });

  it('stores left and right times separately and totals them', () => {
    expect(
      parseManualNursing({
        leftMinutes: '8.5',
        rightMinutes: '6',
        lastBreastSide: 'right',
      }),
    ).toEqual({
      leftBreastDurationSeconds: 510,
      rightBreastDurationSeconds: 360,
      durationMinutes: 14.5,
      breastSide: 'both',
      breastSidesUsed: ['left', 'right'],
      lastBreastSide: 'right',
    });
  });

  it('allows a single nursing side', () => {
    expect(
      parseManualNursing({ leftMinutes: '12', rightMinutes: '' }),
    ).toEqual({
      leftBreastDurationSeconds: 720,
      rightBreastDurationSeconds: 0,
      durationMinutes: 12,
      breastSide: 'left',
      breastSidesUsed: ['left'],
      lastBreastSide: 'left',
    });
  });

  it('rejects empty or invalid side times', () => {
    expect(parseManualNursing({ leftMinutes: '', rightMinutes: '' })).toBeNull();
    expect(
      parseManualNursing({ leftMinutes: '-1', rightMinutes: '5' }),
    ).toBeNull();
  });

  it('rescales both sides when the overall duration changes', () => {
    expect(
      distributeNursingDuration({
        totalSeconds: 600,
        leftSeconds: 480,
        rightSeconds: 240,
        breastSide: 'both',
      }),
    ).toEqual({ leftSeconds: 400, rightSeconds: 200 });
  });

  it('keeps an existing one-sided feed on the same side', () => {
    expect(
      distributeNursingDuration({
        totalSeconds: 540,
        leftSeconds: 0,
        rightSeconds: 300,
        breastSide: 'right',
      }),
    ).toEqual({ leftSeconds: 0, rightSeconds: 540 });
  });

  it('splits a both-sides feed when no previous timings exist', () => {
    expect(
      distributeNursingDuration({
        totalSeconds: 601,
        leftSeconds: 0,
        rightSeconds: 0,
        breastSide: 'both',
      }),
    ).toEqual({ leftSeconds: 300, rightSeconds: 301 });
  });

  it('allocates a newly entered total to either single-side preset', () => {
    expect(
      distributeNursingDuration({
        totalSeconds: 900,
        leftSeconds: 0,
        rightSeconds: 0,
        breastSide: 'left',
      }),
    ).toEqual({ leftSeconds: 900, rightSeconds: 0 });
    expect(
      distributeNursingDuration({
        totalSeconds: 900,
        leftSeconds: 0,
        rightSeconds: 0,
        breastSide: 'right',
      }),
    ).toEqual({ leftSeconds: 0, rightSeconds: 900 });
  });

  it('calculates the third duration from the two most recently edited fields', () => {
    const totalFirst = updateNursingDurationInputs(
      { total: '', left: '', right: '' },
      'total',
      '20',
      [],
    );
    const leftSecond = updateNursingDurationInputs(
      totalFirst.values,
      'left',
      '8',
      totalFirst.editOrder,
    );
    expect(leftSecond.values).toEqual({ total: '20', left: '8', right: '12' });

    const rightThird = updateNursingDurationInputs(
      leftSecond.values,
      'right',
      '9',
      leftSecond.editOrder,
    );
    expect(rightThird.values).toEqual({ total: '17', left: '8', right: '9' });
  });

  it('splits an initially entered total evenly between left and right', () => {
    const entered = updateNursingDurationInputs(
      { total: '', left: '', right: '' },
      'total',
      '10',
      [],
    );

    expect(entered).toEqual({
      values: { total: '10', left: '5', right: '5' },
      editOrder: ['total'],
    });

    expect(
      updateNursingDurationInputs(
        entered.values,
        'left',
        '6',
        entered.editOrder,
      ),
    ).toEqual({
      values: { total: '10', left: '6', right: '4' },
      editOrder: ['total', 'left'],
    });
  });

  it('supports side-first entry and calculates the remaining side from total', () => {
    const leftFirst = updateNursingDurationInputs(
      { total: '', left: '', right: '' },
      'left',
      '6',
      [],
    );
    expect(leftFirst.values).toEqual({ total: '6', left: '6', right: '' });

    const totalSecond = updateNursingDurationInputs(
      leftFirst.values,
      'total',
      '10',
      leftFirst.editOrder,
    );
    expect(totalSecond.values).toEqual({ total: '10', left: '6', right: '4' });
  });

  it('clears an impossible calculated side instead of showing a negative time', () => {
    const totalFirst = updateNursingDurationInputs(
      { total: '', left: '', right: '' },
      'total',
      '5',
      [],
    );
    const leftSecond = updateNursingDurationInputs(
      totalFirst.values,
      'left',
      '7',
      totalFirst.editOrder,
    );
    expect(leftSecond.values).toEqual({ total: '5', left: '7', right: '' });
  });

  it('includes a prefilled opposite side when the first manual edit changes right', () => {
    const changedRight = updateNursingDurationInputs(
      { total: '12', left: '7', right: '5' },
      'right',
      '8',
      [],
    );

    expect(changedRight.values).toEqual({ total: '15', left: '7', right: '8' });
    expect(changedRight.editOrder).toEqual(['left', 'right']);
  });
});
