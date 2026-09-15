import { createHash } from 'node:crypto';

export const AI_POLICY_VERSION = '2026-09-ai-v3';
export const FREE_AI_LIMIT = 5;
export const PREMIUM_AI_LIMIT = 100;
export const MAX_QUESTION_LENGTH = 600;
export const MAX_RECENT_EVENTS = 60;
export const MAX_MODEL_INPUT_TOKENS = 5_000;
export const MAX_MODEL_OUTPUT_TOKENS = 350;

export type AiAccessLevel = 'free' | 'premium' | 'legacy';
export type AiMode = 'ask' | 'summary';
export type AiPeriod = 'today' | 'last7days';
export type AiResultKind =
  | 'answer'
  | 'summary'
  | 'out_of_scope'
  | 'safety_redirect';

export interface AiUsageState {
  freeUsed?: number;
  monthlyKey?: string;
  monthlyUsed?: number;
}

export interface AiUsageSummary {
  accessLevel: AiAccessLevel;
  limit: number;
  used: number;
  remaining: number;
  periodKey: string | null;
}

export interface AiEvidence {
  factId: string;
  label: string;
  value: string;
}

export interface AiDataWindow {
  from: string;
  to: string;
  eventsIncluded: number;
}

export interface AiPublicResult {
  kind: AiResultKind;
  title: string;
  text: string;
  evidence: AiEvidence[];
  dataWindow: AiDataWindow;
  cached: boolean;
  usage: AiUsageSummary;
}

export interface ParsedAskRequest {
  requestId: string;
  babyId: string;
  mode: 'ask';
  question: string;
  timezone: string;
}

export interface ParsedSummaryRequest {
  requestId: string;
  babyId: string;
  mode: 'summary';
  period: AiPeriod;
  timezone: string;
}

export type ParsedAiRequest = ParsedAskRequest | ParsedSummaryRequest;

export interface SanitizedEvent {
  type: string;
  startTime: Date;
  endTime: Date | null;
  durationMinutes: number | null;
  metadata: Record<string, string | number | boolean | string[]>;
}

export interface CareSnapshot {
  ageBand: string;
  dataWindow: AiDataWindow;
  facts: AiEvidence[];
}

export interface ModelResult {
  kind: 'answer' | 'summary';
  title: string;
  text: string;
  evidenceFactIds: string[];
}

const REQUEST_ID_PATTERN = /^[a-zA-Z0-9_-]{16,80}$/;
const BABY_ID_PATTERN = /^[^/]{1,128}$/;
const SUPPORTED_EVENT_TYPES = new Set([
  'feed',
  'sleep',
  'diaper',
  'pumping',
  'solids',
  'growth',
  'potty',
  'temperature',
  'medication',
  'tummyTime',
  'bath',
  'milestone',
  'symptom',
  'appointment',
  'immunization',
  'teething',
]);

const ENUM_METADATA_VALUES: Record<string, ReadonlySet<string>> = {
  feedType: new Set(['breast', 'bottle']),
  breastSide: new Set(['left', 'right', 'both']),
  lastBreastSide: new Set(['left', 'right']),
  unit: new Set(['ml', 'oz']),
  sleepType: new Set(['nap', 'contactNap', 'night']),
  diaperCondition: new Set(['wet', 'dirty', 'both']),
  diaperAmount: new Set(['light', 'medium', 'heavy']),
  wetDiaperAmount: new Set(['light', 'medium', 'heavy']),
  dirtyDiaperAmount: new Set(['light', 'medium', 'heavy']),
  pumpingSide: new Set(['left', 'right', 'both']),
  storageLocation: new Set(['usedNow', 'fridge', 'freezer', 'discarded']),
  texture: new Set(['puree', 'mashed', 'fingerFood', 'mixed']),
  pottyType: new Set(['wee', 'poo', 'both']),
  pottyOutcome: new Set(['success', 'attempt', 'accident']),
  temperatureUnit: new Set(['C', 'F']),
  temperatureMethod: new Set([
    'armpit',
    'ear',
    'forehead',
    'oral',
    'rectal',
    'other',
  ]),
};

const NUMERIC_METADATA_LIMITS: Record<string, [number, number]> = {
  leftBreastDurationSeconds: [0, 2_592_000],
  rightBreastDurationSeconds: [0, 2_592_000],
  amount: [0, 100_000],
  weightKg: [0, 500],
  heightCm: [0, 300],
  headCircumferenceCm: [0, 300],
  temperature: [-100, 250],
  doseAmount: [0, 100_000],
};

const MEDICAL_OR_ADVICE_PATTERNS = [
  /\b(emergency|ambulance|000|not breathing|unconscious|seizure|choking)\b/i,
  /\b(diagnos(?:e|is)|treat(?:ment)?|medical advice|doctor|hospital)\b/i,
  /\b(symptom|rash|fever|cough|pain|vomit|diarrh|bleeding|infection|dehydrat|letharg|unwell|sick)\w*\b/i,
  /\b(dose|dosage|how much medicine|medication advice)\b/i,
  /\b(is (?:this|that|it) normal|should (?:i|we)|what should|what do i do)\b/i,
  /\b(tips|advice|best way|how (?:do|can|could) i|get (?:my|the) baby to)\b/i,
  /\b(can (?:my|the) baby|when should (?:my|the) baby|why is (?:my|the) baby)\b/i,
  /\b(can|could|may) i (?:give|use|try)\b/i,
];

const PROMPT_INJECTION_PATTERNS = [
  /\b(ignore|disregard|override|forget)\b.{0,40}\b(instruction|prompt|policy|rule)s?\b/i,
  /\b(system prompt|developer message|reveal (?:your|the) prompt|act as)\b/i,
];

const CARE_DATA_PATTERNS = [
  /\b(feed|feeding|nursing|bottle|sleep|slept|nap|nappy|diaper|pumping)\b/i,
  /\b(growth|weight|height|temperature|medicine|medication|potty|bath)\b/i,
  /\b(milestone|appointment|immunization|immunisation|teething|tummy time)\b/i,
];

const RECORD_DATA_PATTERNS = [
  /\b(log|logs|logged|record|records|recorded|history|timeline)\b/i,
];

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const asTrimmedString = (value: unknown) =>
  typeof value === 'string' ? value.trim() : '';

export const validateTimeZone = (timeZone: string) => {
  try {
    new Intl.DateTimeFormat('en-AU', { timeZone }).format(new Date());
    return timeZone;
  } catch {
    throw new Error('Choose a valid device time zone.');
  }
};

export const parseAiRequest = (value: unknown): ParsedAiRequest => {
  const input = asRecord(value);
  const requestId = asTrimmedString(input.requestId);
  const babyId = asTrimmedString(input.babyId);
  const mode = asTrimmedString(input.mode);
  const timezone = validateTimeZone(asTrimmedString(input.timezone));

  if (!REQUEST_ID_PATTERN.test(requestId)) {
    throw new Error('The AI request ID is invalid.');
  }
  if (!BABY_ID_PATTERN.test(babyId)) {
    throw new Error('Select a valid baby profile.');
  }
  if (mode === 'ask') {
    const question = asTrimmedString(input.question);
    if (question.length < 3 || question.length > MAX_QUESTION_LENGTH) {
      throw new Error(
        `Questions must be between 3 and ${MAX_QUESTION_LENGTH} characters.`,
      );
    }
    return { requestId, babyId, mode, question, timezone };
  }
  if (mode === 'summary') {
    const period = asTrimmedString(input.period);
    if (period !== 'today' && period !== 'last7days') {
      throw new Error('Choose Today or Last 7 days.');
    }
    return { requestId, babyId, mode, period, timezone };
  }
  throw new Error('Choose a supported AI request type.');
};

export const classifyQuestion = (
  question: string,
): 'safety_redirect' | 'out_of_scope' | null => {
  if (PROMPT_INJECTION_PATTERNS.some(pattern => pattern.test(question))) {
    return 'out_of_scope';
  }
  if (MEDICAL_OR_ADVICE_PATTERNS.some(pattern => pattern.test(question))) {
    return 'safety_redirect';
  }
  if (
    !CARE_DATA_PATTERNS.some(pattern => pattern.test(question)) &&
    !RECORD_DATA_PATTERNS.some(pattern => pattern.test(question))
  ) {
    return 'out_of_scope';
  }
  return null;
};

export const fixedBoundaryResult = (
  kind: 'safety_redirect' | 'out_of_scope',
  dataWindow: AiDataWindow,
  usage: AiUsageSummary,
): AiPublicResult =>
  kind === 'safety_redirect'
    ? {
        kind,
        title: 'Get appropriate help',
        text:
          'PitterPatter can only explain what was logged. It cannot assess symptoms, recommend medicine, or make care decisions. Contact a qualified health professional, or local emergency services if you are worried about immediate safety.',
        evidence: [],
        dataWindow,
        cached: true,
        usage,
      }
    : {
        kind,
        title: 'Logged records only',
        text:
          'The Assistant can answer questions about care recorded in PitterPatter, such as recent feeds, sleep, nappies, durations, and seven-day patterns.',
        evidence: [],
        dataWindow,
        cached: true,
        usage,
      };

export const utcMonthKey = (at = new Date()) =>
  `${at.getUTCFullYear()}-${String(at.getUTCMonth() + 1).padStart(2, '0')}`;

export const usageSummary = (
  accessLevel: AiAccessLevel,
  state: AiUsageState | undefined,
  at = new Date(),
): AiUsageSummary => {
  if (accessLevel === 'premium' || accessLevel === 'legacy') {
    const periodKey = utcMonthKey(at);
    const used = state?.monthlyKey === periodKey ? state.monthlyUsed || 0 : 0;
    return {
      accessLevel,
      limit: PREMIUM_AI_LIMIT,
      used,
      remaining: Math.max(0, PREMIUM_AI_LIMIT - used),
      periodKey,
    };
  }
  const used = state?.freeUsed || 0;
  return {
    accessLevel: 'free',
    limit: FREE_AI_LIMIT,
    used,
    remaining: Math.max(0, FREE_AI_LIMIT - used),
    periodKey: null,
  };
};

const zonedParts = (date: Date, timeZone: string) => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const values = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter(part => part.type !== 'literal')
      .map(part => [part.type, Number(part.value)]),
  );
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
};

const zonedCalendarTimeToUtc = (
  calendar: { year: number; month: number; day: number },
  timeZone: string,
) => {
  const targetMillis = Date.UTC(
    calendar.year,
    calendar.month - 1,
    calendar.day,
  );
  let guess = targetMillis;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = zonedParts(new Date(guess), timeZone);
    const renderedMillis = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    guess -= renderedMillis - targetMillis;
  }
  return new Date(guess);
};

export const summaryWindow = (
  period: AiPeriod,
  timeZone: string,
  now = new Date(),
) => {
  validateTimeZone(timeZone);
  const current = zonedParts(now, timeZone);
  const todayCalendar = new Date(
    Date.UTC(current.year, current.month - 1, current.day),
  );
  if (period === 'last7days') {
    todayCalendar.setUTCDate(todayCalendar.getUTCDate() - 6);
  }
  const from = zonedCalendarTimeToUtc(
    {
      year: todayCalendar.getUTCFullYear(),
      month: todayCalendar.getUTCMonth() + 1,
      day: todayCalendar.getUTCDate(),
    },
    timeZone,
  );
  return { from, to: now };
};

export const askWindow = (now = new Date()) => ({
  from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1_000),
  to: now,
});

export const sanitizeMetadata = (value: unknown) => {
  const source = asRecord(value);
  const sanitized: Record<string, string | number | boolean | string[]> = {};
  for (const [key, item] of Object.entries(source)) {
    const enumValues = ENUM_METADATA_VALUES[key];
    if (enumValues && typeof item === 'string' && enumValues.has(item)) {
      sanitized[key] = item;
      continue;
    }
    const numericLimits = NUMERIC_METADATA_LIMITS[key];
    if (
      numericLimits &&
      typeof item === 'number' &&
      Number.isFinite(item) &&
      item >= numericLimits[0] &&
      item <= numericLimits[1]
    ) {
      sanitized[key] = item;
      continue;
    }
    if ((key === 'firstExposure' || key === 'allergen') && typeof item === 'boolean') {
      sanitized[key] = item;
      continue;
    }
    if (
      key === 'breastSidesUsed' &&
      Array.isArray(item) &&
      item.length <= 2 &&
      item.every(entry => entry === 'left' || entry === 'right')
    ) {
      sanitized[key] = [...new Set(item)] as string[];
      continue;
    }
    if (
      key === 'doseUnit' &&
      typeof item === 'string' &&
      /^[a-zA-Zµμ%]{1,8}$/.test(item)
    ) {
      sanitized[key] = item;
    }
  }
  return sanitized;
};

export const ageBandFromDate = (dateOfBirth: Date | null, at = new Date()) => {
  if (!dateOfBirth || dateOfBirth > at) return 'age not available';
  const days = Math.max(
    0,
    Math.floor((at.getTime() - dateOfBirth.getTime()) / 86_400_000),
  );
  if (days < 14) return 'under 2 weeks';
  if (days < 84) return `${Math.floor(days / 7)} weeks`;
  if (days < 730) return `${Math.floor(days / 30.4375)} months`;
  return `${Math.floor(days / 365.25)} years`;
};

const localDateKey = (date: Date, timeZone: string) => {
  const parts = zonedParts(date, timeZone);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(
    parts.day,
  ).padStart(2, '0')}`;
};

const eventDuration = (event: SanitizedEvent) => {
  if (event.durationMinutes && event.durationMinutes > 0) {
    return event.durationMinutes;
  }
  if (event.endTime) {
    return Math.max(
      0,
      Math.round(
        (event.endTime.getTime() - event.startTime.getTime()) / 60_000,
      ),
    );
  }
  return 0;
};

const friendlyMetadata = (event: SanitizedEvent) => {
  const metadata = event.metadata;
  const parts: string[] = [];
  if (typeof metadata.feedType === 'string') parts.push(metadata.feedType);
  if (typeof metadata.breastSide === 'string') parts.push(metadata.breastSide);
  if (typeof metadata.leftBreastDurationSeconds === 'number') {
    parts.push(`left ${Math.round(metadata.leftBreastDurationSeconds / 60)} minutes`);
  }
  if (typeof metadata.rightBreastDurationSeconds === 'number') {
    parts.push(`right ${Math.round(metadata.rightBreastDurationSeconds / 60)} minutes`);
  }
  if (typeof metadata.amount === 'number') {
    parts.push(`${metadata.amount} ${String(metadata.unit || '')}`.trim());
  }
  if (typeof metadata.sleepType === 'string') parts.push(metadata.sleepType);
  if (typeof metadata.diaperCondition === 'string') {
    parts.push(metadata.diaperCondition);
  }
  if (typeof metadata.wetDiaperAmount === 'string') {
    parts.push(`wet ${metadata.wetDiaperAmount}`);
  }
  if (typeof metadata.dirtyDiaperAmount === 'string') {
    parts.push(`dirty ${metadata.dirtyDiaperAmount}`);
  }
  if (
    typeof metadata.diaperAmount === 'string' &&
    typeof metadata.wetDiaperAmount !== 'string' &&
    typeof metadata.dirtyDiaperAmount !== 'string'
  ) {
    parts.push(metadata.diaperAmount);
  }
  if (typeof metadata.pumpingSide === 'string') parts.push(metadata.pumpingSide);
  if (typeof metadata.storageLocation === 'string') {
    parts.push(metadata.storageLocation);
  }
  if (typeof metadata.texture === 'string') parts.push(metadata.texture);
  if (metadata.firstExposure === true) parts.push('first exposure');
  if (metadata.allergen === true) parts.push('allergen recorded');
  if (typeof metadata.temperature === 'number') {
    parts.push(
      `${metadata.temperature} °${String(metadata.temperatureUnit || 'C')}`,
    );
  }
  if (typeof metadata.weightKg === 'number') parts.push(`${metadata.weightKg} kg`);
  if (typeof metadata.heightCm === 'number') parts.push(`${metadata.heightCm} cm`);
  if (typeof metadata.headCircumferenceCm === 'number') {
    parts.push(`${metadata.headCircumferenceCm} cm head circumference`);
  }
  if (typeof metadata.pottyType === 'string') parts.push(metadata.pottyType);
  if (typeof metadata.pottyOutcome === 'string') parts.push(metadata.pottyOutcome);
  if (typeof metadata.temperatureMethod === 'string') {
    parts.push(metadata.temperatureMethod);
  }
  if (typeof metadata.doseAmount === 'number') {
    parts.push(
      `recorded amount ${metadata.doseAmount} ${String(metadata.doseUnit || '')}`.trim(),
    );
  }
  return parts.join(', ');
};

export const buildCareSnapshot = (
  events: SanitizedEvent[],
  ageBand: string,
  from: Date,
  to: Date,
  timeZone: string,
): CareSnapshot => {
  const filtered = events
    .filter(
      event =>
        SUPPORTED_EVENT_TYPES.has(event.type) &&
        event.startTime >= from &&
        event.startTime <= to,
    )
    .sort((left, right) => right.startTime.getTime() - left.startTime.getTime());
  const facts: AiEvidence[] = [];
  const counts = new Map<string, number>();
  const durations = new Map<string, number>();
  const durationSamples = new Map<string, number>();
  const eventTimes = new Map<string, number[]>();
  const amounts = new Map<string, { total: number; count: number; unit: string }>();
  const daily = new Map<string, Map<string, number>>();
  const dailyDurations = new Map<string, Map<string, number>>();

  for (const event of filtered) {
    counts.set(event.type, (counts.get(event.type) || 0) + 1);
    const duration = eventDuration(event);
    durations.set(event.type, (durations.get(event.type) || 0) + duration);
    if (duration > 0) {
      durationSamples.set(event.type, (durationSamples.get(event.type) || 0) + 1);
    }
    const times = eventTimes.get(event.type) || [];
    times.push(event.startTime.getTime());
    eventTimes.set(event.type, times);
    if (
      (event.type === 'feed' || event.type === 'pumping') &&
      typeof event.metadata.amount === 'number' &&
      typeof event.metadata.unit === 'string'
    ) {
      const amountKey = `${event.type}_${event.metadata.unit}`;
      const amount = amounts.get(amountKey) || {
        total: 0,
        count: 0,
        unit: event.metadata.unit,
      };
      amount.total += event.metadata.amount;
      amount.count += 1;
      amounts.set(amountKey, amount);
    }
    const dayKey = localDateKey(event.startTime, timeZone);
    const dayCounts = daily.get(dayKey) || new Map<string, number>();
    dayCounts.set(event.type, (dayCounts.get(event.type) || 0) + 1);
    daily.set(dayKey, dayCounts);
    if (duration > 0) {
      const dayDuration = dailyDurations.get(dayKey) || new Map<string, number>();
      dayDuration.set(event.type, (dayDuration.get(event.type) || 0) + duration);
      dailyDurations.set(dayKey, dayDuration);
    }
  }

  facts.push({
    factId: 'window_total',
    label: 'Records analysed',
    value: `${filtered.length} records across ${daily.size} logged ${daily.size === 1 ? 'day' : 'days'}`,
  });
  [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .forEach(([type, count]) => {
      facts.push({
        factId: `total_${type}_count`,
        label: `${type} records`,
        value: String(count),
      });
      const duration = durations.get(type) || 0;
      if (duration > 0) {
        facts.push({
          factId: `total_${type}_minutes`,
          label: `${type} logged duration`,
          value: `${duration} minutes`,
        });
        facts.push({
          factId: `average_${type}_minutes`,
          label: `${type} average logged duration`,
          value: `${Math.round(duration / (durationSamples.get(type) || 1))} minutes across ${durationSamples.get(type) || 1} timed records`,
        });
      }
      const orderedTimes = (eventTimes.get(type) || []).sort((left, right) => left - right);
      if (orderedTimes.length > 1) {
        const gaps = orderedTimes.slice(1).map((time, index) => time - orderedTimes[index]);
        facts.push({
          factId: `average_${type}_gap_minutes`,
          label: `${type} average gap`,
          value: `${Math.round(
            gaps.reduce((total, gap) => total + gap, 0) /
              gaps.length /
              60_000,
          )} minutes across ${gaps.length} intervals`,
        });
      }
    });

  [...amounts.entries()].forEach(([key, amount]) => {
    facts.push({
      factId: `total_${key}_amount`,
      label: `${key.replace('_', ' ')} logged amount`,
      value: `${Number(amount.total.toFixed(2))} ${amount.unit} across ${amount.count} records`,
    });
    facts.push({
      factId: `average_${key}_amount`,
      label: `${key.replace('_', ' ')} average logged amount`,
      value: `${Number((amount.total / amount.count).toFixed(2))} ${amount.unit}`,
    });
  });

  filtered.slice(0, MAX_RECENT_EVENTS).forEach((event, index) => {
    const details = friendlyMetadata(event);
    const duration = eventDuration(event);
    facts.push({
      factId: `recent_${index}`,
      label: index === 0 ? 'Most recent record' : `Recent record ${index + 1}`,
      value: [
        event.startTime.toISOString(),
        event.type,
        duration ? `${duration} minutes` : '',
        details,
      ]
        .filter(Boolean)
        .join(' · '),
    });
  });

  [...daily.entries()]
    .sort(([left], [right]) => right.localeCompare(left))
    .forEach(([date, dayCounts], dayIndex) => {
      [...dayCounts.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .forEach(([type, count]) => {
          const duration = dailyDurations.get(date)?.get(type) || 0;
          facts.push({
            factId: `day_${dayIndex}_${type}`,
            label: `${date} ${type}`,
            value: `${count} ${count === 1 ? 'record' : 'records'}${
              duration ? ` · ${duration} minutes` : ''
            }`,
          });
        });
    });

  return {
    ageBand,
    dataWindow: {
      from: from.toISOString(),
      to: to.toISOString(),
      eventsIncluded: filtered.length,
    },
    facts: facts.slice(0, 180),
  };
};

export const fitSnapshotToTokenLimit = (
  snapshot: CareSnapshot,
  promptPrefix: string,
  countTokens: (value: string) => number,
  maximum = MAX_MODEL_INPUT_TOKENS,
) => {
  const facts = [...snapshot.facts];
  const serialize = () =>
    JSON.stringify({
      ageBand: snapshot.ageBand,
      dataWindow: snapshot.dataWindow,
      facts,
    });
  while (facts.length > 1 && countTokens(`${promptPrefix}\n${serialize()}`) > maximum) {
    facts.pop();
  }
  const serialized = serialize();
  if (countTokens(`${promptPrefix}\n${serialized}`) > maximum) {
    throw new Error('The selected care window is too large to summarise safely.');
  }
  return { serialized, facts };
};

export const validateModelResult = (
  value: unknown,
  mode: AiMode,
  facts: AiEvidence[],
): Omit<AiPublicResult, 'dataWindow' | 'cached' | 'usage'> => {
  const result = asRecord(value);
  const requiredKind = mode === 'summary' ? 'summary' : 'answer';
  if (result.kind !== requiredKind) {
    throw new Error('The AI response type was invalid.');
  }
  const title = asTrimmedString(result.title).slice(0, 80);
  const text = asTrimmedString(result.text).slice(0, 1_200);
  if (!title || !text) throw new Error('The AI response was incomplete.');
  const factMap = new Map(facts.map(fact => [fact.factId, fact]));
  const requestedIds = Array.isArray(result.evidenceFactIds)
    ? result.evidenceFactIds.filter(item => typeof item === 'string')
    : [];
  const evidence = [...new Set(requestedIds)]
    .slice(0, 3)
    .map(factId => factMap.get(factId))
    .filter((fact): fact is AiEvidence => Boolean(fact));
  if (!evidence.length) {
    throw new Error('The AI response did not cite a supplied fact.');
  }
  const evidenceNumbers = new Set(
    evidence.flatMap(item => item.value.match(/\d+(?:[.,]\d+)?/g) || []),
  );
  const responseNumbers = text.match(/\d+(?:[.,]\d+)?/g) || [];
  if (responseNumbers.some(number => !evidenceNumbers.has(number))) {
    throw new Error('The AI response included a number without supporting evidence.');
  }
  return { kind: requiredKind, title, text, evidence };
};

export const stableHash = (value: string) =>
  createHash('sha256').update(value).digest('hex');

export const aiAssistantCoreTestables = {
  ageBandFromDate,
  askWindow,
  buildCareSnapshot,
  classifyQuestion,
  fitSnapshotToTokenLimit,
  fixedBoundaryResult,
  parseAiRequest,
  sanitizeMetadata,
  summaryWindow,
  usageSummary,
  utcMonthKey,
  validateModelResult,
};
