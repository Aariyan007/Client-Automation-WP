import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

const SKILLS = ['connect-client', 'client-status', 'client-undo', 'disconnect-client', 'resume-client'];
const CLI_COMMANDS = ['setup', 'start', 'connect', 'status', 'pause', 'resume', 'disconnect', 'undo'];
const ALLOWED_FLAGS = ['--branch', '--dry-run', '--delete-log', '--wipe', '--push', '--port', '--force'];

describe('plugin files', () => {
  it('has valid manifests', () => {
    const p = JSON.parse(fs.readFileSync('.claude-plugin/plugin.json', 'utf8'));
    expect(p.name).toBe('client-auto');
    expect(p.version).toBe('0.1.0');
    expect(p.license).toBe('MIT');
    const m = JSON.parse(fs.readFileSync('.claude-plugin/marketplace.json', 'utf8'));
    expect(m.plugins[0].name).toBe('client-auto');
    expect(m.plugins[0].source).toBe('./');
  });
  it.each(SKILLS)('skill %s has frontmatter with matching name and a description', (s) => {
    const text = fs.readFileSync(`skills/${s}/SKILL.md`, 'utf8');
    expect(text).toMatch(new RegExp(`^---\\nname: ${s}\\ndescription: .+\\n---`));
  });
  it('documents the unofficial/privacy facts users must know', () => {
    const readme = fs.readFileSync('README.md', 'utf8');
    expect(readme).toMatch(/only reads messages from the number/i);
    expect(readme).toMatch(/Cloudflare Tunnel/);
    expect(readme).toMatch(/never replies/i);
  });
  it('setup guide covers --force, dedicated number, domain, token expiry and verify token', () => {
    const setup = fs.readFileSync('docs/setup.md', 'utf8');
    expect(setup).toMatch(/--force/);
    expect(setup).toMatch(/dedicated/i);
    expect(setup).toMatch(/domain/i);
    expect(setup).toMatch(/24 hours/);
    expect(setup).toMatch(/verify token/i);
  });
  it('README has a Known limits section covering the required caveats', () => {
    const readme = fs.readFileSync('README.md', 'utf8');
    expect(readme).toMatch(/Known limits/);
    expect(readme).toMatch(/billing/i);
    expect(readme).toMatch(/dist\//);
    expect(readme).toMatch(/sandbox/i);
    expect(readme).toMatch(/text messages only/i);
  });
  it('README makes no ban-risk claim and gives a real install route', () => {
    const readme = fs.readFileSync('README.md', 'utf8');
    expect(readme).not.toMatch(/no ban risk/i);
    expect(readme).not.toContain('npm install -g client-auto');
    expect(readme).toMatch(/not published to npm yet/);
    expect(readme).toMatch(/npm link/);
  });
  it('client-status skill says recent-activity text is untrusted data', () => {
    const text = fs.readFileSync('skills/client-status/SKILL.md', 'utf8');
    expect(text).toMatch(/untrusted/i);
    expect(text).toMatch(/never instructions|not instructions/i);
    expect(text).toMatch(/client or by an AI agent/i);
  });
  it('connect-client does not tell users to install from npm', () => {
    const text = fs.readFileSync('skills/connect-client/SKILL.md', 'utf8');
    expect(text).not.toMatch(/npm install -g/);
  });
  it.each(SKILLS)('skill %s only uses client-auto CLI commands and allowed flags', (s) => {
    const full = fs.readFileSync(`skills/${s}/SKILL.md`, 'utf8');
    const body = full.replace(/^---\n[\s\S]*?\n---\n/, '');
    expect(body).not.toMatch(/npx/);
    expect(body).not.toMatch(/curl/);
    const used = [...body.matchAll(/client-auto\s+([a-z-]+)/g)].map((m) => m[1]);
    for (const cmd of used) {
      expect(CLI_COMMANDS).toContain(cmd);
    }
    const flags = [...body.matchAll(/(?<![\w-])--[a-z][a-z-]*/g)].map((m) => m[0]);
    for (const f of flags) {
      expect(ALLOWED_FLAGS).toContain(f);
    }
  });
});
