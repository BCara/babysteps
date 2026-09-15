import { NativeModules, Platform } from 'react-native';
import {
  homeCareActions,
  type HomeActionKey,
} from '../constants/careActions';
import type { QuickCareWidgetSnapshot } from '../utils/widgetSnapshots';

export type DashboardWidgetAction = HomeActionKey;
export type WidgetKind = 'dashboard' | DashboardWidgetAction;

export const supportedDashboardWidgetActions: DashboardWidgetAction[] =
  homeCareActions.map(action => action.type);

export const defaultDashboardWidgetActions: DashboardWidgetAction[] = [
  'nursing',
  'bottle',
  'sleep',
  'diaper',
];

export type WatchTileAction = 'nursing' | 'bottle' | 'sleep' | 'diaper';

export const supportedWatchTileActions: WatchTileAction[] = [
  'nursing',
  'bottle',
  'sleep',
  'diaper',
];

export const defaultWatchTileActions: WatchTileAction[] = [
  ...supportedWatchTileActions,
];

interface NativeWidgetSettings {
  getDashboardActions: () => Promise<unknown>;
  setDashboardActions: (actions: DashboardWidgetAction[]) => Promise<void>;
  setWidgetSnapshots: (snapshots: QuickCareWidgetSnapshot[]) => Promise<void>;
  getWatchActions: () => Promise<unknown>;
  setWatchActions: (actions: WatchTileAction[]) => Promise<void>;
  requestPinWidget: (kind: WidgetKind) => Promise<boolean>;
}

const nativeWidgetSettings = NativeModules.PitterPatterWidgets as
  | NativeWidgetSettings
  | undefined;

export const widgetsAreAvailable =
  Platform.OS === 'android' && Boolean(nativeWidgetSettings);

export const sanitizeDashboardWidgetActions = (
  value: unknown,
): DashboardWidgetAction[] => {
  if (!Array.isArray(value)) return defaultDashboardWidgetActions;
  const supported = new Set(supportedDashboardWidgetActions);
  const result: DashboardWidgetAction[] = [];

  value.forEach(action => {
    if (
      typeof action === 'string' &&
      supported.has(action as DashboardWidgetAction) &&
      !result.includes(action as DashboardWidgetAction) &&
      result.length < 4
    ) {
      result.push(action as DashboardWidgetAction);
    }
  });

  return result.length ? result : defaultDashboardWidgetActions;
};

export const sanitizeWatchTileActions = (value: unknown): WatchTileAction[] => {
  if (!Array.isArray(value)) return defaultWatchTileActions;
  const supported = new Set(supportedWatchTileActions);
  const result: WatchTileAction[] = [];
  value.forEach(action => {
    if (
      typeof action === 'string' &&
      supported.has(action as WatchTileAction) &&
      !result.includes(action as WatchTileAction) &&
      result.length < 4
    ) {
      result.push(action as WatchTileAction);
    }
  });
  return result.length ? result : ['nursing'];
};

const requireWidgetSettings = (): NativeWidgetSettings => {
  if (Platform.OS !== 'android') {
    throw new Error('Home screen widgets are currently available on Android.');
  }
  if (!nativeWidgetSettings) {
    throw new Error(
      'Rebuild PitterPatter to enable the new Home screen widgets.',
    );
  }
  return nativeWidgetSettings;
};

export const getDashboardWidgetActions = async () => {
  if (!widgetsAreAvailable) return defaultDashboardWidgetActions;
  const actions = await nativeWidgetSettings!.getDashboardActions();
  return sanitizeDashboardWidgetActions(actions);
};

export const saveDashboardWidgetActions = async (
  actions: DashboardWidgetAction[],
) => {
  const sanitized = sanitizeDashboardWidgetActions(actions);
  await requireWidgetSettings().setDashboardActions(sanitized);
  return sanitized;
};

export const getWatchTileActions = async () => {
  if (!widgetsAreAvailable) return defaultWatchTileActions;
  return sanitizeWatchTileActions(await nativeWidgetSettings!.getWatchActions());
};

export const saveWatchTileActions = async (actions: WatchTileAction[]) => {
  const sanitized = sanitizeWatchTileActions(actions);
  await requireWidgetSettings().setWatchActions(sanitized);
  return sanitized;
};

export const requestWidgetPin = (kind: WidgetKind) =>
  requireWidgetSettings().requestPinWidget(kind);

export const syncQuickCareWidgetSnapshots = async (
  snapshots: QuickCareWidgetSnapshot[],
) => {
  if (!widgetsAreAvailable) return;
  await nativeWidgetSettings!.setWidgetSnapshots(snapshots);
};
