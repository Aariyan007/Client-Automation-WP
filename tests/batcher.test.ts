import { describe, it, expect, vi, afterEach } from 'vitest';
import { Batcher } from '../src/batcher.js';

afterEach(() => vi.useRealTimers());

describe('Batcher', () => {
  it('merges messages pushed within the quiet period into one flush', () => {
    vi.useFakeTimers();
    const out: [string, string[]][] = [];
    const b = new Batcher(30_000, (k, t) => out.push([k, t]));
    b.push('p', 'one'); vi.advanceTimersByTime(20_000);
    b.push('p', 'two'); vi.advanceTimersByTime(20_000);
    expect(out).toEqual([]);
    vi.advanceTimersByTime(10_001);
    expect(out).toEqual([['p', ['one', 'two']]]);
  });
  it('keeps keys independent and flushAll empties everything', () => {
    vi.useFakeTimers();
    const out: string[] = [];
    const b = new Batcher(30_000, (k) => out.push(k));
    b.push('a', 'x'); b.push('b', 'y');
    b.flushAll();
    expect(out.sort()).toEqual(['a', 'b']);
    vi.advanceTimersByTime(60_000);
    expect(out).toHaveLength(2);
  });
});
