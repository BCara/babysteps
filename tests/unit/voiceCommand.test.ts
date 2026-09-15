import { describe, expect, it } from 'vitest';
import {
  parseContextualVoiceEntry,
  parseVoiceCommand,
} from '../../src/utils/voiceCommand';

describe('parseVoiceCommand', () => {
  it('parses nappy conditions', () => {
    expect(parseVoiceCommand('Log a wet nappy').command).toEqual({
      kind: 'log-diaper',
      condition: 'wet',
    });
    expect(parseVoiceCommand('dirty and wet diaper').command).toEqual({
      kind: 'log-diaper',
      condition: 'both',
    });
  });

  it('parses bottle amounts', () => {
    expect(parseVoiceCommand('She had a 120 ml bottle').command).toEqual({
      kind: 'log-feed',
      feedType: 'bottle',
      amount: 120,
      unit: 'ml',
    });
  });

  it('parses completed sleep durations', () => {
    expect(parseVoiceCommand('Slept for 1 hour 20 minutes').command).toEqual({
      kind: 'log-sleep',
      sleepType: 'cot',
      durationMinutes: 80,
    });
  });

  it('parses timer commands', () => {
    expect(parseVoiceCommand('Start a breastfeed').command).toEqual({
      kind: 'start-feed',
      feedType: 'breast',
    });
    expect(parseVoiceCommand('Stop the sleep timer').command).toEqual({
      kind: 'stop-sleep',
    });
  });

  it('recognises the selected sleep location', () => {
    expect(parseVoiceCommand('Start sleep in the car').command).toEqual({
      kind: 'start-sleep',
      sleepType: 'car',
    });
    expect(parseVoiceCommand('Log 30 minutes contact sleep').command).toEqual({
      kind: 'log-sleep',
      sleepType: 'contactNap',
      durationMinutes: 30,
    });
  });

  it('does not invent an event from unrelated speech', () => {
    expect(parseVoiceCommand('What is the weather today?').command).toBeNull();
  });
});

describe('parseContextualVoiceEntry', () => {
  it('uses nursing context for a total without requiring the word nursing', () => {
    expect(parseContextualVoiceEntry('nursing', 'Log 10 minutes').values).toEqual({
      durationMinutes: 10,
    });
  });

  it('splits an even nursing total across both sides', () => {
    expect(
      parseContextualVoiceEntry(
        'nursing',
        'Log 10 minutes evenly on both sides',
      ).values,
    ).toEqual({
      durationMinutes: 10,
      leftMinutes: 5,
      rightMinutes: 5,
    });
  });

  it('fills explicit nursing time on each side', () => {
    expect(
      parseContextualVoiceEntry(
        'nursing',
        'Left side for 5 minutes, right for 3 minutes',
      ).values,
    ).toEqual({
      durationMinutes: 8,
      leftMinutes: 5,
      rightMinutes: 3,
    });
  });

  it('uses the selected page for other short form entries', () => {
    expect(parseContextualVoiceEntry('bottle', '120 ml').values).toEqual({
      amount: 120,
      unit: 'ml',
      durationMinutes: undefined,
    });
    expect(parseContextualVoiceEntry('sleep', '45 minutes').values).toEqual({
      durationMinutes: 45,
      sleepType: undefined,
    });
    expect(parseContextualVoiceEntry('diaper', 'wet and dirty').values).toEqual({
      condition: 'both',
      diaperAmount: undefined,
    });
    expect(
      parseContextualVoiceEntry('diaper', 'heavy wet and dirty nappy').values,
    ).toEqual({ condition: 'both', diaperAmount: 'heavy' });
    expect(
      parseContextualVoiceEntry(
        'diaper',
        'wet heavy and dirty light nappy',
      ).values,
    ).toEqual({
      condition: 'both',
      diaperAmount: undefined,
      wetDiaperAmount: 'heavy',
      dirtyDiaperAmount: 'light',
    });
  });
});
