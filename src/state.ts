import fs from 'node:fs';
import path from 'node:path';
import { stateFile, projectDir } from './paths.js';

interface Data { seen: string[]; history: string[] }
const MAX_SEEN = 1000;
const MAX_HISTORY = 5;

const isStrings = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');

function load(folder: string): Data {
  try {
    const raw = JSON.parse(fs.readFileSync(stateFile(folder), 'utf8'));
    return {
      seen: isStrings(raw?.seen) ? raw.seen : [],
      history: isStrings(raw?.history) ? raw.history : [],
    };
  } catch {
    return { seen: [], history: [] };
  }
}

export class StateStore {
  private data: Data;
  constructor(private folder: string) {
    this.data = load(folder);
  }
  // Write to a temp file in the same directory, then rename, so a crash never leaves a torn state.json.
  private save(): void {
    fs.mkdirSync(projectDir(this.folder), { recursive: true });
    const file = stateFile(this.folder);
    const tmpFile = path.join(path.dirname(file), `.state.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`);
    try {
      fs.writeFileSync(tmpFile, JSON.stringify(this.data));
      fs.renameSync(tmpFile, file);
    } catch (e) {
      fs.rmSync(tmpFile, { force: true });
      throw e;
    }
  }
  hasSeen(id: string): boolean { return this.data.seen.includes(id); }
  // Another StateStore instance may have written since this one was created, so merge into fresh disk data.
  markSeen(id: string): void {
    this.data = load(this.folder);
    this.data.seen.push(id);
    if (this.data.seen.length > MAX_SEEN) this.data.seen = this.data.seen.slice(-MAX_SEEN);
    this.save();
  }
  pushHistory(text: string): void {
    this.data = load(this.folder);
    this.data.history.push(text);
    if (this.data.history.length > MAX_HISTORY) this.data.history = this.data.history.slice(-MAX_HISTORY);
    this.save();
  }
  history(): string[] { return [...this.data.history]; }
}
