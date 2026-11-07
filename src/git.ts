import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';

const exec = promisify(execFile);
const EXCLUDE = ':(exclude).client-auto';
// `git add` errors when an exclude pathspec names a path that is itself git-ignored (as .client-auto/ is
// once info/exclude is set up); a glob pathspec excludes the same files without that error.
const EXCLUDE_ADD = ':(exclude,glob)**/.client-auto/**';

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

/** Paths with uncommitted changes (including untracked files and both sides of a rename), excluding .client-auto. */
export async function changedPaths(cwd: string): Promise<string[]> {
  const out = await git(cwd, ['status', '--porcelain', '-z', '-uall', '--', '.', EXCLUDE]);
  const parts = out.split('\0');
  const paths: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const entry = parts[i];
    if (entry.length < 4) continue;
    paths.push(entry.slice(3));
    // Renames and copies are followed by an extra NUL-separated entry holding the original path.
    if (entry[0] === 'R' || entry[0] === 'C' || entry[1] === 'R' || entry[1] === 'C') {
      i++;
      if (parts[i]) paths.push(parts[i]);
    }
  }
  return [...new Set(paths)];
}

const canonical = (v: unknown): string => JSON.stringify(v, (_k, val) =>
  val && typeof val === 'object' && !Array.isArray(val)
    ? Object.fromEntries(Object.entries(val as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
    : val);

/**
 * True when package.json's `scripts` field differs from HEAD's (a missing file or missing field counts as empty).
 * Anything unparseable counts as different.
 */
export async function scriptsChanged(cwd: string): Promise<boolean> {
  const scriptsOf = (raw: string): unknown => {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && 'scripts' in parsed ? parsed.scripts ?? {} : {};
  };
  let current: unknown = {};
  try {
    current = scriptsOf(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'));
  } catch (e: any) {
    if (e?.code !== 'ENOENT') return true;
  }
  let head: unknown = {};
  let headRaw: string | null = null;
  try { headRaw = await git(cwd, ['show', 'HEAD:package.json']); } catch { /* no package.json at HEAD */ }
  if (headRaw !== null) {
    try { head = scriptsOf(headRaw); } catch { return true; }
  }
  return canonical(current) !== canonical(head);
}

export async function ensureBranch(cwd: string, branch: string | null): Promise<void> {
  if (!branch) return;
  if (branch.startsWith('-')) throw new Error(`invalid branch name ${JSON.stringify(branch)}`);
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
  await git(cwd, ['add', '-A', '--', '.', EXCLUDE_ADD]);
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
