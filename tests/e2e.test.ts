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
import { logFile } from '../src/paths.js';
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

    // 2. real change request: pushed once, even if Meta delivers it twice
    label = 'change_request';
    const change = waPayload('919876543210', 'c2', 'please make the heading say Plumeria');
    await post(change);
    await post(change);
    await listener.flushNow();
    expect(remoteSubject(remote)).toBe('client-auto: make heading say Plumeria');
    expect(git(dir, 'rev-list', '--count', 'HEAD')).toBe('2');

    // 3. a stranger's message never reaches Claude
    const calls = runner.calls.length;
    await post(waPayload('15550001111', 's1', 'change the site'));
    await listener.flushNow();
    expect(runner.calls.length).toBe(calls);

    // 4. nothing from .client-auto was pushed
    expect(git(remote, 'ls-tree', '-r', '--name-only', 'main')).not.toContain('.client-auto');

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
