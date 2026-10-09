import { describe, expect, it } from 'vitest';
import {
  addVoiceTestEntry,
  answerVoiceTestEntry,
  formatVoiceTestExport,
  initialVoiceTestState,
  MAX_VOICE_TEST_ENTRIES,
  parseVoiceTestState,
  summariseVoiceTest,
  type VoiceTestEntry,
} from '../../src/utils/voiceTestLog';

const entry = (id: string, at = 0): VoiceTestEntry => ({
  id,
  at,
  source: 'quick care',
  heard: 'left breast ten minutes',
  understood: 'Breastfeed, left side, 10 minutes',
  answer: null,
  build: 'PitterPatter 0.2.0 (3)',
});

describe('voice test log', () => {
  it('keeps the newest entries first and caps the log', () => {
    let state = { ...initialVoiceTestState, enabled: true };
    for (let i = 0; i < MAX_VOICE_TEST_ENTRIES + 5; i += 1) {
      state = addVoiceTestEntry(state, entry(String(i), i));
    }
    expect(state.entries).toHaveLength(MAX_VOICE_TEST_ENTRIES);
    expect(state.entries[0].id).toBe(String(MAX_VOICE_TEST_ENTRIES + 4));
  });

  it('records a yes or no against one entry only', () => {
    const state = answerVoiceTestEntry(
      addVoiceTestEntry(addVoiceTestEntry(initialVoiceTestState, entry('a')), entry('b')),
      'a',
      'no',
    );
    expect(state.entries.find(e => e.id === 'a')?.answer).toBe('no');
    expect(state.entries.find(e => e.id === 'b')?.answer).toBeNull();
    expect(summariseVoiceTest(state.entries)).toEqual({
      total: 2,
      yes: 0,
      no: 1,
      unanswered: 1,
    });
  });

  it('survives corrupt storage', () => {
    expect(parseVoiceTestState('{nope')).toEqual(initialVoiceTestState);
    expect(parseVoiceTestState(null)).toEqual(initialVoiceTestState);
    expect(
      parseVoiceTestState(JSON.stringify({ enabled: true, entries: [{ bad: 1 }, entry('x')] }))
        .entries.map(e => e.id),
    ).toEqual(['x']);
  });

  it('exports oldest first with the answer and any error', () => {
    const text = formatVoiceTestExport([
      { ...entry('new', 2000), answer: 'yes' },
      { ...entry('old', 1000), heard: '', understood: 'No speech', error: 'no-speech', answer: 'no' },
    ]);
    expect(text.indexOf('(nothing)')).toBeLessThan(text.indexOf('“left breast'));
    expect(text).toContain('Error: no-speech');
    expect(text).toContain('2 attempts · 1 right · 1 wrong · 0 not answered');
  });
});
