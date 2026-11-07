import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import {
  normalizeNumber, defaultConfig, loadRegistry, saveRegistry,
  loadCredentials, saveCredentials, loadProjectConfig, saveProjectConfig,
} from '../src/config.js';
import { credentialsFile } from '../src/paths.js';
import { tmp, withHome } from './helpers.js';

beforeEach(() => { withHome(); });

describe('normalizeNumber', () => {
  it('strips +, spaces and dashes', () => {
    expect(normalizeNumber('+91 98765-43210')).toBe('919876543210');
  });
  it('rejects non-numbers and wrong lengths', () => {
    expect(() => normalizeNumber('abc')).toThrow();
    expect(() => normalizeNumber('12345')).toThrow();
    expect(() => normalizeNumber('1'.repeat(16))).toThrow();
  });
});

describe('storage', () => {
  it('round-trips the registry and returns {} when missing', () => {
    expect(loadRegistry()).toEqual({});
    saveRegistry({ '919876543210': '/tmp/site' });
    expect(loadRegistry()).toEqual({ '919876543210': '/tmp/site' });
  });
  it('saves credentials with mode 0600', () => {
    expect(loadCredentials()).toBeNull();
    saveCredentials({ verifyToken: 'v', appSecret: 's', port: 8787 });
    expect(loadCredentials()).toEqual({ verifyToken: 'v', appSecret: 's', port: 8787 });
    expect(fs.statSync(credentialsFile()).mode & 0o777).toBe(0o600);
  });
  it('round-trips project config', () => {
    const folder = tmp();
    expect(loadProjectConfig(folder)).toBeNull();
    saveProjectConfig(folder, defaultConfig('919876543210'));
    expect(loadProjectConfig(folder)).toEqual({
      number: '919876543210', branch: null, paused: false, maxJobsPerHour: 10, dryRun: false,
    });
  });
});
