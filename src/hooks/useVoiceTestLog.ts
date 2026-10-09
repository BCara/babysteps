import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { useAuth } from '../providers/AuthProvider';
import { formatVersionLine } from '../utils/appVersion';
import {
  addVoiceTestEntry,
  answerVoiceTestEntry,
  initialVoiceTestState,
  parseVoiceTestState,
  type VoiceTestAnswer,
  type VoiceTestEntry,
  type VoiceTestState,
} from '../utils/voiceTestLog';

// Voice testing is a per-account switch kept on this device only, so turning
// it on for one caregiver never shows the Yes/No prompts to anyone else.
const storageKey = (uid: string) => `voiceTest.${uid}`;

let sharedUid: string | null = null;
let shared = initialVoiceTestState;
let loaded: Promise<void> | null = null;
const listeners = new Set<(state: VoiceTestState) => void>();

const notify = () => listeners.forEach(listener => listener(shared));

const load = (uid: string) => {
  if (sharedUid !== uid) {
    sharedUid = uid;
    shared = initialVoiceTestState;
    loaded = null;
    notify();
  }
  loaded ??= AsyncStorage.getItem(storageKey(uid))
    .then(raw => {
      if (sharedUid !== uid) return;
      shared = parseVoiceTestState(raw);
      notify();
    })
    .catch(() => undefined);
  return loaded;
};

const update = (change: (state: VoiceTestState) => VoiceTestState) => {
  const uid = sharedUid;
  if (!uid) return;
  shared = change(shared);
  notify();
  void AsyncStorage.setItem(storageKey(uid), JSON.stringify(shared)).catch(
    () => undefined,
  );
};

const buildLine = () =>
  formatVersionLine({
    nativeVersion: Application.nativeApplicationVersion,
    nativeBuild: Application.nativeBuildVersion,
    bundleVersion: Constants.expoConfig?.version ?? null,
    lastUpdated: null,
  });

export type VoiceTestAttempt = Pick<
  VoiceTestEntry,
  'source' | 'heard' | 'understood' | 'error'
>;

export function useVoiceTestLog() {
  const uid = useAuth().user?.uid ?? null;
  const [state, setState] = useState(shared);

  useEffect(() => {
    listeners.add(setState);
    if (uid) void load(uid);
    setState(shared);
    return () => {
      listeners.delete(setState);
    };
  }, [uid]);

  const setEnabled = useCallback(
    (enabled: boolean) => update(current => ({ ...current, enabled })),
    [],
  );

  /** Logs one attempt when testing is on; returns its id for the Yes/No prompt. */
  const record = useCallback((attempt: VoiceTestAttempt): string | null => {
    if (!shared.enabled) return null;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    update(current =>
      addVoiceTestEntry(current, {
        ...attempt,
        id,
        at: Date.now(),
        answer: null,
        build: buildLine(),
      }),
    );
    return id;
  }, []);

  const answer = useCallback(
    (id: string, value: VoiceTestAnswer) =>
      update(current => answerVoiceTestEntry(current, id, value)),
    [],
  );

  const clear = useCallback(
    () => update(current => ({ ...current, entries: [] })),
    [],
  );

  return {
    enabled: state.enabled,
    entries: state.entries,
    setEnabled,
    record,
    answer,
    clear,
  };
}
