import { describe, expect, it } from 'vitest';
import {
  diaperAmountMetadata,
  diaperAmountValues,
  formatDiaperAmountDetail,
} from '../../src/utils/diaperAmounts';

describe('nappy amounts', () => {
  it('stores separate wet and dirty amounts for a combined nappy', () => {
    expect(
      diaperAmountMetadata('both', 'medium', 'heavy', 'light'),
    ).toEqual({
      diaperAmount: undefined,
      wetDiaperAmount: 'heavy',
      dirtyDiaperAmount: 'light',
    });
  });

  it('keeps the single legacy amount for wet-only and dirty-only nappies', () => {
    expect(
      diaperAmountMetadata('wet', 'heavy', 'medium', 'light'),
    ).toEqual({
      diaperAmount: 'heavy',
      wetDiaperAmount: undefined,
      dirtyDiaperAmount: undefined,
    });
  });

  it('uses a legacy combined amount for both selectors when editing', () => {
    expect(
      diaperAmountValues({ diaperCondition: 'both', diaperAmount: 'heavy' }),
    ).toEqual({
      amount: 'heavy',
      wetAmount: 'heavy',
      dirtyAmount: 'heavy',
    });
  });

  it('does not select an amount when a nappy has no saved amount', () => {
    expect(diaperAmountValues({ diaperCondition: 'wet' })).toEqual({
      amount: undefined,
      wetAmount: undefined,
      dirtyAmount: undefined,
    });
  });

  it('describes both saved amounts explicitly', () => {
    expect(
      formatDiaperAmountDetail({
        diaperCondition: 'both',
        wetDiaperAmount: 'heavy',
        dirtyDiaperAmount: 'light',
      }),
    ).toBe('Wet: Heavy · Dirty: Light');
  });

  it('does not invent amounts for one-tap combined nappies', () => {
    expect(
      formatDiaperAmountDetail({ diaperCondition: 'both' }),
    ).toBe('');
  });
});
