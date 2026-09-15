const test = require('node:test');
const assert = require('node:assert/strict');
const {
  sanitiseAppointmentExtraction,
} = require('../lib/appointmentExtraction');

test('normalises bounded appointment fields and ISO date/time', () => {
  assert.deepEqual(
    sanitiseAppointmentExtraction({
      appointmentType: ' Paediatric review ',
      immunization: null,
      provider: 'Dr Nguyen',
      dateTime: '2026-09-03T14:30:00+10:00',
      durationMinutes: 44.6,
      location: 'Children\'s clinic',
      address: '10 Health Street',
      phone: '02 9000 0000',
      reference: 'ABC123',
      weightKg: null,
      heightCm: null,
      headCircumferenceCm: null,
      measuredBy: null,
      notes: 'Bring the referral.',
    }),
    {
      appointmentType: 'Paediatric review',
      immunization: undefined,
      provider: 'Dr Nguyen',
      dateTime: '2026-09-03T04:30:00.000Z',
      durationMinutes: 45,
      location: 'Children\'s clinic',
      address: '10 Health Street',
      phone: '02 9000 0000',
      reference: 'ABC123',
      weightKg: undefined,
      heightCm: undefined,
      headCircumferenceCm: undefined,
      measuredBy: undefined,
      notes: 'Bring the referral.',
    },
  );
});

test('does not preserve invented or invalid appointment values', () => {
  assert.deepEqual(
    sanitiseAppointmentExtraction({
      appointmentType: null,
      immunization: '',
      provider: '',
      dateTime: 'next sometime',
      durationMinutes: -10,
      location: null,
      address: null,
      phone: null,
      reference: null,
      weightKg: null,
      heightCm: null,
      headCircumferenceCm: null,
      measuredBy: null,
      notes: null,
    }),
    {
      appointmentType: undefined,
      immunization: undefined,
      provider: undefined,
      dateTime: undefined,
      durationMinutes: undefined,
      location: undefined,
      address: undefined,
      phone: undefined,
      reference: undefined,
      weightKg: undefined,
      heightCm: undefined,
      headCircumferenceCm: undefined,
      measuredBy: undefined,
      notes: undefined,
    },
  );
});

test('normalises immunisation fields without inventing appointment details', () => {
  assert.deepEqual(
    sanitiseAppointmentExtraction({
      appointmentType: null,
      immunization: ' Influenza vaccine ',
      provider: 'Community Health Clinic',
      dateTime: '2026-08-28T09:15:00+10:00',
      durationMinutes: null,
      location: 'Immunisation room 2',
      address: null,
      phone: null,
      reference: null,
      weightKg: null,
      heightCm: null,
      headCircumferenceCm: null,
      measuredBy: null,
      notes: 'Batch AB123',
    }),
    {
      appointmentType: undefined,
      immunization: 'Influenza vaccine',
      provider: 'Community Health Clinic',
      dateTime: '2026-08-27T23:15:00.000Z',
      durationMinutes: undefined,
      location: 'Immunisation room 2',
      address: undefined,
      phone: undefined,
      reference: undefined,
      weightKg: undefined,
      heightCm: undefined,
      headCircumferenceCm: undefined,
      measuredBy: undefined,
      notes: 'Batch AB123',
    },
  );
});

test('normalises growth measurements and rejects implausible values', () => {
  assert.deepEqual(
    sanitiseAppointmentExtraction({
      appointmentType: null,
      immunization: null,
      provider: null,
      dateTime: '2026-09-02T11:00:00+10:00',
      durationMinutes: null,
      location: null,
      address: null,
      phone: null,
      reference: null,
      weightKg: 7.3456,
      heightCm: 68.2,
      headCircumferenceCm: 43.1,
      measuredBy: ' Child and family health nurse ',
      notes: 'Tracking steadily.',
    }),
    {
      appointmentType: undefined,
      immunization: undefined,
      provider: undefined,
      dateTime: '2026-09-02T01:00:00.000Z',
      durationMinutes: undefined,
      location: undefined,
      address: undefined,
      phone: undefined,
      reference: undefined,
      weightKg: 7.346,
      heightCm: 68.2,
      headCircumferenceCm: 43.1,
      measuredBy: 'Child and family health nurse',
      notes: 'Tracking steadily.',
    },
  );

  assert.equal(
    sanitiseAppointmentExtraction({ weightKg: 1_000 }).weightKg,
    undefined,
  );
});
