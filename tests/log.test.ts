import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { appendLog } from '../src/log.js';
import { logFile } from '../src/paths.js';
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
});
