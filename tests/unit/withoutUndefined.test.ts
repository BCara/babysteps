import { describe, expect, it } from 'vitest';
import { withoutUndefined } from '../../src/utils/withoutUndefined';

describe('withoutUndefined', () => {
  it('removes undefined values from nested plain objects', () => {
    expect(
      withoutUndefined({
        notes: undefined,
        metadata: {
          amount: undefined,
          unit: 'ml',
        },
        deletedAt: null,
      }),
    ).toEqual({
      metadata: {
        unit: 'ml',
      },
      deletedAt: null,
    });
  });

  it('preserves non-plain objects used by Firebase', () => {
    const timestampLike = new Date('2026-07-28T00:00:00.000Z');

    expect(withoutUndefined(timestampLike)).toBe(timestampLike);
  });
});
