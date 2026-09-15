import { describe, expect, it } from 'vitest';
import {
  buildCareDataJson,
  buildCareStatsCsv,
} from '../../src/utils/statsExport';

describe('buildCareStatsCsv', () => {
  it('exports dated daily rows, totals and sleep in minutes and hours', () => {
    const report = buildCareStatsCsv({
      babyName: 'Ada "Bean"',
      days: [
        {
          date: new Date(2026, 6, 29),
          feeds: 7,
          diapers: 5,
          sleepMinutes: 630,
        },
        {
          date: new Date(2026, 6, 30),
          feeds: 8,
          diapers: 6,
          sleepMinutes: 660,
        },
      ],
    });

    expect(report).toContain('"Baby","Ada ""Bean"""');
    expect(report).toContain('"Period","2026-07-29 to 2026-07-30"');
    expect(report).toContain(
      '"2026-07-29","Wednesday","7","5","630","10.50"',
    );
    expect(report).toContain('"TOTAL","","15","11","1290","21.50"');
    expect(report).toContain('This report is not medical advice.');
  });

  it('handles an empty report period', () => {
    const report = buildCareStatsCsv({ babyName: 'Baby', days: [] });

    expect(report).toContain('"Period","No dates available"');
    expect(report).toContain('"TOTAL","","0","0","0","0.00"');
  });

  it('includes additional care records in the detailed log', () => {
    const report = buildCareStatsCsv({
      babyName: 'Ada',
      days: [{ date: new Date(2026, 7, 11), feeds: 0, diapers: 0, sleepMinutes: 0 }],
      events: [{
        type: 'temperature',
        startTime: new Date(2026, 7, 11, 8, 30),
        endTime: new Date(2026, 7, 11, 8, 30),
        source: 'app',
        loggedBy: 'caregiver',
        metadata: { temperature: 37.4, temperatureUnit: 'C', temperatureMethod: 'ear' },
      }],
    });

    expect(report).toContain('"Detailed care log"');
    expect(report).toContain('"Temperature"');
    expect(report).toContain('37.4');
    expect(report).toContain('ear');
  });

  it('exports structured appointment location and booking details', () => {
    const report = buildCareStatsCsv({
      babyName: 'Ada',
      days: [{ date: new Date(2026, 7, 30), feeds: 0, diapers: 0, sleepMinutes: 0 }],
      events: [{
        type: 'appointment',
        startTime: new Date(2026, 7, 30, 14, 15),
        endTime: new Date(2026, 7, 30, 15, 0),
        durationMinutes: 45,
        source: 'app',
        loggedBy: 'caregiver',
        metadata: {
          appointmentType: 'Paediatric review',
          provider: 'Dr Nguyen',
          appointmentLocation: 'Children\'s clinic',
          appointmentAddress: '10 Health Street',
          appointmentPhone: '02 9000 0000',
          appointmentReference: 'ABC123',
        },
      }],
    });

    expect(report).toContain('Children\'s clinic');
    expect(report).toContain('10 Health Street');
    expect(report).toContain('reference ABC123');
  });

  it('exports the immunisation provider and optional location', () => {
    const report = buildCareStatsCsv({
      babyName: 'Ada',
      days: [{ date: new Date(2026, 7, 28), feeds: 0, diapers: 0, sleepMinutes: 0 }],
      events: [{
        type: 'immunization',
        startTime: new Date(2026, 7, 28, 9, 15),
        endTime: new Date(2026, 7, 28, 9, 15),
        source: 'app',
        loggedBy: 'caregiver',
        metadata: {
          immunization: 'Influenza vaccine',
          provider: 'Community Health Clinic',
          immunizationLocation: 'Immunisation room 2',
        },
      }],
    });

    expect(report).toContain('Influenza vaccine');
    expect(report).toContain('Community Health Clinic');
    expect(report).toContain('Immunisation room 2');
  });
});

describe('buildCareDataJson', () => {
  it('exports structured AI-ready events without internal identifiers', () => {
    const report = buildCareDataJson({
      babyName: 'Ada',
      days: [
        {
          date: new Date(2026, 6, 30),
          feeds: 1,
          diapers: 0,
          sleepMinutes: 0,
        },
      ],
      events: [
        {
          id: 'internal-event-id',
          type: 'feed',
          startTime: new Date(2026, 6, 30, 9, 15),
          endTime: new Date(2026, 6, 30, 9, 35),
          source: 'app',
          loggedBy: 'internal-caregiver-id',
          notes: 'Settled well',
          metadata: {
            feedType: 'bottle',
            amount: 120,
            unit: 'ml',
          },
        },
      ],
    });
    const data = JSON.parse(report);

    expect(data.schema).toBe('pitterpatter-care-export/v1');
    expect(data.summary.totals).toEqual({
      feeds: 1,
      nappies: 0,
      sleepMinutes: 0,
    });
    expect(data.events[0]).toMatchObject({
      type: 'feed',
      label: 'Feed',
      durationMinutes: 20,
      notes: 'Settled well',
      metadata: { feedType: 'bottle', amount: 120, unit: 'ml' },
    });
    expect(report).not.toContain('internal-event-id');
    expect(report).not.toContain('internal-caregiver-id');
  });

  it('only includes events inside the exported date range', () => {
    const report = buildCareDataJson({
      babyName: 'Ada',
      days: [
        {
          date: new Date(2026, 6, 30),
          feeds: 0,
          diapers: 0,
          sleepMinutes: 0,
        },
      ],
      events: [
        {
          type: 'sleep',
          startTime: new Date(2026, 6, 29, 20, 0),
          endTime: new Date(2026, 6, 29, 21, 0),
          source: 'app',
          loggedBy: 'caregiver',
          metadata: {},
        },
      ],
    });

    expect(JSON.parse(report).events).toEqual([]);
  });
});
