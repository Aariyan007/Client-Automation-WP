import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { main } from '../src/cli.js';
import { loadProjectConfig, loadCredentials } from '../src/config.js';
import { credentialsFile } from '../src/paths.js';
import { makeRepo, withHome, git } from './helpers.js';

beforeEach(() => { withHome(); });

describe('cli main', () => {
  it('connect, status, pause, resume, disconnect round trip', async () => {
    const { dir } = makeRepo();
    expect(await main(['connect', dir, '+919876543210', '--dry-run'])).toMatch(/connected/i);
    expect(loadProjectConfig(dir)?.dryRun).toBe(true);
    expect(await main(['status', dir])).toContain('919876543210');
    await main(['pause', dir]);
    expect(loadProjectConfig(dir)?.paused).toBe(true);
    await main(['resume', dir]);
    expect(loadProjectConfig(dir)?.paused).toBe(false);
    expect(await main(['disconnect', dir])).toMatch(/disconnected/i);
    expect(loadProjectConfig(dir)).toBeNull();
  });
  it('rejects unknown commands with usage text', async () => {
    await expect(main(['bogus'])).rejects.toThrow(/usage/i);
  });
  it('importing main does not start anything (no output, no credentials, process alive)', () => {
    expect(typeof main).toBe('function');
    expect(fs.existsSync(credentialsFile())).toBe(false);
  });
});

describe('cli setup', () => {
  const saved = process.env.CLIENT_AUTO_APP_SECRET;
  afterEach(() => {
    if (saved === undefined) delete process.env.CLIENT_AUTO_APP_SECRET;
    else process.env.CLIENT_AUTO_APP_SECRET = saved;
  });

  it('rejects an empty/whitespace app secret and writes nothing', async () => {
    process.env.CLIENT_AUTO_APP_SECRET = '  ';
    await expect(main(['setup'])).rejects.toThrow(/secret/i);
    expect(loadCredentials()).toBeNull();
  });
  it('saves credentials with mode 0600 and never prints the secret', async () => {
    process.env.CLIENT_AUTO_APP_SECRET = 'sup3r-s3cret-value';
    const out = await main(['setup', '--port', '9001']);
    expect(out).not.toContain('sup3r-s3cret-value');
    const creds = loadCredentials();
    expect(creds?.appSecret).toBe('sup3r-s3cret-value');
    expect(creds?.port).toBe(9001);
    expect(out).toContain(creds!.verifyToken);
    expect(fs.statSync(credentialsFile()).mode & 0o777).toBe(0o600);
  });
});

describe('cli undo', () => {
  it('refuses to run when the working tree has uncommitted changes', async () => {
    const { dir } = makeRepo();
    fs.writeFileSync(path.join(dir, 'index.html'), '<h1>dirty</h1>\n');
    await expect(main(['undo', dir])).rejects.toThrow(/uncommitted/i);
  });
  it('reverts the last client-auto commit on a clean tree', async () => {
    const { dir } = makeRepo();
    fs.writeFileSync(path.join(dir, 'index.html'), '<h1>Changed</h1>\n');
    git(dir, 'commit', '-am', 'client-auto: change heading');
    expect(await main(['undo', dir])).toMatch(/reverted/i);
    expect(fs.readFileSync(path.join(dir, 'index.html'), 'utf8')).toBe('<h1>Hello</h1>\n');
  });
});
