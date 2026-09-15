export class MemoryStore {
  data = new Map();
  tail = Promise.resolve();
  async get(key) { return structuredClone(this.data.get(key)); }
  async set(key, value) { this.data.set(key, structuredClone(value)); }
  async run(fn) {
    const previous = this.tail;
    let release;
    this.tail = new Promise(resolve => { release = resolve; });
    await previous;
    const writes = new Map();
    try {
      const result = await fn({ get: key => this.get(key),
        set: (key, value) => writes.set(key, structuredClone(value)), delete: key => writes.set(key, undefined) });
      for (const [key, value] of writes) {
        if (value === undefined) this.data.delete(key); else this.data.set(key, value);
      }
      return result;
    } finally { release(); }
  }
}
