import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createHmac } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import type http from 'node:http';
import { createWebhookServer } from '../src/server.js';
import { createListener } from '../src/listener.js';
import { connectProject } from '../src/projects.js';
import { loadRegistry } from '../src/config.js';
import { logFile, stateFile } from '../src/paths.js';
import { FakeRunner, makeRepo, remoteSubject, remoteHead, waPayload, withHome, git } from './helpers.js';

let server: http.Server;
let listener: ReturnType<typeof createListener>;
afterEach(async () => {
  listener?.dispose();
  await new Promise<void>((r) => server.close(() => r()));
});

describe('end to end', () => {
  it('signed webhook -> classify -> edit -> checks -> commit -> push, and chit-chat does nothing', async () => {
    withHome();
    const { dir, remote } = makeRepo();
    connectProject(dir, '+91 98765 43210');
    let label = 'change_request';
    const runner = new FakeRunner((o) => {
      if (o.model === 'haiku') {
        return { ok: true, text: JSON.stringify({ label, task: label === 'chat' ? '' : 'make heading say Plumeria' }) };
      }
      fs.writeFileSync(path.join(o.cwd, 'index.html'), '<h1>Plumeria</h1>\n');
      return { ok: true, text: 'done' };
    });
    listener = createListener({ runner, notify: () => {}, quietMs: 60_000, loadRegistry });
    server = createWebhookServer({ verifyToken: 't', appSecret: 's', onPayload: listener.handlePayload });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/webhook`;
    const post = (payload: unknown) => {
      const body = JSON.stringify(payload);
      const sig = 'sha256=' + createHmac('sha256', 's').update(body).digest('hex');
      return fetch(base, { method: 'POST', body, headers: { 'x-hub-signature-256': sig } });
    };

    // 1. chit-chat from the client: nothing pushed
    label = 'chat';
    const head = remoteHead(remote);
    expect((await post(waPayload('919876543210', 'c1', 'thanks!'))).status).toBe(200);
    await listener.flushNow();
    expect(remoteHead(remote)).toBe(head);
    const classifierCalls = () => runner.calls.filter((c) => c.model === 'haiku').length;
    expect(classifierCalls()).toBeGreaterThan(0); // the chit-chat was actually classified

    // 2. real change request: pushed once, even if Meta delivers it twice
    label = 'change_request';
    const change = waPayload('919876543210', 'c2', 'please make the heading say Plumeria');
    const before = runner.calls.length;
    await post(change);
    await post(change);
    await listener.flushNow();
    expect(remoteSubject(remote)).toBe('client-auto: make heading say Plumeria');
    expect(git(dir, 'rev-list', '--count', 'HEAD')).toBe('2');
    // exactly one classifier run and one worker run; the text appears once in each prompt (dedupe, not batching luck)
    const newCalls = runner.calls.slice(before);
    const newClassifier = newCalls.filter((c) => c.model === 'haiku');
    const newWorker = newCalls.filter((c) => c.model !== 'haiku');
    expect(newClassifier.length).toBe(1);
    expect(newWorker.length).toBe(1);
    const needle = 'please make the heading say Plumeria';
    expect(newClassifier[0].prompt.split(needle).length - 1).toBe(1);
    expect(newWorker[0].prompt.split(needle).length - 1).toBe(1);

    // 3. a stranger's message never reaches Claude and leaves no trace in the project state
    const calls = runner.calls.length;
    await post(waPayload('15550001111', 's1', 'change the site'));
    await listener.flushNow();
    expect(runner.calls.length).toBe(calls);
    for (const f of [logFile(dir), stateFile(dir)]) {
      if (fs.existsSync(f)) {
        const text = fs.readFileSync(f, 'utf8');
        expect(text).not.toContain('"s1"');
        expect(text).not.toContain('change the site');
      }
    }

    // 4. nothing from .client-auto was pushed, and the project file was
    const tree = git(remote, 'ls-tree', '-r', '--name-only', 'main');
    expect(tree).toContain('index.html');
    expect(tree).not.toContain('.client-auto');

    // 5. status-only webhook and an image from the bound number: 200, nothing pushed, logged as unsupported
    const headAfterChange = remoteHead(remote);
    const status = {
      object: 'whatsapp_business_account',
      entry: [{ changes: [{ field: 'messages', value: { statuses: [{ id: 'wamid.x', status: 'delivered', recipient_id: '919876543210' }] } }] }],
    };
    expect((await post(status)).status).toBe(200);
    const image = waPayload('919876543210', 'c3', '', 'image');
    expect((await post(image)).status).toBe(200);
    await listener.flushNow();
    expect(remoteHead(remote)).toBe(headAfterChange);
    expect(fs.readFileSync(logFile(dir), 'utf8')).toContain('**unsupported**');
  });
});
