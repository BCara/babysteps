import type { BabyEvent } from '../services/firebase/events';
import { formatDiaperAmountDetail } from './diaperAmounts';
import { careActionByType } from '../constants/careActions';
import {
  sleepLocationLabel,
  type CustomSleepLocation,
} from './sleepLocation';

export interface CareDayStat {
  date: Date;
  feeds: number;
  diapers: number;
  sleepMinutes: number;
}

export interface CareStatsExportInput {
  babyName: string;
  days: CareDayStat[];
  events?: BabyEvent[];
  /** Needed to name a custom sleep place rather than export its stored id. */
  customSleepLocations?: CustomSleepLocation[];
}

const csvCell = (value: string | number) =>
  `"${String(value).replaceAll('"', '""')}"`;

const localDate = (date: Date) =>
  [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');

const row = (values: Array<string | number>) => values.map(csvCell).join(',');

const eventsInPeriod = (events: BabyEvent[], days: CareDayStat[]) => {
  const firstDay = days[0]?.date;
  const lastDay = days[days.length - 1]?.date;
  const periodStart = firstDay ? new Date(firstDay) : null;
  periodStart?.setHours(0, 0, 0, 0);
  const periodEnd = lastDay ? new Date(lastDay) : null;
  periodEnd?.setHours(23, 59, 59, 999);

  return events
    .filter(
      event =>
        !periodStart ||
        !periodEnd ||
        (event.startTime >= periodStart && event.startTime <= periodEnd),
    )
    .sort((left, right) => left.startTime.getTime() - right.startTime.getTime());
};

export const buildCareDataJson = ({
  babyName,
  days,
  events = [],
}: CareStatsExportInput) => {
  const reportEvents = eventsInPeriod(events, days);
  const totals = days.reduce(
    (summary, day) => ({
      feeds: summary.feeds + day.feeds,
      nappies: summary.nappies + day.diapers,
      sleepMinutes: summary.sleepMinutes + day.sleepMinutes,
    }),
    { feeds: 0, nappies: 0, sleepMinutes: 0 },
  );

  return JSON.stringify(
    {
      schema: 'pitterpatter-care-export/v1',
      purpose:
        'Structured care data suitable for analysis by an AI assistant or another data tool.',
      baby: { name: babyName },
      period: {
        startDate: days[0] ? localDate(days[0].date) : null,
        endDate: days.length ? localDate(days[days.length - 1].date) : null,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      summary: {
        totals,
        days: days.map(day => ({
          date: localDate(day.date),
          feeds: day.feeds,
          nappies: day.diapers,
          sleepMinutes: day.sleepMinutes,
        })),
      },
      events: reportEvents.map(event => ({
        type: event.type,
        label: careActionByType[event.type].label,
        startTime: event.startTime.toISOString(),
        endTime: event.endTime?.toISOString() || null,
        durationMinutes:
          event.durationMinutes ??
          (event.endTime
            ? Math.max(
                0,
                Math.round(
                  (event.endTime.getTime() - event.startTime.getTime()) / 60000,
                ),
              )
            : null),
        notes: event.notes || null,
        metadata: event.metadata || {},
      })),
      privacy:
        'Account IDs, caregiver IDs, and internal event IDs are intentionally omitted.',
      disclaimer: 'For everyday tracking only; not medical advice.',
    },
    null,
    2,
  );
};

export const buildCareStatsCsv = ({
  babyName,
  days,
  events = [],
  customSleepLocations = [],
}: CareStatsExportInput) => {
  const totals = days.reduce(
    (summary, day) => ({
      feeds: summary.feeds + day.feeds,
      diapers: summary.diapers + day.diapers,
      sleepMinutes: summary.sleepMinutes + day.sleepMinutes,
    }),
    { feeds: 0, diapers: 0, sleepMinutes: 0 },
  );
  const firstDay = days[0]?.date;
  const lastDay = days[days.length - 1]?.date;
  const period =
    firstDay && lastDay
      ? `${localDate(firstDay)} to ${localDate(lastDay)}`
      : 'No dates available';
  const reportEvents = eventsInPeriod(events, days);

  const eventDetails = (event: BabyEvent) => {
    const metadata = event.metadata || {};
    const details: string[] = [];
    if (event.durationMinutes) details.push(`${event.durationMinutes} min`);
    if (metadata.feedType) details.push(metadata.feedType);
    if (metadata.breastSide) details.push(metadata.breastSide);
    if (metadata.amount && metadata.unit) details.push(`${metadata.amount} ${metadata.unit}`);
    if (metadata.diaperCondition) details.push(metadata.diaperCondition);
    const diaperAmounts = formatDiaperAmountDetail(metadata);
    if (diaperAmounts) details.push(diaperAmounts);
    // Named, not the stored id: a custom place would otherwise export as
    // "custom:pram".
    if (metadata.sleepType) {
      details.push(sleepLocationLabel(metadata.sleepType, customSleepLocations));
    }
    if (metadata.pumpingSide) details.push(metadata.pumpingSide);
    if (metadata.storageLocation) details.push(metadata.storageLocation);
    if (metadata.food) details.push(metadata.food);
    if (metadata.foodAmount) details.push(metadata.foodAmount);
    if (metadata.texture) details.push(metadata.texture);
    if (metadata.firstExposure) details.push('first exposure');
    if (metadata.allergen) details.push('allergen noted');
    if (metadata.weightKg) details.push(`${metadata.weightKg} kg`);
    if (metadata.heightCm) details.push(`${metadata.heightCm} cm height`);
    if (metadata.headCircumferenceCm) details.push(`${metadata.headCircumferenceCm} cm head`);
    if (metadata.pottyType) details.push(metadata.pottyType);
    if (metadata.pottyOutcome) details.push(metadata.pottyOutcome);
    if (metadata.temperature) details.push(`${metadata.temperature} °${metadata.temperatureUnit || 'C'}`);
    if (metadata.temperatureMethod) details.push(metadata.temperatureMethod);
    if (metadata.medicineName) details.push(metadata.medicineName);
    if (metadata.doseAmount) details.push(`${metadata.doseAmount} ${metadata.doseUnit || ''}`.trim());
    if (metadata.administeredBy) details.push(`given by ${metadata.administeredBy}`);
    if (metadata.milestone) details.push(metadata.milestone);
    if (metadata.observation) details.push(metadata.observation);
    if (metadata.appointmentType) details.push(metadata.appointmentType);
    if (metadata.provider) details.push(metadata.provider);
    if (metadata.appointmentLocation) details.push(metadata.appointmentLocation);
    if (metadata.appointmentAddress) details.push(metadata.appointmentAddress);
    if (metadata.appointmentPhone) details.push(metadata.appointmentPhone);
    if (metadata.appointmentReference) details.push(`reference ${metadata.appointmentReference}`);
    if (metadata.immunization) details.push(metadata.immunization);
    if (metadata.immunizationLocation) details.push(metadata.immunizationLocation);
    if (metadata.tooth) details.push(metadata.tooth);
    return details.join(' · ');
  };

  return [
    row(['PitterPatter 7-day care report']),
    row(['Baby', babyName]),
    row(['Period', period]),
    '',
    row([
      'Date',
      'Day',
      'Feeds',
      'Nappies',
      'Sleep minutes',
      'Sleep hours',
    ]),
    ...days.map(day =>
      row([
        localDate(day.date),
        day.date.toLocaleDateString('en-AU', { weekday: 'long' }),
        day.feeds,
        day.diapers,
        day.sleepMinutes,
        (day.sleepMinutes / 60).toFixed(2),
      ]),
    ),
    row([
      'TOTAL',
      '',
      totals.feeds,
      totals.diapers,
      totals.sleepMinutes,
      (totals.sleepMinutes / 60).toFixed(2),
    ]),
    ...(reportEvents.length
      ? [
          '',
          row(['Detailed care log']),
          row(['Date', 'Time', 'Type', 'Details', 'Notes']),
          ...reportEvents.map(event =>
            row([
              localDate(event.startTime),
              event.startTime.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }),
              careActionByType[event.type].label,
              eventDetails(event),
              event.notes || '',
            ]),
          ),
        ]
      : []),
    '',
    row([
      'Note',
      'For everyday tracking only. This report is not medical advice.',
    ]),
  ].join('\n');
};
