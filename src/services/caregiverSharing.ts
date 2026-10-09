import { getApp } from '@react-native-firebase/app';
import firestore from '@react-native-firebase/firestore';
import {
  getFunctions,
  httpsCallable,
} from '@react-native-firebase/functions';
import { MONETIZATION_FUNCTIONS_REGION } from '../config/monetization';
import { ensureAppCheckReady } from './firebase/appCheck';

export interface BabyInvite {
  code: string;
  babyName: string;
  expiresAtMillis: number;
}

export interface JoinedBaby {
  babyId: string;
  babyName: string;
  alreadyMember: boolean;
}

export interface Caregiver {
  id: string;
  displayName: string;
  email: string;
}

const callableFunctions = getFunctions(
  getApp(),
  MONETIZATION_FUNCTIONS_REGION,
);

const call = async <Request, Response>(name: string, data: Request) => {
  await ensureAppCheckReady();
  const callable = httpsCallable<Request, Response>(callableFunctions, name);
  const response = await callable(data);
  return response.data;
};

export const createBabyInvite = (babyId: string) =>
  call<{ babyId: string }, BabyInvite>('sharing_createInvite', { babyId });

export const revokeBabyInvite = (code: string) =>
  call<{ code: string }, { revoked: boolean }>('sharing_revokeInvite', { code });

export const acceptBabyInvite = (code: string) =>
  call<{ code: string }, JoinedBaby>('sharing_acceptInvite', { code });

/** Omit caregiverId to leave the profile yourself. */
export const removeBabyCaregiver = (babyId: string, caregiverId?: string) =>
  call<{ babyId: string; caregiverId?: string }, { removed: boolean }>(
    'sharing_removeCaregiver',
    { babyId, caregiverId },
  );

/** Shown as "K7QM-3XPD" so it is easier to read out or retype. */
export const formatInviteCode = (code: string) =>
  code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;

export const inviteShareMessage = (invite: BabyInvite) =>
  [
    `Join me in tracking ${invite.babyName} on PitterPatter.`,
    '',
    `1. Install PitterPatter and sign in.`,
    `2. Choose "Join with an invite code" and enter: ${formatInviteCode(invite.code)}`,
    '',
    `Or open: babysteps://join-baby?code=${invite.code}`,
    '',
    `The code works once and expires on ${new Date(
      invite.expiresAtMillis,
    ).toLocaleDateString([], { day: 'numeric', month: 'long' })}.`,
  ].join('\n');

export const subscribeToCaregivers = (
  babyId: string,
  callback: (caregivers: Caregiver[]) => void,
  onError?: (error: Error) => void,
) =>
  firestore()
    .collection('babies')
    .doc(babyId)
    .collection('caregivers')
    .onSnapshot(
      snapshot =>
        callback(
          snapshot.docs.map(document => ({
            id: document.id,
            displayName: document.data().displayName || '',
            email: document.data().email || '',
          })),
        ),
      error => onError?.(error),
    );

export const friendlySharingError = (error: unknown) => {
  const message = error instanceof Error ? error.message : '';
  if (/network|unavailable/i.test(message)) {
    return 'Sharing is unavailable right now. Check your connection and try again.';
  }
  if (/app check/i.test(message)) {
    return 'This development build is not registered for sharing.';
  }
  return (
    message.replace(/^\[functions\/[\w-]+\]\s*/, '') ||
    'Something went wrong. Please try again.'
  );
};
