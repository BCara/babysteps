import { describe, expect, it } from 'vitest';
import {
  defaultHomeActions,
  orderHomeCareActionsForCustomising,
  sanitizeHomeActions,
} from '../../src/constants/careActions';

describe('home care actions', () => {
  it('keeps valid custom order, removes duplicates and rejects unknown actions', () => {
    expect(sanitizeHomeActions(['temperature', 'feed', 'temperature', 'unknown'])).toEqual(['temperature', 'nursing', 'bottle']);
  });

  it('allows nursing and bottle to be customised independently', () => {
    expect(sanitizeHomeActions(['nursing', 'sleep'])).toEqual([
      'nursing',
      'sleep',
    ]);
    expect(sanitizeHomeActions(['bottle', 'diaper'])).toEqual([
      'bottle',
      'diaper',
    ]);
  });

  it('keeps appointments available as a standard Quick Care action', () => {
    expect(sanitizeHomeActions(['appointment', 'nursing'])).toEqual([
      'appointment',
      'nursing',
    ]);
    expect(
      orderHomeCareActionsForCustomising(['nursing']).map(action => action.type),
    ).toContain('appointment');
  });

  it('uses the default quick-care layout when no valid customisation exists', () => {
    expect(sanitizeHomeActions(undefined)).toEqual(defaultHomeActions);
    expect(sanitizeHomeActions([])).toEqual(defaultHomeActions);
  });

  it('shows enabled actions first in their chosen order', () => {
    const orderedTypes = orderHomeCareActionsForCustomising([
      'temperature',
      'nursing',
      'sleep',
    ]).map(action => action.type);

    expect(orderedTypes.slice(0, 3)).toEqual([
      'temperature',
      'nursing',
      'sleep',
    ]);
    expect(orderedTypes.slice(3)).not.toContain('temperature');
    expect(orderedTypes.slice(3)).not.toContain('nursing');
    expect(orderedTypes.slice(3)).not.toContain('sleep');
  });
});
