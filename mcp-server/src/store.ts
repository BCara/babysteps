import type { Firestore } from 'firebase-admin/firestore';

export type RecordData = Record<string, any>;
export interface Transaction {
  get(key: string): Promise<RecordData | undefined>;
  set(key: string, value: RecordData): void;
  delete(key: string): void;
}
export interface Store {
  get(key: string): Promise<RecordData | undefined>;
  set(key: string, value: RecordData): Promise<void>;
  run<T>(fn: (tx: Transaction) => Promise<T>): Promise<T>;
}

export class FirestoreStore implements Store {
  constructor(private db: Firestore) {}
  private ref(key: string) { return this.db.collection('mcpOAuth').doc(key); }
  async get(key: string) { return (await this.ref(key).get()).data(); }
  async set(key: string, value: RecordData) { await this.ref(key).set(value); }
  run<T>(fn: (tx: Transaction) => Promise<T>) {
    return this.db.runTransaction(tx => fn({
      get: async key => (await tx.get(this.ref(key))).data(),
      set: (key, value) => { tx.set(this.ref(key), value); },
      delete: key => { tx.delete(this.ref(key)); },
    }));
  }
}
