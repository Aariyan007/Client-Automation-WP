import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { connectProject, setPaused, disconnectProject, statusText } from '../src/projects.js';
import { loadRegistry, loadProjectConfig, saveCredentials, loadCredentials } from '../src/config.js';
import { appendLog } from '../src/log.js';
import { projectDir, logFile } from '../src/paths.js';
import { makeRepo, tmp, withHome, git } from './helpers.js';

beforeEach(() => { withHome(); });

describe('connectProject', () => {
  it('writes config + registry (normalised) and git-excludes .client-auto without dirtying the tree', () => {
    const { dir } = makeRepo();
    const cfg = connectProject(dir, '+91 98765-43210', { branch: 'client-changes' });
    expect(cfg.number).toBe('919876543210');
    expect(loadRegistry()).toEqual({ '919876543210': path.resolve(dir) });
    expect(loadProjectConfig(dir)?.branch).toBe('client-changes');
    expect(git(dir, 'status', '--porcelain')).toBe('');
  });
  it('rejects a non-git folder', () => {
    expect(() => connectProject(tmp(), '919876543210')).toThrow(/not a git repository/);
  });
  it('rejects a number already bound to another project', () => {
    connectProject(makeRepo().dir, '919876543210');
    expect(() => connectProject(makeRepo().dir, '+919876543210')).toThrow(/already connected/);
  });
  it('re-connecting a folder with a new number replaces the old binding', () => {
    const { dir } = makeRepo();
    connectProject(dir, '919876543210');
    connectProject(dir, '14155550123');
    expect(Object.keys(loadRegistry())).toEqual(['14155550123']);
  });
});

describe('connectProject branch validation', () => {
  it.each(['-f', '--dry-run', 'a..b', ''])('rejects branch %j', (b) => {
    const { dir } = makeRepo();
    expect(() => connectProject(dir, '919876543210', { branch: b })).toThrow(/invalid branch/i);
    expect(loadProjectConfig(dir)).toBeNull();
  });
  it('accepts a normal branch name and still allows no branch', () => {
    const { dir } = makeRepo();
    expect(connectProject(dir, '919876543210', { branch: 'client-changes' }).branch).toBe('client-changes');
    expect(connectProject(dir, '919876543210', { branch: null }).branch).toBeNull();
    expect(connectProject(dir, '919876543210').branch).toBeNull();
  });
});

describe('pause / disconnect', () => {
  it('pause and resume flip the flag', () => {
    const { dir } = makeRepo();
    connectProject(dir, '919876543210');
    setPaused(dir, true);
    expect(loadProjectConfig(dir)?.paused).toBe(true);
    setPaused(dir, false);
    expect(loadProjectConfig(dir)?.paused).toBe(false);
  });
  it('disconnect unbinds the number but keeps the log by default', () => {
    const { dir } = makeRepo();
    connectProject(dir, '919876543210');
    appendLog(dir, 'pushed', 'x');
    disconnectProject(dir, { deleteLog: false, wipe: false });
    expect(loadRegistry()).toEqual({});
    expect(loadProjectConfig(dir)).toBeNull();
    expect(fs.existsSync(logFile(dir))).toBe(true);
  });
  it('--delete-log removes log and state', () => {
    const { dir } = makeRepo();
    connectProject(dir, '919876543210');
    appendLog(dir, 'pushed', 'x');
    disconnectProject(dir, { deleteLog: true, wipe: false });
    expect(fs.existsSync(logFile(dir))).toBe(false);
  });
  it('wipe removes .client-auto, and credentials only when no other project remains', () => {
    saveCredentials({ verifyToken: 'v', appSecret: 's', port: 8787 });
    const a = makeRepo().dir, b = makeRepo().dir;
    connectProject(a, '919876543210');
    connectProject(b, '14155550123');
    expect(disconnectProject(a, { deleteLog: true, wipe: true }).credentialsDeleted).toBe(false);
    expect(fs.existsSync(projectDir(a))).toBe(false);
    expect(loadCredentials()).not.toBeNull();
    expect(disconnectProject(b, { deleteLog: true, wipe: true }).credentialsDeleted).toBe(true);
    expect(loadCredentials()).toBeNull();
  });
});

describe('statusText', () => {
  it('shows number, state and recent log lines', () => {
    const { dir } = makeRepo();
    connectProject(dir, '919876543210');
    appendLog(dir, 'pushed', 'abc1234 fix header');
    const s = statusText(dir);
    expect(s).toContain('919876543210');
    expect(s).toContain('paused: no');
    expect(s).toContain('abc1234 fix header');
  });
  it('says so when the folder is not connected', () => {
    expect(statusText(makeRepo().dir)).toMatch(/not connected/i);
  });
});
