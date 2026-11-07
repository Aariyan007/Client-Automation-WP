import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { main } from '../src/cli.js';
import { loadProjectConfig, loadCredentials, saveCredentials } from '../src/config.js';
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

describe('cli option validation', () => {
  it('a valued flag with a missing value or a following flag throws', async () => {
    const { dir } = makeRepo();
    await expect(main(['connect', dir, '+919876543210', '--branch', '--dry-run'])).rejects.toThrow(/--branch needs a value/);
    await expect(main(['connect', dir, '+919876543210', '--branch'])).rejects.toThrow(/--branch needs a value/);
    await expect(main(['setup', '--port'])).rejects.toThrow(/--port needs a value/);
    expect(loadProjectConfig(dir)).toBeNull();
  });
  it('connect rejects a dash branch given as a value', async () => {
    const { dir } = makeRepo();
    await expect(main(['connect', dir, '+919876543210', '--branch', '-f'])).rejects.toThrow(/invalid branch/i);
    await expect(main(['connect', dir, '+919876543210', '--branch', ''])).rejects.toThrow(/invalid branch/i);
    expect(loadProjectConfig(dir)).toBeNull();
  });
  it('unknown flags throw and connect nothing', async () => {
    const { dir } = makeRepo();
    await expect(main(['connect', dir, '+919876543210', '--dryrun'])).rejects.toThrow(/unknown option --dryrun for connect/);
    expect(loadProjectConfig(dir)).toBeNull();
    await expect(main(['status', dir, '--wipe'])).rejects.toThrow(/unknown option --wipe for status/);
    await expect(main(['undo', dir, '--force'])).rejects.toThrow(/unknown option --force for undo/);
  });
});

describe('cli start', () => {
  it('rejects with a message naming the port when it is already in use', async () => {
    const blocker = net.createServer();
    await new Promise<void>((r) => blocker.listen(0, '127.0.0.1', r));
    const port = (blocker.address() as net.AddressInfo).port;
    try {
      saveCredentials({ verifyToken: 'v', appSecret: 's', port });
      await expect(main(['start'])).rejects.toThrow(new RegExp(String(port)));
    } finally {
      await new Promise<void>((r) => blocker.close(() => r()));
    }
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

describe('cli setup overwrite', () => {
  const saved = process.env.CLIENT_AUTO_APP_SECRET;
  afterEach(() => {
    if (saved === undefined) delete process.env.CLIENT_AUTO_APP_SECRET;
    else process.env.CLIENT_AUTO_APP_SECRET = saved;
  });
  it('refuses to replace existing credentials unless --force', async () => {
    process.env.CLIENT_AUTO_APP_SECRET = 'first-secret';
    await main(['setup']);
    const first = loadCredentials()!;
    process.env.CLIENT_AUTO_APP_SECRET = 'second-secret';
    await expect(main(['setup'])).rejects.toThrow(/already set up.*--force/);
    expect(loadCredentials()).toEqual(first);
    await main(['setup', '--force']);
    const after = loadCredentials()!;
    expect(after.verifyToken).not.toBe(first.verifyToken);
    expect(after.appSecret).toBe('second-secret');
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
