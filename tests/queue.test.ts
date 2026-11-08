import { describe, it, expect } from 'vitest';
import { KeyedQueue } from '../src/queue.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('KeyedQueue', () => {
  it('runs jobs for the same key one at a time, in order', async () => {
    const q = new KeyedQueue();
    const log: string[] = [];
    const job = (n: string) => async () => { log.push(`start ${n}`); await sleep(20); log.push(`end ${n}`); };
    await Promise.all([q.run('k', job('1')), q.run('k', job('2'))]);
    expect(log).toEqual(['start 1', 'end 1', 'start 2', 'end 2']);
  });
  it('runs different keys concurrently', async () => {
    const q = new KeyedQueue();
    const log: string[] = [];
    const job = (n: string) => async () => { log.push(`start ${n}`); await sleep(20); log.push(`end ${n}`); };
    await Promise.all([q.run('a', job('a')), q.run('b', job('b'))]);
    expect(log.slice(0, 2).sort()).toEqual(['start a', 'start b']);
  });
  it('a failing job does not block the next, and idle() resolves', async () => {
    const q = new KeyedQueue();
    const bad = q.run('k', async () => { throw new Error('boom'); });
    const good = q.run('k', async () => 'ok');
    await expect(bad).rejects.toThrow('boom');
    await expect(good).resolves.toBe('ok');
    await q.idle();
  });
});
