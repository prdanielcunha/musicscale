import { describe, expect, it } from 'vitest';
import { IdempotencyStore } from '../src/idempotencyStore';

describe('IdempotencyStore', () => {
  it('returns the previously stored result for the same key', () => {
    const store = new IdempotencyStore<number>(10_000);
    store.set('same-command', 42);
    expect(store.get('same-command')).toBe(42);
  });

  it('does not confuse independent keys', () => {
    const store = new IdempotencyStore<number>(10_000);
    store.set('a', 1);
    store.set('b', 2);
    expect(store.get('a')).toBe(1);
    expect(store.get('b')).toBe(2);
  });
});
