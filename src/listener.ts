import fs from 'node:fs';
import path from 'node:path';
import type { ClaudeRunner } from './claude.js';
import type { Registry } from './config.js';
import { loadProjectConfig } from './config.js';
import { homeDir } from './paths.js';
import { parseWebhook } from './parse.js';
import { route } from './router.js';
import { StateStore } from './state.js';
import { Batcher } from './batcher.js';
import { KeyedQueue } from './queue.js';
import { RateLimiter } from './ratelimit.js';
import { classify } from './classifier.js';
import { runJob, type WorkerDeps } from './worker.js';
import { appendLog } from './log.js';

export interface ListenerDeps {
  runner: ClaudeRunner;
  notify: WorkerDeps['notify'];
  quietMs: number;
  loadRegistry: () => Registry;
  /** Empty directory the classifier runs in; defaults to <home>/classifier-cwd. */
  classifierCwd?: string;
}

export function createListener(deps: ListenerDeps) {
  const queue = new KeyedQueue();
  const limiter = new RateLimiter(3_600_000);
  const classifierCwd = deps.classifierCwd ?? path.join(homeDir(), 'classifier-cwd');
  fs.mkdirSync(classifierCwd, { recursive: true });

  async function processBatch(folder: string, texts: string[]): Promise<void> {
    const config = loadProjectConfig(folder);
    if (!config) return;
    if (config.paused) { appendLog(folder, 'dropped-paused', 'project paused', texts); return; }
    const state = new StateStore(folder);
    const verdict = await classify(deps.runner, classifierCwd, state.history(), texts);
    texts.forEach((t) => state.pushHistory(t));
    if (verdict.label !== 'change_request') {
      appendLog(folder, verdict.label === 'chat' ? 'ignored-chat' : 'ignored-unclear', verdict.task, texts);
      return;
    }
    await runJob({ runner: deps.runner, limiter, notify: deps.notify }, folder, config, verdict.task, texts);
  }

  const batcher = new Batcher(deps.quietMs, (folder, texts) => {
    queue.run(folder, () => processBatch(folder, texts)).catch((e) => {
      try { appendLog(folder, 'error', String(e).slice(0, 300), texts); } catch { /* folder gone */ }
    });
  });

  return {
    handlePayload(payload: unknown): void {
      for (const msg of parseWebhook(payload)) {
        const r = route(msg, deps.loadRegistry());
        if (r.kind === 'drop') continue;
        if (!fs.existsSync(r.folder)) continue;
        const state = new StateStore(r.folder);
        if (state.hasSeen(msg.id)) continue;
        state.markSeen(msg.id);
        if (r.kind === 'unsupported') { appendLog(r.folder, 'unsupported', `message type: ${r.type}`); continue; }
        batcher.push(r.folder, r.text);
      }
    },
    async flushNow(): Promise<void> {
      batcher.flushAll();
      await queue.idle();
    },
    dispose(): void { batcher.dispose(); },
  };
}
