import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  defaultConfig, loadRegistry, saveRegistry, normalizeNumber, saveProjectConfig,
  type ProjectConfig,
} from './config.js';

export function ensureExcluded(folder: string): void {
  const rel = execFileSync('git', ['rev-parse', '--git-path', 'info/exclude'], { cwd: folder, encoding: 'utf8' }).trim();
  const file = path.resolve(folder, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  if (!current.split('\n').includes('.client-auto/')) {
    fs.appendFileSync(file, (current && !current.endsWith('\n') ? '\n' : '') + '.client-auto/\n');
  }
}

export function connectProject(
  folder: string, rawNumber: string, opts: { branch?: string | null; dryRun?: boolean } = {},
): ProjectConfig {
  const abs = path.resolve(folder);
  if (!fs.existsSync(path.join(abs, '.git'))) throw new Error(`${abs} is not a git repository`);
  const number = normalizeNumber(rawNumber);
  const registry = loadRegistry();
  if (registry[number] && registry[number] !== abs) {
    throw new Error(`${number} is already connected to ${registry[number]}. Disconnect it there first.`);
  }
  for (const [n, f] of Object.entries(registry)) if (f === abs && n !== number) delete registry[n];
  const config: ProjectConfig = { ...defaultConfig(number), branch: opts.branch ?? null, dryRun: opts.dryRun ?? false };
  saveProjectConfig(abs, config);
  ensureExcluded(abs);
  registry[number] = abs;
  saveRegistry(registry);
  return config;
}
