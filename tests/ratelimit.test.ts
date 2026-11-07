import { describe, it, expect } from 'vitest';
import { RateLimiter } from '../src/ratelimit.js';

describe('RateLimiter', () => {
  it('allows max jobs per window per key, then blocks', () => {
    let t = 0;
    const rl = new RateLimiter(1000, () => t);
    expect(rl.tryAcquire('a', 2)).toBe(true);
    expect(rl.tryAcquire('a', 2)).toBe(true);
    expect(rl.tryAcquire('a', 2)).toBe(false);
    expect(rl.tryAcquire('b', 2)).toBe(true);
  });
  it('frees capacity after the window passes', () => {
    let t = 0;
    const rl = new RateLimiter(1000, () => t);
    rl.tryAcquire('a', 1);
    expect(rl.tryAcquire('a', 1)).toBe(false);
    t = 1001;
    expect(rl.tryAcquire('a', 1)).toBe(true);
  });
});
