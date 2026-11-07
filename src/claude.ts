import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);

export interface RunOptions {
  prompt: string;
  cwd: string;
  model?: string;
  allowedTools?: string[];
  disallowedTools?: string[];
  permissionMode?: string;
  timeoutMs: number;
}
export interface RunResult { ok: boolean; text: string }
export interface ClaudeRunner { run(o: RunOptions): Promise<RunResult> }

export function buildArgs(o: RunOptions): string[] {
  const a = ['-p', o.prompt, '--output-format', 'json'];
  if (o.model) a.push('--model', o.model);
  if (o.permissionMode) a.push('--permission-mode', o.permissionMode);
  if (o.allowedTools?.length) a.push('--allowedTools', o.allowedTools.join(','));
  if (o.disallowedTools?.length) a.push('--disallowedTools', o.disallowedTools.join(','));
  return a;
}

export function parseCliOutput(stdout: string): RunResult {
  try {
    const j = JSON.parse(stdout);
    if (typeof j.result === 'string') return { ok: j.is_error !== true, text: j.result };
  } catch { /* not JSON */ }
  return { ok: false, text: stdout };
}

export class CliClaudeRunner implements ClaudeRunner {
  async run(o: RunOptions): Promise<RunResult> {
    try {
      const p = exec('claude', buildArgs(o), { cwd: o.cwd, timeout: o.timeoutMs, maxBuffer: 20 * 1024 * 1024 });
      p.child.stdin?.end();
      const { stdout } = await p;
      return parseCliOutput(stdout);
    } catch (e: any) {
      return { ok: false, text: String(e?.stdout || e?.message || e) };
    }
  }
}
