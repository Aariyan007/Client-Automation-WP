import { describe, it, expect } from 'vitest';
import { StateStore } from '../src/state.js';
import { tmp } from './helpers.js';

describe('StateStore', () => {
  it('remembers seen ids across instances (webhook retries)', () => {
    const f = tmp();
    const a = new StateStore(f);
    expect(a.hasSeen('m1')).toBe(false);
    a.markSeen('m1');
    expect(new StateStore(f).hasSeen('m1')).toBe(true);
  });
  it('keeps only the last 5 history lines', () => {
    const s = new StateStore(tmp());
    for (let i = 1; i <= 7; i++) s.pushHistory(`msg ${i}`);
    expect(s.history()).toEqual(['msg 3', 'msg 4', 'msg 5', 'msg 6', 'msg 7']);
  });
  it('caps seen ids at 1000, dropping the oldest', () => {
    const s = new StateStore(tmp());
    for (let i = 0; i < 1005; i++) s.markSeen(`id${i}`);
    expect(s.hasSeen('id0')).toBe(false);
    expect(s.hasSeen('id1004')).toBe(true);
  });
});
