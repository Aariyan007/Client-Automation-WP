import { describe, it, expect } from 'vitest';
import { notifyCommand } from '../src/notify.js';

describe('notifyCommand', () => {
  it('darwin: inserts -- before body and title, body starting with - stays positional', () => {
    const body = '-e return "X"';
    const r = notifyCommand('Title', body, 'darwin');
    expect(r?.cmd).toBe('osascript');
    const args = r!.args;
    const dash = args.indexOf('--');
    expect(dash).toBeGreaterThan(-1);
    expect(dash).toBeLessThan(args.indexOf(body));
    expect(args.indexOf(body)).toBeGreaterThan(dash);
    expect(args.indexOf('Title')).toBeGreaterThan(dash);
    expect(args.slice(0, dash).includes(body)).toBe(false);
  });

  it('linux: inserts -- before title and body', () => {
    const body = '-l JavaScript';
    const r = notifyCommand('Title', body, 'linux');
    expect(r?.cmd).toBe('notify-send');
    const args = r!.args;
    const dash = args.indexOf('--');
    expect(dash).toBe(0);
    expect(args.indexOf('Title')).toBeGreaterThan(dash);
    expect(args.indexOf(body)).toBeGreaterThan(dash);
  });

  it('truncates body to 200 chars', () => {
    const body = 'x'.repeat(300);
    const darwin = notifyCommand('T', body, 'darwin')!.args;
    const linux = notifyCommand('T', body, 'linux')!.args;
    expect(darwin.find((a) => a.startsWith('x'))!.length).toBe(200);
    expect(linux.find((a) => a.startsWith('x'))!.length).toBe(200);
  });

  it('returns null for unsupported platforms', () => {
    expect(notifyCommand('T', 'b', 'win32')).toBeNull();
  });
});
