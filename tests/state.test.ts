import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { StateStore } from '../src/state.js';
import { stateFile } from '../src/paths.js';
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
  it('a stale instance does not erase ids marked by another instance', () => {
    const f = tmp();
    const x = new StateStore(f);
    const y = new StateStore(f);
    y.markSeen('a');
    x.pushHistory('h');
    const fresh = new StateStore(f);
    expect(fresh.hasSeen('a')).toBe(true);
    expect(fresh.history()).toContain('h');
  });
  it('a stale instance does not erase history pushed by another instance', () => {
    const f = tmp();
    const x = new StateStore(f);
    const y = new StateStore(f);
    y.pushHistory('h1');
    x.markSeen('b');
    const fresh = new StateStore(f);
    expect(fresh.history()).toEqual(['h1']);
    expect(fresh.hasSeen('b')).toBe(true);
  });
  it('treats a state file with the wrong shape as empty and can still write', () => {
    const f = tmp();
    fs.mkdirSync(path.dirname(stateFile(f)), { recursive: true });
    fs.writeFileSync(stateFile(f), '{"seen":"abc"}');
    const s = new StateStore(f);
    expect(s.hasSeen('a')).toBe(false);
    expect(s.history()).toEqual([]);
    expect(() => s.markSeen('a')).not.toThrow();
    expect(() => s.pushHistory('h')).not.toThrow();
    expect(new StateStore(f).hasSeen('a')).toBe(true);
    fs.writeFileSync(stateFile(f), '{"seen":[1,2],"history":["ok"]}');
    const partial = new StateStore(f);
    expect(partial.hasSeen('1')).toBe(false);
    expect(partial.history()).toEqual(['ok']);
  });
  it('writes atomically and leaves no temp files behind', () => {
    const f = tmp();
    const s = new StateStore(f);
    s.markSeen('a');
    s.pushHistory('h');
    expect(fs.readdirSync(path.dirname(stateFile(f)))).toEqual(['state.json']);
  });
});
