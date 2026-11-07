import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

const SKILLS = ['connect-client', 'client-status', 'client-undo', 'disconnect-client', 'resume-client'];
const CLI_COMMANDS = ['setup', 'start', 'connect', 'status', 'pause', 'resume', 'disconnect', 'undo'];

describe('plugin files', () => {
  it('has valid manifests', () => {
    const p = JSON.parse(fs.readFileSync('.claude-plugin/plugin.json', 'utf8'));
    expect(p.name).toBe('client-auto');
    const m = JSON.parse(fs.readFileSync('.claude-plugin/marketplace.json', 'utf8'));
    expect(m.plugins[0].name).toBe('client-auto');
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
  it('setup guide covers --force and dedicated number', () => {
    const setup = fs.readFileSync('docs/setup.md', 'utf8');
    expect(setup).toMatch(/--force/);
    expect(setup).toMatch(/dedicated/i);
  });
  it('README has a Known limits section', () => {
    const readme = fs.readFileSync('README.md', 'utf8');
    expect(readme).toMatch(/Known limits/);
  });
  it.each(SKILLS)('skill %s only uses client-auto CLI commands from the allowed list', (s) => {
    const full = fs.readFileSync(`skills/${s}/SKILL.md`, 'utf8');
    const body = full.replace(/^---\n[\s\S]*?\n---\n/, '');
    expect(body).not.toMatch(/npx/);
    expect(body).not.toMatch(/curl/);
    const used = [...body.matchAll(/client-auto\s+([a-z-]+)/g)].map((m) => m[1]);
    for (const cmd of used) {
      expect(CLI_COMMANDS).toContain(cmd);
    }
  });
});
