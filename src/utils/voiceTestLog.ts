export type VoiceTestAnswer = 'yes' | 'no';

export interface VoiceTestEntry {
  id: string;
  /** Milliseconds since epoch. */
  at: number;
  /** Where the microphone was used, e.g. "quick care" or "feed form". */
  source: string;
  /** Final transcript, empty when recognition failed before hearing anything. */
  heard: string;
  /** What the app made of it, or the error shown to the caregiver. */
  understood: string;
  /** Speech recogniser error code, when recognition failed. */
  error?: string;
  answer: VoiceTestAnswer | null;
  build: string;
}

export interface VoiceTestState {
  enabled: boolean;
  entries: VoiceTestEntry[];
}

export const MAX_VOICE_TEST_ENTRIES = 300;

export const initialVoiceTestState: VoiceTestState = { enabled: false, entries: [] };

/** Newest first, capped so a forgotten switch cannot grow storage forever. */
export function addVoiceTestEntry(
  state: VoiceTestState,
  entry: VoiceTestEntry,
): VoiceTestState {
  return {
    ...state,
    entries: [entry, ...state.entries].slice(0, MAX_VOICE_TEST_ENTRIES),
  };
}

export function answerVoiceTestEntry(
  state: VoiceTestState,
  id: string,
  answer: VoiceTestAnswer,
): VoiceTestState {
  return {
    ...state,
    entries: state.entries.map(entry =>
      entry.id === id ? { ...entry, answer } : entry,
    ),
  };
}

export function parseVoiceTestState(raw: string | null): VoiceTestState {
  if (!raw) return initialVoiceTestState;
  try {
    const parsed = JSON.parse(raw) as Partial<VoiceTestState>;
    return {
      enabled: parsed.enabled === true,
      entries: Array.isArray(parsed.entries)
        ? parsed.entries.filter(
            (entry): entry is VoiceTestEntry =>
              typeof entry?.id === 'string' && typeof entry.at === 'number',
          )
        : [],
    };
  } catch {
    return initialVoiceTestState;
  }
}

export function summariseVoiceTest(entries: VoiceTestEntry[]) {
  return {
    total: entries.length,
    yes: entries.filter(entry => entry.answer === 'yes').length,
    no: entries.filter(entry => entry.answer === 'no').length,
    unanswered: entries.filter(entry => entry.answer === null).length,
  };
}

const answerLabel = (answer: VoiceTestAnswer | null) =>
  answer === 'yes' ? 'RIGHT' : answer === 'no' ? 'WRONG' : 'not answered';

/** Plain-text export for sharing, oldest first so it reads as a timeline. */
export function formatVoiceTestExport(entries: VoiceTestEntry[]): string {
  const summary = summariseVoiceTest(entries);
  const lines = [
    'PitterPatter voice test log',
    `${summary.total} attempts · ${summary.yes} right · ${summary.no} wrong · ${summary.unanswered} not answered`,
    '',
  ];
  [...entries].reverse().forEach(entry => {
    lines.push(
      `${new Date(entry.at).toISOString()} · ${entry.source} · ${answerLabel(entry.answer)}`,
      `  Heard: ${entry.heard ? `“${entry.heard}”` : '(nothing)'}`,
      `  Understood: ${entry.understood}`,
    );
    if (entry.error) lines.push(`  Error: ${entry.error}`);
    lines.push(`  Build: ${entry.build}`, '');
  });
  return lines.join('\n');
}
