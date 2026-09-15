import type { HealthRecordExtraction } from '../services/appointmentImport';

const decimal = (value: string) => Number(value.replace(',', '.'));

const rounded = (value: number, places = 3) => {
  const multiplier = 10 ** places;
  return Math.round(value * multiplier) / multiplier;
};

const measurement = (
  source: string,
  label: RegExp,
  units: RegExp,
  convert: (value: number, unit: string, match: RegExpMatchArray) => number,
) => {
  const match = source.match(
    new RegExp(`${label.source}\\s*(?:is|was|[:=\\-])?\\s*(\\d+(?:[.,]\\d+)?)\\s*(${units.source})`, 'i'),
  );
  if (!match) return undefined;
  const value = decimal(match[1]);
  return Number.isFinite(value) ? convert(value, match[2].toLowerCase(), match) : undefined;
};

const dateFromText = (source: string) => {
  const labelled = source.match(
    /(?:measurement\s+date|date|measured\s+on)\s*(?:is|was|[:=\-])?\s*(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})(?:\s+(?:at\s*)?(\d{1,2})[:.]([0-5]\d))?/i,
  );
  const match = labelled || source.match(
    /\b(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})(?:\s+(?:at\s*)?(\d{1,2})[:.]([0-5]\d))?\b/,
  );
  if (!match) return undefined;
  const day = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const rawYear = Number(match[3]);
  const year = rawYear < 100 ? 2000 + rawYear : rawYear;
  const hour = match[4] === undefined ? 12 : Number(match[4]);
  const minute = match[5] === undefined ? 0 : Number(match[5]);
  const date = new Date(year, monthIndex, day, hour, minute);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== monthIndex ||
    date.getDate() !== day ||
    hour > 23
  ) return undefined;
  return date.toISOString();
};

const labelledText = (source: string, label: RegExp, maximum = 500) => {
  const match = source.match(
    new RegExp(`${label.source}\\s*(?:is|was|[:=\\-])?\\s*([^\\n;,]+)`, 'i'),
  );
  return match?.[1]?.trim().slice(0, maximum) || undefined;
};

export const parseGrowthImportText = (source: string): HealthRecordExtraction => {
  const text = source.replace(/[—–]/g, '-').trim();
  const weightMatch = text.match(
    /(?:weight|wt)\s*(?:is|was|[:=\-])?\s*(\d+(?:[.,]\d+)?)\s*(kg|kilograms?|g|grams?|lb|lbs|pounds?)(?:\s*(\d+(?:[.,]\d+)?)\s*(?:oz|ounces?))?/i,
  );
  let weightKg: number | undefined;
  if (weightMatch) {
    const value = decimal(weightMatch[1]);
    const unit = weightMatch[2].toLowerCase();
    weightKg = unit.startsWith('g')
      ? value / 1_000
      : unit.startsWith('l') || unit.startsWith('p')
        ? value * 0.45359237 + (weightMatch[3] ? decimal(weightMatch[3]) * 0.028349523 : 0)
        : value;
    weightKg = weightKg >= 0.05 && weightKg <= 100 ? rounded(weightKg) : undefined;
  }

  const lengthToCm = (value: number, unit: string) =>
    unit.startsWith('mm') ? value / 10 : unit.startsWith('in') ? value * 2.54 : unit === 'm' ? value * 100 : value;
  const height = measurement(
    text,
    /(?:length|height|len|ht)/,
    /(?:cm|centimet(?:er|re)s?|mm|millimet(?:er|re)s?|in|inches?|m)/,
    lengthToCm,
  );
  const head = measurement(
    text,
    /(?:head\s*(?:circumference|circ\.?|measurement)|hc)/,
    /(?:cm|centimet(?:er|re)s?|mm|millimet(?:er|re)s?|in|inches?)/,
    lengthToCm,
  );
  const heightCm = height !== undefined && height >= 10 && height <= 250
    ? rounded(height)
    : undefined;
  const headCircumferenceCm = head !== undefined && head >= 10 && head <= 100
    ? rounded(head)
    : undefined;

  return {
    weightKg,
    heightCm,
    headCircumferenceCm,
    measuredBy: labelledText(text, /(?:measured\s+by|taken\s+by)/),
    dateTime: dateFromText(text),
    notes: labelledText(text, /(?:notes?|comments?)/, 2_000),
  };
};

export const hasGrowthMeasurements = (extraction: HealthRecordExtraction) =>
  extraction.weightKg !== undefined ||
  extraction.heightCm !== undefined ||
  extraction.headCircumferenceCm !== undefined;
