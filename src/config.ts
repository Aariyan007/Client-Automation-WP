import fs from 'node:fs';
import path from 'node:path';
import { homeDir, registryFile, credentialsFile, configFile, projectDir } from './paths.js';

export interface ProjectConfig {
  number: string;
  branch: string | null;
  paused: boolean;
  maxJobsPerHour: number;
  dryRun: boolean;
}
export interface Credentials { verifyToken: string; appSecret: string; port: number }
export type Registry = Record<string, string>;

export function normalizeNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) {
    throw new Error(`"${raw}" is not a valid phone number (use country code, 8-15 digits)`);
  }
  return digits;
}

export const defaultConfig = (number: string): ProjectConfig => ({
  number, branch: null, paused: false, maxJobsPerHour: 10, dryRun: false,
});

function readJson<T>(file: string): T | null {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) as T; } catch { return null; }
}
function writeJson(file: string, data: unknown, mode = 0o644): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', { mode });
  fs.chmodSync(file, mode);
}

export const loadRegistry = (): Registry => readJson<Registry>(registryFile()) ?? {};
export function saveRegistry(r: Registry): void {
  fs.mkdirSync(homeDir(), { recursive: true, mode: 0o700 });
  writeJson(registryFile(), r, 0o600);
}
export const loadCredentials = (): Credentials | null => readJson<Credentials>(credentialsFile());
export function saveCredentials(c: Credentials): void {
  fs.mkdirSync(homeDir(), { recursive: true, mode: 0o700 });
  writeJson(credentialsFile(), c, 0o600);
}
export const loadProjectConfig = (folder: string): ProjectConfig | null =>
  readJson<ProjectConfig>(configFile(folder));
export function saveProjectConfig(folder: string, c: ProjectConfig): void {
  fs.mkdirSync(projectDir(folder), { recursive: true });
  writeJson(configFile(folder), c);
}
