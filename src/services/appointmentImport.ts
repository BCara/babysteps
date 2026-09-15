import { getApp } from '@react-native-firebase/app';
import { getFunctions, httpsCallable } from '@react-native-firebase/functions';
import { MONETIZATION_FUNCTIONS_REGION } from '../config/monetization';
import { ensureAppCheckReady } from './firebase/appCheck';

export type HealthRecordImportType = 'appointment' | 'immunization' | 'growth';

export interface HealthRecordExtraction {
  appointmentType?: string;
  immunization?: string;
  provider?: string;
  dateTime?: string;
  durationMinutes?: number;
  location?: string;
  address?: string;
  phone?: string;
  reference?: string;
  weightKg?: number;
  heightCm?: number;
  headCircumferenceCm?: number;
  measuredBy?: string;
  notes?: string;
}

interface HealthRecordExtractionRequest {
  recordType: HealthRecordImportType;
  text?: string;
  imageDataUrl?: string;
  timezone: string;
  locale: string;
}

const callableFunctions = getFunctions(
  getApp(),
  MONETIZATION_FUNCTIONS_REGION,
);

export const extractHealthRecordDetails = async (
  request: HealthRecordExtractionRequest,
) => {
  await ensureAppCheckReady();
  const callable = httpsCallable<
    HealthRecordExtractionRequest,
    HealthRecordExtraction
  >(callableFunctions, 'appointments_extract');
  const response = await callable(request);
  return response.data;
};

export const friendlyHealthRecordImportError = (
  error: unknown,
  recordLabel = 'health record',
) => {
  const message = error instanceof Error ? error.message : '';
  if (/app check/i.test(message)) {
    return `This development build is not registered for ${recordLabel} scanning.`;
  }
  if (/resource-exhausted/i.test(message)) {
    return `That image is too large. Try taking a closer photo of the ${recordLabel} details.`;
  }
  return message.replace(/^\[functions\/[\w-]+\]\s*/, '') ||
    `The ${recordLabel} details could not be interpreted. You can still enter them manually.`;
};
