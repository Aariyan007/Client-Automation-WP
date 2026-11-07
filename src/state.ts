import fs from 'node:fs';
import { stateFile, projectDir } from './paths.js';

interface Data { seen: string[]; history: string[] }
const MAX_SEEN = 1000;
const MAX_HISTORY = 5;

export class StateStore {
  private data: Data;
  constructor(private folder: string) {
    try {
      const raw = JSON.parse(fs.readFileSync(stateFile(folder), 'utf8'));
      this.data = { seen: raw.seen ?? [], history: raw.history ?? [] };
    } catch {
      this.data = { seen: [], history: [] };
    }
  }
  private save(): void {
    fs.mkdirSync(projectDir(this.folder), { recursive: true });
    fs.writeFileSync(stateFile(this.folder), JSON.stringify(this.data));
  }
  hasSeen(id: string): boolean { return this.data.seen.includes(id); }
  markSeen(id: string): void {
    this.data.seen.push(id);
    if (this.data.seen.length > MAX_SEEN) this.data.seen = this.data.seen.slice(-MAX_SEEN);
    this.save();
  }
  pushHistory(text: string): void {
    this.data.history.push(text);
    if (this.data.history.length > MAX_HISTORY) this.data.history = this.data.history.slice(-MAX_HISTORY);
    this.save();
  }
  history(): string[] { return [...this.data.history]; }
}
