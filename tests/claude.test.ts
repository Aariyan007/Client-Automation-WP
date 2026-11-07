import { describe, it, expect } from 'vitest';
import { buildArgs, parseCliOutput } from '../src/claude.js';

describe('buildArgs', () => {
  it('builds a headless json invocation with tool lists', () => {
    expect(buildArgs({
      prompt: 'do it', cwd: '/x', model: 'haiku', permissionMode: 'acceptEdits',
      allowedTools: ['Read', 'Edit'], disallowedTools: ['Bash(curl:*)'], timeoutMs: 1,
    })).toEqual([
      '-p', 'do it', '--output-format', 'json', '--model', 'haiku',
      '--permission-mode', 'acceptEdits', '--allowedTools', 'Read,Edit',
      '--disallowedTools', 'Bash(curl:*)',
    ]);
  });
  it('omits optional flags when unset', () => {
    expect(buildArgs({ prompt: 'p', cwd: '/x', timeoutMs: 1 })).toEqual(['-p', 'p', '--output-format', 'json']);
  });
});

describe('parseCliOutput', () => {
  it('reads result and is_error', () => {
    expect(parseCliOutput('{"result":"done","is_error":false}')).toEqual({ ok: true, text: 'done' });
    expect(parseCliOutput('{"result":"bad","is_error":true}')).toEqual({ ok: false, text: 'bad' });
  });
  it('treats non-JSON as failure', () => {
    expect(parseCliOutput('segfault')).toEqual({ ok: false, text: 'segfault' });
  });
});
