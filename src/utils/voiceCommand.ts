import type { SleepType } from './sleepLocation';

export type VoiceCommand =
  | { kind: 'start-feed'; feedType: 'breast' }
  | {
      kind: 'log-feed';
      feedType: 'breast' | 'bottle';
      amount?: number;
      unit?: 'ml' | 'oz';
      durationMinutes?: number;
    }
  | { kind: 'stop-feed' }
  | { kind: 'start-sleep'; sleepType: SleepType }
  | {
      kind: 'log-sleep';
      sleepType: SleepType;
      durationMinutes: number;
    }
  | { kind: 'stop-sleep' }
  | { kind: 'log-diaper'; condition: 'wet' | 'dirty' | 'both' };

export type VoiceCommandResult =
  | { command: VoiceCommand; description: string }
  | { command: null; description: string };

export type VoiceEntryContext =
  | 'nursing'
  | 'bottle'
  | 'sleep'
  | 'diaper'
  | 'pumping'
  | 'solids'
  | 'growth'
  | 'potty'
  | 'temperature'
  | 'medication'
  | 'tummyTime'
  | 'bath'
  | 'milestone'
  | 'symptom'
  | 'appointment'
  | 'immunization'
  | 'teething';

export interface VoiceEntryValues {
  durationMinutes?: number;
  leftMinutes?: number;
  rightMinutes?: number;
  amount?: number;
  unit?: 'ml' | 'oz';
  condition?: 'wet' | 'dirty' | 'both';
  diaperAmount?: 'light' | 'medium' | 'heavy';
  wetDiaperAmount?: 'light' | 'medium' | 'heavy';
  dirtyDiaperAmount?: 'light' | 'medium' | 'heavy';
  sleepType?: SleepType;
  pumpingSide?: 'left' | 'right' | 'both';
  storageLocation?: 'usedNow' | 'fridge' | 'freezer' | 'discarded';
  fields?: Record<string, string>;
  firstExposure?: boolean;
  allergen?: boolean;
}

export type VoiceEntryResult =
  | { values: VoiceEntryValues; description: string }
  | { values: null; description: string };

const parseDurationMinutes = (text: string) => {
  const matches = [
    ...text.matchAll(
      /(\d+(?:\.\d+)?)\s*(hours?|hrs?|hr|h|minutes?|mins?|min|m)\b/g,
    ),
  ];
  if (matches.length === 0) return undefined;

  const total = matches.reduce((minutes, match) => {
    const value = Number(match[1]);
    const unit = match[2];
    return minutes + (unit.startsWith('h') ? value * 60 : value);
  }, 0);
  return total > 0 ? Math.round(total) : undefined;
};

const parseBottleAmount = (text: string) => {
  const match = text.match(
    /(\d+(?:\.\d+)?)\s*(ml|millilit(?:er|re)s?|oz|ounces?)\b/,
  );
  if (!match) return null;
  return {
    amount: Number(match[1]),
    unit: match[2].startsWith('o') ? ('oz' as const) : ('ml' as const),
  };
};

const formatNumber = (value: number) =>
  Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);

const parseSideDuration = (text: string, side: 'left' | 'right') => {
  const unit = '(?:hours?|hrs?|hr|h|minutes?|mins?|min|m)';
  const afterSide = text.match(
    new RegExp(`\\b${side}(?:\\s+(?:side|breast))?(?:\\s+(?:for|was|is))?\\s*(\\d+(?:\\.\\d+)?)\\s*(${unit})\\b`),
  );
  const beforeSide = text.match(
    new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(${unit})\\s*(?:on\\s+(?:the\\s+)?)?${side}(?:\\s+(?:side|breast))?\\b`),
  );
  const match = afterSide || beforeSide;
  if (!match) return undefined;
  const value = Number(match[1]);
  return match[2].startsWith('h') ? value * 60 : value;
};

const stripLeadIn = (text: string) =>
  text
    .replace(/^\s*(?:please\s+)?(?:log|record|add|enter|update|change|set)\s+/i, '')
    .trim();

const fieldText = (text: string, patterns: RegExp[]) => {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const value = match?.[1]?.trim();
    if (value) return value;
  }
  return undefined;
};

/**
 * Parses speech inside an already-selected care form. The caller supplies the
 * category, so phrases such as "10 minutes" never have to repeat "nursing".
 */
export const parseContextualVoiceEntry = (
  context: VoiceEntryContext,
  transcript: string,
): VoiceEntryResult => {
  const text = transcript.trim().toLowerCase();
  if (!text) return { values: null, description: 'I did not hear any details.' };

  const durationMinutes = parseDurationMinutes(text);

  if (context === 'nursing') {
    const leftMinutes = parseSideDuration(text, 'left');
    const rightMinutes = parseSideDuration(text, 'right');
    if (leftMinutes !== undefined || rightMinutes !== undefined) {
      const left = leftMinutes || 0;
      const right = rightMinutes || 0;
      return {
        values: {
          durationMinutes: left + right,
          leftMinutes,
          rightMinutes,
        },
        description: `Fill nursing time: ${left ? `left ${formatNumber(left)} minutes` : ''}${left && right ? ', ' : ''}${right ? `right ${formatNumber(right)} minutes` : ''}`,
      };
    }
    if (durationMinutes) {
      if (/\b(even|evenly|equal|equally|both sides|each side)\b/.test(text)) {
        const left = durationMinutes / 2;
        return {
          values: {
            durationMinutes,
            leftMinutes: left,
            rightMinutes: durationMinutes - left,
          },
          description: `Fill ${formatDuration(durationMinutes)} evenly across both sides`,
        };
      }
      return {
        values: { durationMinutes },
        description: `Fill a total nursing time of ${formatDuration(durationMinutes)}`,
      };
    }
    return {
      values: null,
      description:
        'Say a total such as "10 minutes", or say "left 5 minutes, right 3 minutes".',
    };
  }

  if (context === 'bottle') {
    const bottle = parseBottleAmount(text);
    if (!bottle && !durationMinutes) {
      return { values: null, description: 'Say an amount such as "120 ml".' };
    }
    return {
      values: { ...(bottle || {}), durationMinutes },
      description: `Fill ${bottle ? `${formatNumber(bottle.amount)} ${bottle.unit}` : ''}${bottle && durationMinutes ? ' and ' : ''}${durationMinutes ? formatDuration(durationMinutes) : ''}`,
    };
  }

  if (context === 'sleep') {
    if (!durationMinutes) {
      return { values: null, description: 'Say a duration such as "45 minutes".' };
    }
    const sleepType = /\bcontact(?:\s+nap)?\b/.test(text)
      ? ('contactNap' as const)
      : /\bcar\b/.test(text)
        ? ('car' as const)
        : /\bcot\b/.test(text)
          ? ('cot' as const)
          : undefined;
    return {
      values: { durationMinutes, sleepType },
      description: `Fill ${formatDuration(durationMinutes)}${sleepType ? ` of ${sleepType === 'contactNap' ? 'contact nap' : sleepType}` : ''}`,
    };
  }

  if (context === 'diaper') {
    const wet = /\b(wet|wee)\b/.test(text);
    const dirty = /\b(dirty|poo|poop|soiled)\b/.test(text);
    const wetAmount =
      text.match(/\b(light|medium|heavy)\s+(?:wet|wee)\b/)?.[1] ||
      text.match(/\b(?:wet|wee)\s+(light|medium|heavy)\b/)?.[1];
    const dirtyAmount =
      text.match(/\b(light|medium|heavy)\s+(?:dirty|poo|poop|soiled)\b/)?.[1] ||
      text.match(/\b(?:dirty|poo|poop|soiled)\s+(light|medium|heavy)\b/)?.[1];
    const hasSplitAmounts = Boolean(wetAmount && dirtyAmount);
    const diaperAmount = !hasSplitAmounts && /\bheavy\b/.test(text)
      ? ('heavy' as const)
      : !hasSplitAmounts && /\bmedium\b/.test(text)
        ? ('medium' as const)
        : !hasSplitAmounts && /\blight\b/.test(text)
          ? ('light' as const)
          : undefined;
    if (!wet && !dirty) {
      return { values: null, description: 'Say "wet", "dirty", or "both".' };
    }
    const condition = wet && dirty ? 'both' : dirty ? 'dirty' : 'wet';
    return {
      values: {
        condition,
        diaperAmount,
        ...(hasSplitAmounts
          ? {
              wetDiaperAmount: wetAmount as 'light' | 'medium' | 'heavy',
              dirtyDiaperAmount: dirtyAmount as 'light' | 'medium' | 'heavy',
            }
          : {}),
      },
      description: hasSplitAmounts
        ? `Select wet ${wetAmount} and dirty ${dirtyAmount} nappy`
        : `Select ${diaperAmount ? `${diaperAmount} ` : ''}${condition} nappy`,
    };
  }

  if (context === 'pumping') {
    const bottle = parseBottleAmount(text);
    const left = /\bleft(?:\s+(?:side|breast))?\b/.test(text);
    const right = /\bright(?:\s+(?:side|breast))?\b/.test(text);
    const pumpingSide = /\bboth(?:\s+sides?)?\b/.test(text) || (left && right)
      ? ('both' as const)
      : left
        ? ('left' as const)
        : right
          ? ('right' as const)
          : undefined;
    const storageLocation = /\bfridge|refrigerat/.test(text)
      ? ('fridge' as const)
      : /\bfreez/.test(text)
        ? ('freezer' as const)
        : /\bdiscard/.test(text)
          ? ('discarded' as const)
          : /\b(?:use|used)\s+now\b/.test(text)
            ? ('usedNow' as const)
            : undefined;
    if (!bottle && !durationMinutes && !pumpingSide && !storageLocation) {
      return {
        values: null,
        description: 'Say an amount, duration, side, or storage location.',
      };
    }
    return {
      values: {
        ...(bottle || {}),
        durationMinutes,
        pumpingSide,
        storageLocation,
      },
      description: 'Fill the pumping details I heard',
    };
  }

  if (context === 'tummyTime' || context === 'bath') {
    return durationMinutes
      ? {
          values: { durationMinutes },
          description: `Fill ${formatDuration(durationMinutes)}`,
        }
      : { values: null, description: 'Say a duration such as "10 minutes".' };
  }

  if (context === 'growth') {
    const weight = text.match(/(?:weight(?:\s+is)?\s*)?(\d+(?:\.\d+)?)\s*(?:kg|kilograms?)\b/);
    const height = text.match(/(?:height|length)(?:\s+is)?\s*(\d+(?:\.\d+)?)\s*(?:cm|centimet(?:er|re)s?)\b/);
    const head = text.match(/(?:head(?:\s+circumference)?)(?:\s+is)?\s*(\d+(?:\.\d+)?)\s*(?:cm|centimet(?:er|re)s?)\b/);
    const fields = {
      ...(weight ? { weightKg: weight[1] } : {}),
      ...(height ? { heightCm: height[1] } : {}),
      ...(head ? { headCircumferenceCm: head[1] } : {}),
    };
    return Object.keys(fields).length
      ? { values: { fields }, description: 'Fill the growth measurements I heard' }
      : { values: null, description: 'Say a weight, height, or head circumference.' };
  }

  if (context === 'temperature') {
    const match = text.match(/(\d+(?:\.\d+)?)\s*(?:degrees?\s*)?(c|celsius|f|fahrenheit)?\b/);
    if (!match) return { values: null, description: 'Say a temperature, such as "37.2 degrees".' };
    const method = /\barmpit\b/.test(text)
      ? 'armpit'
      : /\bear\b/.test(text)
        ? 'ear'
        : /\bforehead\b/.test(text)
          ? 'forehead'
          : /\boral|mouth\b/.test(text)
            ? 'oral'
            : /\brectal\b/.test(text)
              ? 'rectal'
              : undefined;
    return {
      values: {
        fields: {
          temperature: match[1],
          ...(match[2] ? { temperatureUnit: match[2].startsWith('f') ? 'F' : 'C' } : {}),
          ...(method ? { temperatureMethod: method } : {}),
        },
      },
      description: `Fill a temperature of ${match[1]} degrees`,
    };
  }

  if (context === 'potty') {
    const wee = /\b(wee|wet|urine)\b/.test(text);
    const poo = /\b(poo|poop|dirty)\b/.test(text);
    const pottyType = wee && poo ? 'both' : poo ? 'poo' : wee ? 'wee' : undefined;
    const pottyOutcome = /\baccident\b/.test(text)
      ? 'accident'
      : /\battempt|tried\b/.test(text)
        ? 'attempt'
        : /\bsuccess|successful\b/.test(text)
          ? 'success'
          : undefined;
    return pottyType || pottyOutcome
      ? {
          values: { fields: { ...(pottyType ? { pottyType } : {}), ...(pottyOutcome ? { pottyOutcome } : {}) } },
          description: 'Fill the potty details I heard',
        }
      : { values: null, description: 'Say wee, poo, both, attempt, success, or accident.' };
  }

  if (context === 'medication') {
    const dose = text.match(/(\d+(?:\.\d+)?)\s*(ml|mg|mcg|g)\b/);
    const name = fieldText(text, [
      /(?:medicine|medication)\s+(.+?)(?:\s+\d+(?:\.\d+)?\s*(?:ml|mg|mcg|g)\b|$)/,
      /(?:gave|given|give)\s+(.+?)(?:\s+\d+(?:\.\d+)?\s*(?:ml|mg|mcg|g)\b|$)/,
    ]);
    if (!name && !dose) return { values: null, description: 'Say the medicine name and recorded dose.' };
    return {
      values: {
        fields: {
          ...(name ? { medicineName: name } : {}),
          ...(dose ? { doseAmount: dose[1], doseUnit: dose[2] } : {}),
        },
      },
      description: 'Fill the medicine details I heard',
    };
  }

  const freeTextField: Partial<Record<VoiceEntryContext, string>> = {
    solids: 'food',
    milestone: 'milestone',
    symptom: 'observation',
    appointment: 'appointmentType',
    immunization: 'immunization',
    teething: 'tooth',
  };
  const key = freeTextField[context];
  const freeText = stripLeadIn(transcript);
  if (key && freeText) {
    return {
      values: { fields: { [key]: freeText } },
      description: `Fill ${freeText}`,
    };
  }

  return { values: null, description: 'I could not find details for this form.' };
};

const formatDuration = (minutes: number) => {
  if (minutes < 60) return `${minutes} minutes`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours} ${hours === 1 ? 'hour' : 'hours'}${
    remainder ? ` ${remainder} minutes` : ''
  }`;
};

export const parseVoiceCommand = (transcript: string): VoiceCommandResult => {
  const text = transcript.trim().toLowerCase();
  if (!text) {
    return { command: null, description: 'I did not hear a command.' };
  }

  const mentionsFeed = /\b(feed|feeding|fed|breastfeed|breastfeeding|bottle)\b/.test(
    text,
  );
  const mentionsSleep = /\b(sleep|slept|nap|napped|bedtime)\b/.test(text);
  const wantsStop = /\b(stop|finish|finished|end|ended)\b/.test(text);

  if (wantsStop && mentionsFeed) {
    return { command: { kind: 'stop-feed' }, description: 'Stop the feed timer' };
  }

  if (wantsStop && mentionsSleep) {
    return {
      command: { kind: 'stop-sleep' },
      description: 'Stop the sleep timer',
    };
  }

  if (/\b(nappy|diaper)\b/.test(text)) {
    const wet = /\b(wet|wee)\b/.test(text);
    const dirty = /\b(dirty|poo|poop|soiled)\b/.test(text);
    const condition = wet && dirty ? 'both' : dirty ? 'dirty' : 'wet';
    return {
      command: { kind: 'log-diaper', condition },
      description: `Log a ${condition === 'both' ? 'wet and dirty' : condition} nappy`,
    };
  }

  if (mentionsSleep) {
    const sleepType = /\bcontact(?:\s+nap)?\b/.test(text)
      ? ('contactNap' as const)
      : /\bcar\b/.test(text)
        ? ('car' as const)
        : ('cot' as const);
    const durationMinutes = parseDurationMinutes(text);
    if (durationMinutes) {
      return {
        command: { kind: 'log-sleep', sleepType, durationMinutes },
        description: `Log ${formatDuration(durationMinutes)} of ${
          sleepType === 'contactNap'
            ? 'contact sleep'
            : `${sleepType} sleep`
        }`,
      };
    }
    return {
      command: { kind: 'start-sleep', sleepType },
      description: `Start a ${sleepType === 'contactNap' ? 'contact' : sleepType} sleep timer`,
    };
  }

  if (mentionsFeed) {
    const bottle = parseBottleAmount(text);
    const durationMinutes = parseDurationMinutes(text);
    if (bottle) {
      return {
        command: { kind: 'log-feed', feedType: 'bottle', ...bottle },
        description: `Log a ${bottle.amount} ${bottle.unit} bottle`,
      };
    }
    if (durationMinutes) {
      return {
        command: {
          kind: 'log-feed',
          feedType: 'breast',
          durationMinutes,
        },
        description: `Log a ${formatDuration(durationMinutes)} nursing session`,
      };
    }
    return {
      command: { kind: 'start-feed', feedType: 'breast' },
      description: 'Start a nursing timer',
    };
  }

  return {
    command: null,
    description:
      'Try saying “wet nappy”, “start a feed”, “120 ml bottle”, or “slept for 45 minutes”.',
  };
};
