import { getApp } from '@react-native-firebase/app';
import {
  getFunctions,
  httpsCallable,
} from '@react-native-firebase/functions';
import * as Crypto from 'expo-crypto';
import { MONETIZATION_FUNCTIONS_REGION } from '../config/monetization';
import { ensureAppCheckReady } from './firebase/appCheck';

export const AI_POLICY_VERSION = '2026-09-ai-v3';

export type AiAccessLevel = 'free' | 'premium' | 'legacy';
export type AiResultKind =
  | 'answer'
  | 'summary'
  | 'out_of_scope'
  | 'safety_redirect';

export interface AiUsage {
  accessLevel: AiAccessLevel;
  limit: number;
  used: number;
  remaining: number;
  periodKey: string | null;
}

export interface AiStatus {
  enabled: boolean;
  consented: boolean;
  policyVersion: string;
  usage: AiUsage;
}

export interface AiEvidence {
  factId: string;
  label: string;
  value: string;
}

export interface AiResult {
  kind: AiResultKind;
  title: string;
  text: string;
  evidence: AiEvidence[];
  dataWindow: {
    from: string;
    to: string;
    eventsIncluded: number;
  };
  cached: boolean;
  usage: AiUsage;
}

export type AiGenerationRequest =
  | {
      requestId: string;
      babyId: string;
      mode: 'ask';
      question: string;
      timezone: string;
    }
  | {
      requestId: string;
      babyId: string;
      mode: 'summary';
      period: 'today' | 'last7days';
      timezone: string;
    };

const callableFunctions = getFunctions(
  getApp(),
  MONETIZATION_FUNCTIONS_REGION,
);

const call = async <Request, Response>(name: string, data?: Request) => {
  await ensureAppCheckReady();
  const callable = httpsCallable<Request, Response>(callableFunctions, name);
  const response = await callable(data as Request);
  return response.data;
};

export const getAiStatus = () => call<undefined, AiStatus>('ai_getStatus');

export const updateAiConsent = (accepted: boolean) =>
  call<{ accepted: boolean; policyVersion: string }, AiStatus>(
    'ai_updateConsent',
    { accepted, policyVersion: AI_POLICY_VERSION },
  );

export const generateAiResponse = (request: AiGenerationRequest) =>
  call<AiGenerationRequest, AiResult>('ai_generate', request);

export const createAiRequestId = () => Crypto.randomUUID();

export const deviceTimeZone = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

export const friendlyAiError = (error: unknown) => {
  const message = error instanceof Error ? error.message : '';
  const normalized = message.toLowerCase();
  if (normalized.includes('network') || normalized.includes('unavailable')) {
    return 'The Assistant is unavailable right now. Your care log still works normally.';
  }
  if (normalized.includes('app check')) {
    return 'This development build is not registered for Assistant access.';
  }
  return message.replace(/^\[functions\/[\w-]+\]\s*/, '') ||
    'The Assistant could not respond. Please try again.';
};
