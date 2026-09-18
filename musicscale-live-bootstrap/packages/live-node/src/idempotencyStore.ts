export class IdempotencyStore<T> {
  private readonly values = new Map<string, { value: T; expiresAt: number }>();

  constructor(private readonly ttlMs = 10 * 60 * 1000, private readonly maxEntries = 1000) {}

  get(key: string): T | undefined {
    const entry = this.values.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.values.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T): void {
    this.sweep();
    if (this.values.size >= this.maxEntries) {
      const oldest = this.values.keys().next().value as string | undefined;
      if (oldest) this.values.delete(oldest);
    }
    this.values.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  private sweep(): void {
    const now = Date.now();
    for (const [key, entry] of this.values) {
      if (entry.expiresAt <= now) this.values.delete(key);
    }
  }
}
