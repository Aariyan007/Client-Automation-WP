import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const EXCLUDE = ':(exclude).client-auto';

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await exec('git', args, {
    cwd,
    maxBuffer: 10 * 1024 * 1024,
    timeout: 120_000,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  });
  return stdout;
}

export async function isClean(cwd: string): Promise<boolean> {
  return (await git(cwd, ['status', '--porcelain', '--', '.', EXCLUDE])).trim() === '';
}

export async function ensureBranch(cwd: string, branch: string | null): Promise<void> {
  if (!branch) return;
  const current = (await git(cwd, ['rev-parse', '--abbrev-ref', 'HEAD'])).trim();
  if (current === branch) return;
  try { await git(cwd, ['checkout', branch]); } catch { await git(cwd, ['checkout', '-b', branch]); }
}

// Only call after isClean() was true before the agent ran (runs reset --hard and clean -fd).
export async function discardChanges(cwd: string): Promise<void> {
  await git(cwd, ['reset', '--hard', 'HEAD']);
  await git(cwd, ['clean', '-fd', '-e', '.client-auto']);
}

export async function commitAll(cwd: string, message: string): Promise<string | null> {
  await git(cwd, ['add', '-A', '--', '.', EXCLUDE]);
  try {
    await git(cwd, ['diff', '--cached', '--quiet']);
    return null;
  } catch { /* exit 1 means there are staged changes */ }
  await git(cwd, ['commit', '-m', message]);
  return (await git(cwd, ['rev-parse', 'HEAD'])).trim();
}

export async function push(cwd: string): Promise<void> {
  await git(cwd, ['push', 'origin', 'HEAD']);
}

export async function revertLast(cwd: string): Promise<string | null> {
  const bodies = await git(cwd, ['log', '--format=%b', '-n', '50']);
  const reverted = new Set([...bodies.matchAll(/This reverts commit ([0-9a-f]{40})/g)].map((m) => m[1]));
  const lines = (await git(cwd, ['log', '--format=%H%x09%s', '-n', '50'])).split('\n');
  const hit = lines.find((l) => {
    const [sha, subject] = l.split('\t');
    return subject?.startsWith('client-auto:') && !reverted.has(sha);
  });
  if (!hit) return null;
  const sha = hit.split('\t')[0];
  try {
    await git(cwd, ['revert', '--no-edit', sha]);
  } catch (err) {
    await git(cwd, ['revert', '--abort']).catch(() => {});
    throw err;
  }
  return sha;
}
