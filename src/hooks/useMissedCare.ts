import { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { BabyEvent } from '../services/firebase/events';
import { findMissedCare, type MissedCareSuggestion } from '../utils/missedCare';
import {
  acceptMissedCare,
  canSuggestMissedCare,
  declineMissedCare,
  initialMissedCarePromptState,
  parseMissedCarePromptState,
  type MissedCarePromptState,
} from '../utils/missedCarePrompts';

const STORAGE_KEY = 'missedCare.prompts';

// One copy shared by every screen using the hook, so turning suggestions off
// in Settings hides the card on Home without waiting for a reload.
let shared = initialMissedCarePromptState;
let loaded: Promise<void> | null = null;
const listeners = new Set<(state: MissedCarePromptState) => void>();

const load = () => {
  loaded ??= AsyncStorage.getItem(STORAGE_KEY)
    .then(raw => {
      shared = parseMissedCarePromptState(raw);
      listeners.forEach(listener => listener(shared));
    })
    .catch(() => undefined);
  return loaded;
};

const update = (change: (state: MissedCarePromptState) => MissedCarePromptState) => {
  shared = change(shared);
  listeners.forEach(listener => listener(shared));
  void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(shared)).catch(() => undefined);
};

/** The suggestion settings on their own, for the Settings screen. */
export function useMissedCareSetting() {
  const [state, setState] = useState(shared);
  useEffect(() => {
    listeners.add(setState);
    void load();
    return () => {
      listeners.delete(setState);
    };
  }, []);
  const setEnabled = useCallback(
    (enabled: boolean) => update(current => ({ ...current, enabled, quietUntil: 0 })),
    [],
  );
  return { state, enabled: state.enabled, setEnabled };
}

export function useMissedCare({
  events,
  now,
  ready,
}: {
  events: BabyEvent[];
  now: Date;
  /** False while events are loading, so a half-read log is not judged. */
  ready: boolean;
}) {
  const { state } = useMissedCareSetting();
  const [ownLoaded, setOwnLoaded] = useState(false);
  useEffect(() => {
    void load().then(() => setOwnLoaded(true));
  }, []);

  // The Home clock can tick every second while a timer runs; gaps measured in
  // hours do not need rechecking that often.
  const minute = Math.floor(now.getTime() / 60_000);
  const suggestion = useMemo<MissedCareSuggestion | null>(() => {
    const at = new Date(minute * 60_000);
    if (!ready || !ownLoaded || !canSuggestMissedCare(state, at.getTime())) return null;
    const answered = new Set(state.answered);
    return findMissedCare({ events, now: at, isDismissed: key => answered.has(key) });
  }, [events, minute, ownLoaded, ready, state]);

  const decline = useCallback((key: string) => {
    update(current => declineMissedCare(current, key, Date.now()));
  }, []);
  const accept = useCallback((key: string) => {
    update(current => acceptMissedCare(current, key));
  }, []);

  return { suggestion, decline, accept };
}
