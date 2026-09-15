import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type PropsWithChildren,
} from 'react';
import { Appearance, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { nursingTokens, type NursingMode, type NursingTokens } from '../theme/nursingTheme';
import { resolveNursingMode, type NursingModePreference } from '../utils/nightMode';

const PREFERENCE_KEY = 'nursing.appearance.preference';
const isPreference = (value: unknown): value is NursingModePreference =>
  value === 'auto' || value === 'standard' || value === 'night';
const resolve = (preference: NursingModePreference) =>
  resolveNursingMode({ preference, now: new Date() });

interface AppearanceContextValue {
  mode: NursingMode;
  tokens: NursingTokens;
  preference: NursingModePreference;
  setPreference: (next: NursingModePreference) => Promise<void>;
}
const AppearanceContext = createContext<AppearanceContextValue | null>(null);

export function AppearanceProvider({ children }: PropsWithChildren) {
  const [preference, setPreferenceState] = useState<NursingModePreference>('auto');
  const [mode, setMode] = useState<NursingMode>(() => resolve('auto'));
  const changedByUser = useRef(false);
  const pendingWrite = useRef(Promise.resolve());

  useEffect(() => {
    let cancelled = false;
    void AsyncStorage.getItem(PREFERENCE_KEY).then(stored => {
      if (cancelled || changedByUser.current || !isPreference(stored)) return;
      setPreferenceState(stored);
      setMode(resolve(stored));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const reevaluate = () => setMode(resolve(preference));
    reevaluate();
    // Update at the next local minute, including while a timer is running.
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => { reevaluate(); schedule(); }, 60_000 - Date.now() % 60_000);
    };
    if (preference === 'auto') schedule();
    const subscription = AppState.addEventListener('change', next => {
      if (next === 'active') reevaluate();
    });
    return () => { clearTimeout(timer); subscription.remove(); };
  }, [preference]);

  useEffect(() => {
    // Native dialogs stay dark, like the app background in both palettes.
    Appearance.setColorScheme('dark');
  }, []);

  const setPreference = useCallback(async (next: NursingModePreference) => {
    changedByUser.current = true;
    setPreferenceState(next);
    setMode(resolve(next));
    // Preserve the last choice even when someone switches modes quickly.
    pendingWrite.current = pendingWrite.current
      .then(() => AsyncStorage.setItem(PREFERENCE_KEY, next)).catch(() => {});
    await pendingWrite.current;
  }, []);

  const value = useMemo(() => ({
    mode, tokens: nursingTokens[mode], preference, setPreference,
  }), [mode, preference, setPreference]);
  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export const useAppearance = () => {
  const context = useContext(AppearanceContext);
  if (!context) throw new Error('useAppearance must be used inside an AppearanceProvider');
  return context;
};
