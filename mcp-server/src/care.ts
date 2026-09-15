import { z } from 'zod';
import { createHash } from 'node:crypto';
import { Timestamp, type Firestore } from 'firebase-admin/firestore';

export const idSchema = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const common = { startTime: z.string().datetime({ offset: true }), notes: z.string().trim().max(2000).optional() };
export const eventSchema = z.union([
  z.object({ ...common, type: z.literal('feed'), feedType: z.literal('bottle'),
    amount: z.number().positive().max(2000), unit: z.enum(['ml', 'oz']),
    durationMinutes: z.number().min(0).max(180).optional() }).strict(),
  z.object({ ...common, type: z.literal('feed'), feedType: z.literal('breast'),
    breastSide: z.enum(['left', 'right']), durationMinutes: z.number().positive().max(180) }).strict(),
  z.object({ ...common, type: z.literal('sleep'), durationMinutes: z.number().positive().max(1080),
    sleepType: z.enum(['nap', 'contactNap', 'night']).optional() }).strict(),
  z.object({ ...common, type: z.literal('diaper'), diaperCondition: z.enum(['wet', 'dirty', 'both']),
    diaperAmount: z.enum(['light', 'medium', 'heavy']).optional() }).strict(),
  z.object({ ...common, type: z.literal('pumping'), amount: z.number().positive().max(2000),
    unit: z.enum(['ml', 'oz']), durationMinutes: z.number().positive().max(180).optional() }).strict(),
  z.object({ ...common, type: z.enum(['tummyTime', 'bath']),
    durationMinutes: z.number().positive().max(180).optional() }).strict(),
]);
export type CareInput = z.infer<typeof eventSchema>;
export interface BabyRecord { id: string; name: string; dateOfBirth: string | null }
export interface EventRecord {
  id: string; type: string; startTime: string; endTime: string | null;
  durationMinutes?: number; notes?: string; metadata: Record<string, unknown>;
}
export interface QueryInput { babyId: string; from?: string; to?: string; limit: number; cursor?: string }
export interface CareRepository {
  listBabies(uid: string): Promise<BabyRecord[]>;
  queryEvents(uid: string, input: QueryInput): Promise<{ events: EventRecord[]; nextCursor: string | null }>;
  logEvent(uid: string, babyId: string, requestId: string, event: CareInput): Promise<{ eventId: string; duplicate: boolean }>;
}
export class CareError extends Error {}
const iso = (value: any): string | null => value?.toDate?.().toISOString() ?? null;
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  return JSON.stringify(value);
}
export function normalizeEvent(raw: unknown, uid: string, now = Date.now()) {
  const event = eventSchema.parse(raw);
  const duration = 'durationMinutes' in event ? event.durationMinutes : undefined;
  const start = Date.parse(event.startTime), end = start + (duration ?? 0) * 60_000;
  if (start < 0 || end > now + 5 * 60_000) throw new CareError('Completed activities must finish in the past. Check the time and timezone.');
  const metadata: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(event)) {
    if (!['type', 'startTime', 'durationMinutes', 'notes'].includes(name)) metadata[name] = value;
  }
  if (event.type === 'feed' && event.feedType === 'breast') {
    metadata.breastSidesUsed = [event.breastSide];
    metadata.lastBreastSide = event.breastSide;
    metadata.leftBreastDurationSeconds = event.breastSide === 'left' ? event.durationMinutes * 60 : 0;
    metadata.rightBreastDurationSeconds = event.breastSide === 'right' ? event.durationMinutes * 60 : 0;
  }
  return { type: event.type, startTime: Timestamp.fromMillis(start), endTime: Timestamp.fromMillis(end),
    ...(duration !== undefined ? { durationMinutes: duration } : {}),
    ...(event.notes ? { notes: event.notes } : {}), metadata,
    source: 'assistant', loggedBy: uid, createdAt: Timestamp.fromMillis(now),
    updatedAt: Timestamp.fromMillis(now), deletedAt: null };
}
export class FirestoreCareRepository implements CareRepository {
  constructor(private db: Firestore) {}
  private authorized(data: any, uid: string) {
    if (!data || !Array.isArray(data.authorizedCaregivers) || !data.authorizedCaregivers.includes(uid)
      || data.info?.isActive === false) throw new CareError('This baby is not available to your account.');
  }
  async listBabies(uid: string) {
    const result = await this.db.collection('babies').where('authorizedCaregivers', 'array-contains', uid).get();
    return result.docs.filter(doc => doc.data().info?.isActive !== false).map(doc => ({
      id: doc.id, name: String(doc.data().info?.name || 'Baby'), dateOfBirth: iso(doc.data().info?.dateOfBirth),
    })).sort((a, b) => a.name.localeCompare(b.name));
  }
  async queryEvents(uid: string, input: QueryInput) {
    const baby = this.db.collection('babies').doc(idSchema.parse(input.babyId));
    this.authorized((await baby.get()).data(), uid);
    if (input.from && input.to && Date.parse(input.from) >= Date.parse(input.to)) throw new CareError('The start must be before the end of the date range.');
    let query = baby.collection('events').orderBy('startTime', 'desc').orderBy('__name__', 'desc');
    if (input.from) query = query.where('startTime', '>=', Timestamp.fromDate(new Date(input.from)));
    if (input.to) query = query.where('startTime', '<', Timestamp.fromDate(new Date(input.to)));
    if (input.cursor) {
      const doc = await baby.collection('events').doc(idSchema.parse(input.cursor)).get();
      if (!doc.exists) throw new CareError('The page cursor is no longer available. Start the query again.');
      query = query.startAfter(doc);
    }
    // Bound each page even when it contains deleted records. Return its cursor so
    // clients can continue instead of implying that filtered pages are complete.
    const result = await query.limit(input.limit).get();
    this.authorized((await baby.get()).data(), uid);
    const events = result.docs.filter(doc => !doc.data().deletedAt).map(doc => {
      const data = doc.data();
      return { id: doc.id, type: data.type, startTime: iso(data.startTime)!, endTime: iso(data.endTime),
        ...(typeof data.durationMinutes === 'number' ? { durationMinutes: data.durationMinutes } : {}),
        ...(typeof data.notes === 'string' ? { notes: data.notes } : {}), metadata: data.metadata || {} };
    });
    return { events, nextCursor: result.size === input.limit ? result.docs.at(-1)!.id : null };
  }
  async logEvent(uid: string, babyId: string, requestId: string, raw: CareInput) {
    const event = eventSchema.parse(raw);
    const data = normalizeEvent(event, uid);
    const baby = this.db.collection('babies').doc(idSchema.parse(babyId));
    const marker = this.db.collection('mcpEventRequests').doc(digest(`${uid}:${babyId}:${requestId}`));
    const eventRef = baby.collection('events').doc(`mcp_${digest(`${uid}:${requestId}`)}`);
    const fingerprint = digest(canonical(event));
    return this.db.runTransaction(async tx => {
      const babyDoc = await tx.get(baby), previous = await tx.get(marker);
      this.authorized(babyDoc.data(), uid);
      if (previous.exists) {
        if (previous.data()!.fingerprint !== fingerprint) throw new CareError('That request ID was already used for a different activity.');
        return { eventId: previous.data()!.eventId as string, duplicate: true };
      }
      tx.create(eventRef, data);
      tx.create(marker, { fingerprint, eventId: eventRef.id, createdAt: data.createdAt });
      return { eventId: eventRef.id, duplicate: false };
    });
  }
}
