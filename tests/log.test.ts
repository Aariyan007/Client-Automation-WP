import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { appendLog } from '../src/log.js';
import { logFile } from '../src/paths.js';
import path from 'node:path';
import { tmp } from './helpers.js';

describe('appendLog', () => {
  it('appends timestamped entries with quoted single-line messages', () => {
    const f = tmp();
    appendLog(f, 'pushed', 'abc123 make logo bigger', ['make the\nlogo bigger']);
    appendLog(f, 'ignored-chat', '');
    const text = fs.readFileSync(logFile(f), 'utf8');
    expect(text).toMatch(/^- \d{4}-\d\d-\d\dT[\d:.]+Z \*\*pushed\*\* abc123 make logo bigger\n  > make the logo bigger\n/);
    expect(text).toContain('**ignored-chat**');
  });
  it('does nothing when the project folder itself no longer exists', () => {
    const f = path.join(tmp(), 'gone');
    expect(() => appendLog(f, 'error', 'x', ['y'])).not.toThrow();
    expect(fs.existsSync(f)).toBe(false);
  });
  it('creates the log file with mode 0600 (it holds third-party messages)', () => {
    const f = tmp();
    appendLog(f, 'pushed', 'x', ['hello']);
    expect(fs.statSync(logFile(f)).mode & 0o777).toBe(0o600);
  });
});
