import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  defaultConfig, loadRegistry, saveRegistry, normalizeNumber, saveProjectConfig, loadProjectConfig,
  type ProjectConfig,
} from './config.js';
import { credentialsFile, projectDir, logFile, stateFile, configFile } from './paths.js';

export function ensureExcluded(folder: string): void {
  const rel = execFileSync('git', ['rev-parse', '--git-path', 'info/exclude'], { cwd: folder, encoding: 'utf8' }).trim();
  const file = path.resolve(folder, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  if (!current.split('\n').includes('.client-auto/')) {
    fs.appendFileSync(file, (current && !current.endsWith('\n') ? '\n' : '') + '.client-auto/\n');
  }
}

function assertValidBranch(folder: string, branch: string): void {
  const bad = (): never => { throw new Error(`invalid branch name ${JSON.stringify(branch)}`); };
  if (!branch || branch.startsWith('-') || branch.includes('@{')) bad();
  try {
    execFileSync('git', ['check-ref-format', '--branch', branch], { cwd: folder, stdio: 'ignore' });
  } catch { bad(); }
}

export function connectProject(
  folder: string, rawNumber: string, opts: { branch?: string | null; dryRun?: boolean } = {},
): ProjectConfig {
  const abs = path.resolve(folder);
  if (!fs.existsSync(path.join(abs, '.git'))) throw new Error(`${abs} is not a git repository`);
  const number = normalizeNumber(rawNumber);
  if (opts.branch !== undefined && opts.branch !== null) assertValidBranch(abs, opts.branch);
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

export function setPaused(folder: string, paused: boolean): void {
  const abs = path.resolve(folder);
  const cfg = loadProjectConfig(abs);
  if (!cfg) throw new Error(`${abs} is not connected to a client`);
  saveProjectConfig(abs, { ...cfg, paused });
}

export function disconnectProject(
  folder: string, opts: { deleteLog: boolean; wipe: boolean },
): { credentialsDeleted: boolean } {
  const abs = path.resolve(folder);
  const registry = loadRegistry();
  for (const [n, f] of Object.entries(registry)) if (f === abs) delete registry[n];
  saveRegistry(registry);
  fs.rmSync(configFile(abs), { force: true });
  if (opts.wipe) {
    fs.rmSync(projectDir(abs), { recursive: true, force: true });
  } else if (opts.deleteLog) {
    fs.rmSync(logFile(abs), { force: true });
    fs.rmSync(stateFile(abs), { force: true });
  }
  let credentialsDeleted = false;
  if (opts.wipe && Object.keys(registry).length === 0) {
    fs.rmSync(credentialsFile(), { force: true });
    credentialsDeleted = true;
  }
  return { credentialsDeleted };
}

export function statusText(folder: string): string {
  const abs = path.resolve(folder);
  const cfg = loadProjectConfig(abs);
  if (!cfg) return `${abs} is not connected to a client.`;
  const lines = [
    `project: ${abs}`,
    `client number: ${cfg.number}`,
    `paused: ${cfg.paused ? 'yes' : 'no'}`,
    `dry run: ${cfg.dryRun ? 'yes' : 'no'}`,
    `branch: ${cfg.branch ?? '(current)'}`,
    `max jobs/hour: ${cfg.maxJobsPerHour}`,
  ];
  let recent = '';
  try {
    // Client message lines ("  > ...") are third-party text; never echo them into the owner's Claude session.
    recent = fs.readFileSync(logFile(abs), 'utf8').split('\n')
      .filter((l) => l.trim() !== '' && !l.startsWith('  >'))
      .slice(-10)
      .map((l) => Array.from(l).slice(0, 200).join(''))
      .join('\n');
  } catch { /* no log yet */ }
  return recent ? `${lines.join('\n')}\n\nrecent activity:\n${recent}` : lines.join('\n');
}
