import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({
  NativeModules: {},
  Platform: { OS: 'android' },
}));

import {
  defaultDashboardWidgetActions,
  sanitizeDashboardWidgetActions,
  sanitizeWatchTileActions,
} from '../../src/services/widgetSettings';

describe('sanitizeDashboardWidgetActions', () => {
  it('keeps supported actions in order, removes duplicates, and caps at four', () => {
    expect(
      sanitizeDashboardWidgetActions([
        'pumping',
        'sleep',
        'pumping',
        'nursing',
        'bottle',
        'diaper',
        'temperature',
      ]),
    ).toEqual(['pumping', 'sleep', 'nursing', 'bottle']);
  });

  it('drops unknown values', () => {
    expect(
      sanitizeDashboardWidgetActions(['unknown', 'diaper', null]),
    ).toEqual(['diaper']);
  });

  it('supports the wider Quick Care activity catalogue', () => {
    expect(
      sanitizeDashboardWidgetActions([
        'temperature',
        'tummyTime',
        'medication',
        'milestone',
      ]),
    ).toEqual(['temperature', 'tummyTime', 'medication', 'milestone']);
  });

  it('uses the default dashboard when no valid action remains', () => {
    expect(sanitizeDashboardWidgetActions([])).toEqual(
      defaultDashboardWidgetActions,
    );
    expect(sanitizeDashboardWidgetActions(undefined)).toEqual(
      defaultDashboardWidgetActions,
    );
  });
});

describe('watch Tile settings', () => {
  it('keeps supported actions in the chosen order', () => {
    expect(
      sanitizeWatchTileActions(['sleep', 'nursing', 'sleep', 'diaper']),
    ).toEqual(['sleep', 'nursing', 'diaper']);
  });

  it('falls back to one useful action when a saved value is invalid', () => {
    expect(sanitizeWatchTileActions(['medicine'])).toEqual(['nursing']);
  });
});
