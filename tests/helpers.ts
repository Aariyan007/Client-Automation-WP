import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { ClaudeRunner, RunOptions, RunResult } from '../src/claude.js';

export function tmp(prefix = 'ca-'): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

export function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

export function makeRepo(): { dir: string; remote: string } {
  const remote = tmp('ca-remote-');
  git(remote, 'init', '--bare', '-b', 'main');
  const dir = tmp('ca-repo-');
  git(dir, 'init', '-b', 'main');
  git(dir, 'config', 'user.email', 't@t.dev');
  git(dir, 'config', 'user.name', 'T');
  fs.writeFileSync(path.join(dir, 'index.html'), '<h1>Hello</h1>\n');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-m', 'init');
  git(dir, 'remote', 'add', 'origin', remote);
  git(dir, 'push', '-u', 'origin', 'main');
  return { dir, remote };
}

export const remoteHead = (remote: string, branch = 'main') => git(remote, 'rev-parse', branch);
export const remoteSubject = (remote: string, branch = 'main') =>
  git(remote, 'log', '-1', '--format=%s', branch);

export function withHome(): string {
  const h = tmp('ca-home-');
  process.env.CLIENT_AUTO_HOME = h;
  return h;
}

export class FakeRunner implements ClaudeRunner {
  calls: RunOptions[] = [];
  constructor(private fn: (o: RunOptions) => RunResult | Promise<RunResult>) {}
  async run(o: RunOptions): Promise<RunResult> {
    this.calls.push(o);
    return this.fn(o);
  }
}

export function waPayload(from: string, id: string, body: string, type = 'text') {
  const message =
    type === 'text'
      ? { from, id, timestamp: '1', type, text: { body } }
      : { from, id, timestamp: '1', type };
  return {
    object: 'whatsapp_business_account',
    entry: [{ changes: [{ field: 'messages', value: { messages: [message] } }] }],
  };
}
