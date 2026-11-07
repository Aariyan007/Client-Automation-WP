import fs from 'node:fs';
import { logFile, projectDir } from './paths.js';

export type LogKind =
  | 'ignored-chat' | 'ignored-unclear' | 'unsupported' | 'dropped-paused' | 'refused'
  | 'rate-limited' | 'dry-run' | 'skipped-dirty' | 'agent-failed' | 'nothing-changed'
  | 'checks-failed' | 'push-failed' | 'pushed' | 'error';

const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim();

export function appendLog(folder: string, kind: LogKind, detail: string, messages: string[] = []): void {
  fs.mkdirSync(projectDir(folder), { recursive: true });
  let entry = `- ${new Date().toISOString()} **${kind}** ${oneLine(detail)}\n`;
  for (const m of messages) entry += `  > ${oneLine(m)}\n`;
  fs.appendFileSync(logFile(folder), entry);
}
