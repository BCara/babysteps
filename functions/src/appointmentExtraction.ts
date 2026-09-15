import * as admin from 'firebase-admin';
import { defineSecret, defineString } from 'firebase-functions/params';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import OpenAI from 'openai';
import { AI_POLICY_VERSION } from './aiAssistantCore';

const REGION = 'australia-southeast1';
const MAX_TEXT_LENGTH = 20_000;
const MAX_IMAGE_DATA_URL_LENGTH = 7_000_000;
const openAiApiKey = defineSecret('OPENAI_API_KEY');
const appointmentModel = defineString('OPENAI_APPOINTMENT_MODEL', {
  default: 'gpt-5.6-terra',
});
type HealthRecordType = 'appointment' | 'immunization' | 'growth';

const responseSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'appointmentType',
    'immunization',
    'provider',
    'dateTime',
    'durationMinutes',
    'location',
    'address',
    'phone',
    'reference',
    'weightKg',
    'heightCm',
    'headCircumferenceCm',
    'measuredBy',
    'notes',
  ],
  properties: {
    appointmentType: { type: ['string', 'null'] },
    immunization: { type: ['string', 'null'] },
    provider: { type: ['string', 'null'] },
    dateTime: { type: ['string', 'null'] },
    durationMinutes: { type: ['number', 'null'] },
    location: { type: ['string', 'null'] },
    address: { type: ['string', 'null'] },
    phone: { type: ['string', 'null'] },
    reference: { type: ['string', 'null'] },
    weightKg: { type: ['number', 'null'] },
    heightCm: { type: ['number', 'null'] },
    headCircumferenceCm: { type: ['number', 'null'] },
    measuredBy: { type: ['string', 'null'] },
    notes: { type: ['string', 'null'] },
  },
} as const;

const optionalString = (value: unknown, maximum = 500) =>
  typeof value === 'string' && value.trim()
    ? value.trim().slice(0, maximum)
    : undefined;

const boundedMeasurement = (value: unknown, minimum: number, maximum: number) =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  value >= minimum &&
  value <= maximum
    ? Math.round(value * 1_000) / 1_000
    : undefined;

export const sanitiseAppointmentExtraction = (value: unknown) => {
  if (!value || typeof value !== 'object') {
    throw new HttpsError('internal', 'The extracted record was invalid.');
  }
  const result = value as Record<string, unknown>;
  const parsedDate = optionalString(result.dateTime, 100);
  const duration = typeof result.durationMinutes === 'number' &&
    Number.isFinite(result.durationMinutes) &&
    result.durationMinutes > 0 &&
    result.durationMinutes <= 24 * 60
      ? Math.round(result.durationMinutes)
      : undefined;
  return {
    appointmentType: optionalString(result.appointmentType),
    immunization: optionalString(result.immunization),
    provider: optionalString(result.provider),
    dateTime: parsedDate && !Number.isNaN(Date.parse(parsedDate))
      ? new Date(parsedDate).toISOString()
      : undefined,
    durationMinutes: duration,
    location: optionalString(result.location),
    address: optionalString(result.address),
    phone: optionalString(result.phone, 100),
    reference: optionalString(result.reference, 150),
    weightKg: boundedMeasurement(result.weightKg, 0.05, 100),
    heightCm: boundedMeasurement(result.heightCm, 10, 250),
    headCircumferenceCm: boundedMeasurement(result.headCircumferenceCm, 10, 100),
    measuredBy: optionalString(result.measuredBy),
    notes: optionalString(result.notes, 2_000),
  };
};

export const extract = onCall(
  {
    region: REGION,
    enforceAppCheck: true,
    secrets: [openAiApiKey],
    timeoutSeconds: 30,
    memory: '512MiB',
  },
  async request => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Sign in to import an appointment.');
    }
    const consent = await admin.firestore()
      .collection('aiConsents')
      .doc(request.auth.uid)
      .get();
    if (
      consent.data()?.accepted !== true ||
      consent.data()?.policyVersion !== AI_POLICY_VERSION
    ) {
      throw new HttpsError(
        'failed-precondition',
        'Review and accept the current optional AI processing notice first.',
      );
    }

    const recordType: HealthRecordType = request.data?.recordType === 'immunization'
      ? 'immunization'
      : request.data?.recordType === 'growth'
        ? 'growth'
        : 'appointment';
    const recordLabel = recordType === 'immunization'
      ? 'immunisation'
      : recordType === 'growth'
        ? 'growth record'
        : 'appointment';
    const text = optionalString(request.data?.text, MAX_TEXT_LENGTH);
    const imageDataUrl = optionalString(
      request.data?.imageDataUrl,
      MAX_IMAGE_DATA_URL_LENGTH,
    );
    const timezone = optionalString(request.data?.timezone, 100) || 'UTC';
    const locale = optionalString(request.data?.locale, 50) || 'en-AU';
    if (!text && !imageDataUrl) {
      throw new HttpsError(
        'invalid-argument',
        `Add ${recordLabel} text or an image to interpret.`,
      );
    }
    if (request.data?.text?.length > MAX_TEXT_LENGTH) {
      throw new HttpsError('invalid-argument', 'The pasted text is too long.');
    }
    if (
      imageDataUrl &&
      (!/^data:image\/(jpeg|png|webp);base64,/i.test(imageDataUrl) ||
        imageDataUrl.length > MAX_IMAGE_DATA_URL_LENGTH)
    ) {
      throw new HttpsError(
        'resource-exhausted',
        `The ${recordLabel} image is too large or unsupported.`,
      );
    }

    const instructions = [
      `Extract ${recordLabel} details from the supplied source.`,
      `The user's timezone is ${timezone} and locale is ${locale}.`,
      `The current instant is ${new Date().toISOString()}.`,
      recordType === 'immunization'
        ? 'Return when the immunisation was administered as an ISO 8601 timestamp with an offset.'
        : recordType === 'growth'
          ? 'Return the measurement date and time as an ISO 8601 timestamp with an offset. If only a date is present, use 12:00 local time.'
          : 'Return the scheduled start as an ISO 8601 timestamp with an offset.',
      'Do not invent missing details. Use null for anything not clearly present.',
      recordType === 'immunization'
        ? 'immunization is the vaccine or immunisation name exactly as supported by the source; appointmentType must be null. Provider is the clinician or clinic, and location is the clinic, department, building, room, or address where it was given.'
        : recordType === 'growth'
          ? 'For a growth record, appointmentType, immunization, provider, durationMinutes, location, address, phone, and reference must be null. Convert weight to kilograms and length, height, and head circumference to centimetres. measuredBy is the clinician, clinic, service, or caregiver who took the measurements. Only return a measurement when its label or surrounding context makes its meaning clear.'
          : 'appointmentType is the purpose or specialty; immunization must be null. Provider is the clinician or clinic name, location is a department/building/room, and address is the street address.',
      recordType === 'immunization'
        ? 'Put clearly stated dose, brand, batch or lot details and other useful source details in notes.'
        : recordType === 'growth'
          ? 'Put clearly stated growth-related comments in notes. Do not copy the extracted measurements into notes.'
          : 'Put preparation instructions, arrival guidance, and other useful source details in notes.',
      'Do not include patient identifiers, Medicare numbers, or unrelated sensitive information in notes.',
    ].join(' ');
    const content: Array<Record<string, unknown>> = [
      {
        type: 'input_text',
        text: text
          ? `${instructions}\n\nPasted ${recordLabel} text:\n${text}`
          : instructions,
      },
    ];
    if (imageDataUrl) {
      content.push({
        type: 'input_image',
        image_url: imageDataUrl,
        detail: 'high',
      });
    }

    const client = new OpenAI({
      apiKey: openAiApiKey.value(),
      timeout: 20_000,
      maxRetries: 0,
    });
    try {
      const response = await client.responses.create({
        model: appointmentModel.value(),
        input: [{ role: 'user', content }] as never,
        max_output_tokens: 800,
        reasoning: { effort: 'none' },
        safety_identifier: request.auth.uid.slice(0, 64),
        store: false,
        text: {
          format: {
            type: 'json_schema',
            name: 'pitterpatter_appointment_extraction',
            strict: true,
            schema: responseSchema,
          },
        },
      });
      return sanitiseAppointmentExtraction(JSON.parse(response.output_text));
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      console.error('Health record extraction failed', {
        uid: request.auth.uid,
        recordType,
        hasImage: Boolean(imageDataUrl),
        hasText: Boolean(text),
        error: error instanceof Error ? error.message : String(error),
      });
      throw new HttpsError(
        'unavailable',
        `${recordLabel[0].toUpperCase()}${recordLabel.slice(1)} interpretation is unavailable right now.`,
      );
    }
  },
);
