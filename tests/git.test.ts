import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { isClean, ensureBranch, discardChanges, commitAll, push, revertLast } from '../src/git.js';
import { makeRepo, git, remoteSubject } from './helpers.js';

describe('git helpers', () => {
  it('isClean ignores .client-auto but sees real edits', async () => {
    const { dir } = makeRepo();
    fs.mkdirSync(path.join(dir, '.client-auto'));
    fs.writeFileSync(path.join(dir, '.client-auto', 'log.md'), 'secret client text');
    expect(await isClean(dir)).toBe(true);
    fs.writeFileSync(path.join(dir, 'index.html'), 'changed');
    expect(await isClean(dir)).toBe(false);
  });

  it('commitAll never stages .client-auto and returns null when nothing changed', async () => {
    const { dir } = makeRepo();
    fs.mkdirSync(path.join(dir, '.client-auto'));
    fs.writeFileSync(path.join(dir, '.client-auto', 'log.md'), 'secret client text');
    expect(await commitAll(dir, 'client-auto: nothing')).toBeNull();
    fs.writeFileSync(path.join(dir, 'new.html'), 'x');
    const sha = await commitAll(dir, 'client-auto: add page');
    expect(sha).toMatch(/^[0-9a-f]{40}$/);
    expect(git(dir, 'ls-files')).not.toContain('.client-auto');
  });

  it('commitAll works when .client-auto/ is git-excluded (as after connect)', async () => {
    const { dir } = makeRepo();
    fs.appendFileSync(path.join(dir, '.git', 'info', 'exclude'), '.client-auto/\n');
    fs.mkdirSync(path.join(dir, '.client-auto'));
    fs.writeFileSync(path.join(dir, '.client-auto', 'log.md'), 'secret client text');
    fs.writeFileSync(path.join(dir, 'new.html'), 'x');
    expect(await commitAll(dir, 'client-auto: add page')).toMatch(/^[0-9a-f]{40}$/);
    expect(git(dir, 'ls-files')).not.toContain('.client-auto');
  });

  it('push sends the commit to the remote', async () => {
    const { dir, remote } = makeRepo();
    fs.writeFileSync(path.join(dir, 'a.txt'), 'a');
    await commitAll(dir, 'client-auto: a');
    await push(dir);
    expect(remoteSubject(remote)).toBe('client-auto: a');
  });

  it('ensureBranch creates and reuses a branch; null leaves HEAD alone', async () => {
    const { dir } = makeRepo();
    await ensureBranch(dir, null);
    expect(git(dir, 'rev-parse', '--abbrev-ref', 'HEAD')).toBe('main');
    await ensureBranch(dir, 'client-changes');
    expect(git(dir, 'rev-parse', '--abbrev-ref', 'HEAD')).toBe('client-changes');
    await ensureBranch(dir, 'client-changes');
    expect(git(dir, 'rev-parse', '--abbrev-ref', 'HEAD')).toBe('client-changes');
  });

  it('discardChanges restores tracked files and removes untracked ones but keeps .client-auto', async () => {
    const { dir } = makeRepo();
    fs.mkdirSync(path.join(dir, '.client-auto'));
    fs.writeFileSync(path.join(dir, '.client-auto', 'log.md'), 'keep');
    fs.writeFileSync(path.join(dir, 'index.html'), 'broken');
    fs.writeFileSync(path.join(dir, 'junk.txt'), 'junk');
    await discardChanges(dir);
    expect(fs.readFileSync(path.join(dir, 'index.html'), 'utf8')).toBe('<h1>Hello</h1>\n');
    expect(fs.existsSync(path.join(dir, 'junk.txt'))).toBe(false);
    expect(fs.existsSync(path.join(dir, '.client-auto', 'log.md'))).toBe(true);
  });

  it('revertLast reverts client-auto commits newest first, each only once', async () => {
    const { dir } = makeRepo();
    fs.writeFileSync(path.join(dir, 'one.txt'), '1');
    const first = await commitAll(dir, 'client-auto: one');
    fs.writeFileSync(path.join(dir, 'two.txt'), '2');
    const second = await commitAll(dir, 'client-auto: two');
    expect(await revertLast(dir)).toBe(second);
    expect(fs.existsSync(path.join(dir, 'two.txt'))).toBe(false);
    expect(await revertLast(dir)).toBe(first);
    expect(fs.existsSync(path.join(dir, 'one.txt'))).toBe(false);
    expect(await revertLast(dir)).toBeNull();
  });

  it('revertLast aborts a conflicting revert and leaves the repo clean', async () => {
    const { dir } = makeRepo();
    fs.writeFileSync(path.join(dir, 'f.txt'), 'one\n');
    await commitAll(dir, 'client-auto: one');
    fs.writeFileSync(path.join(dir, 'f.txt'), 'two\n');
    git(dir, 'add', '-A');
    git(dir, 'commit', '-m', 'edit later');
    await expect(revertLast(dir)).rejects.toThrow();
    expect(await isClean(dir)).toBe(true);
    expect(fs.existsSync(path.join(dir, '.git', 'REVERT_HEAD'))).toBe(false);
  });
});
