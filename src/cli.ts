#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { loadCredentials, saveCredentials, loadRegistry } from './config.js';
import { connectProject, setPaused, disconnectProject, statusText } from './projects.js';
import { revertLast, push, isClean } from './git.js';
import { CliClaudeRunner } from './claude.js';
import { createListener } from './listener.js';
import { createWebhookServer } from './server.js';
import { notify } from './notify.js';

const USAGE = `usage:
  client-auto setup [--port 8787]
  client-auto start
  client-auto connect <folder> <number> [--branch NAME] [--dry-run]
  client-auto status <folder>
  client-auto pause <folder>      client-auto resume <folder>
  client-auto disconnect <folder> [--delete-log] [--wipe]
  client-auto undo <folder> [--push]`;

const VALUED = new Set(['branch', 'port']);

const ALLOWED: Record<string, string[]> = {
  setup: ['port', 'force'],
  start: [],
  connect: ['branch', 'dry-run'],
  status: [],
  pause: [],
  resume: [],
  disconnect: ['delete-log', 'wipe'],
  undo: ['push'],
};

function parseArgs(argv: string[]) {
  const pos: string[] = [];
  const flags: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      if (VALUED.has(k)) {
        const v = argv[i + 1];
        if (v === undefined || v.startsWith('--')) throw new Error(`--${k} needs a value`);
        flags[k] = v;
        i++;
      } else flags[k] = true;
    } else pos.push(a);
  }
  return { pos, flags };
}

export async function main(argv: string[]): Promise<string> {
  const [cmd, ...rest] = argv;
  const { pos, flags } = parseArgs(rest);
  const allowed = ALLOWED[cmd];
  if (allowed) {
    for (const k of Object.keys(flags)) {
      if (!allowed.includes(k)) throw new Error(`unknown option --${k} for ${cmd}`);
    }
  }
  switch (cmd) {
    case 'setup': {
      if (loadCredentials() && flags.force !== true) {
        throw new Error('already set up; re-run with --force to replace the credentials. This changes the verify token and you must update it in Meta.');
      }
      const secret = (process.env.CLIENT_AUTO_APP_SECRET ?? (await prompt('Meta app secret: '))).trim();
      if (!secret) throw new Error('app secret is required (it must not be empty)');
      const port = Number(flags.port ?? 8787);
      if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('--port must be a number from 1 to 65535');
      const verifyToken = randomBytes(16).toString('hex');
      saveCredentials({ verifyToken, appSecret: secret, port });
      return `Saved. Use this Verify token in Meta's webhook settings:\n${verifyToken}\nCallback path: /webhook  (local port ${port})`;
    }
    case 'start': {
      const creds = loadCredentials();
      if (!creds) throw new Error('Run "client-auto setup" first.');
      const listener = createListener({ runner: new CliClaudeRunner(), notify, quietMs: 30_000, loadRegistry });
      const server = createWebhookServer({ verifyToken: creds.verifyToken, appSecret: creds.appSecret, onPayload: listener.handlePayload });
      await new Promise<void>((resolve, reject) => {
        const onError = (e: Error) => {
          listener.dispose();
          reject(new Error(`cannot listen on 127.0.0.1:${creds.port}: ${e.message}`));
        };
        server.once('error', onError);
        server.listen(creds.port, '127.0.0.1', () => { server.off('error', onError); resolve(); });
      });
      server.on('error', (e) => console.error(`client-auto server error: ${e.message}`));
      return `client-auto listening on http://127.0.0.1:${creds.port}/webhook (Ctrl+C to stop)`;
    }
    case 'connect': {
      const [folder, number] = pos;
      if (!folder || !number) throw new Error(USAGE);
      const cfg = connectProject(folder, number, {
        branch: typeof flags.branch === 'string' ? flags.branch : null,
        dryRun: flags['dry-run'] === true,
      });
      return `Connected ${path.resolve(folder)} to client number ${cfg.number}.`;
    }
    case 'status':
      if (!pos[0]) throw new Error(USAGE);
      return statusText(pos[0]);
    case 'pause':
    case 'resume':
      if (!pos[0]) throw new Error(USAGE);
      setPaused(pos[0], cmd === 'pause');
      return cmd === 'pause' ? 'Paused. Client messages are ignored until you resume.' : 'Resumed.';
    case 'disconnect': {
      if (!pos[0]) throw new Error(USAGE);
      const r = disconnectProject(pos[0], { deleteLog: flags['delete-log'] === true, wipe: flags.wipe === true });
      return `Disconnected.${r.credentialsDeleted ? ' Saved credentials deleted.' : ''}`;
    }
    case 'undo': {
      if (!pos[0]) throw new Error(USAGE);
      const folder = path.resolve(pos[0]);
      if (!(await isClean(folder))) {
        throw new Error(`${folder} has uncommitted changes. Commit or stash them first; undo will not run on a dirty working tree.`);
      }
      const sha = await revertLast(folder);
      if (!sha) return 'No client-auto commit left to undo.';
      if (flags.push === true) await push(folder);
      return `Reverted ${sha.slice(0, 7)}.${flags.push === true ? ' Pushed.' : ' Not pushed yet (re-run with --push).'}`;
    }
    default:
      throw new Error(USAGE);
  }
}

async function prompt(q: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try { return (await rl.question(q)).trim(); } finally { rl.close(); }
}

const invoked = process.argv[1] && fs.existsSync(process.argv[1]) &&
  fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1]);
if (invoked) {
  main(process.argv.slice(2))
    .then((out) => { if (out) console.log(out); })
    .catch((e) => { console.error(e instanceof Error ? e.message : String(e)); process.exit(1); });
}
