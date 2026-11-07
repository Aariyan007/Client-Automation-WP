import { describe, it, expect, afterEach } from 'vitest';
import { createHmac } from 'node:crypto';
import net, { type AddressInfo } from 'node:net';
import type http from 'node:http';
import { createWebhookServer } from '../src/server.js';

let server: http.Server | undefined;
afterEach(async () => {
  const s = server;
  server = undefined;
  if (s) await new Promise<void>((r) => s.close(() => r()));
});

async function start(onPayload: (p: unknown) => void) {
  server = createWebhookServer({ verifyToken: 'tok', appSecret: 'sec', onPayload });
  await new Promise<void>((r) => server!.listen(0, '127.0.0.1', r));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}
const sign = (b: string) => 'sha256=' + createHmac('sha256', 'sec').update(b).digest('hex');

describe('webhook server', () => {
  it('answers Meta verification with the challenge only for the right token', async () => {
    const base = await start(() => {});
    const ok = await fetch(`${base}/webhook?hub.mode=subscribe&hub.verify_token=tok&hub.challenge=12345`);
    expect(ok.status).toBe(200);
    expect(await ok.text()).toBe('12345');
    const bad = await fetch(`${base}/webhook?hub.mode=subscribe&hub.verify_token=nope&hub.challenge=1`);
    expect(bad.status).toBe(403);
  });
  it('hands a correctly signed payload to the listener', async () => {
    const got: unknown[] = [];
    const base = await start((p) => got.push(p));
    const body = JSON.stringify({ hello: 'world' });
    const res = await fetch(`${base}/webhook`, { method: 'POST', body, headers: { 'x-hub-signature-256': sign(body) } });
    expect(res.status).toBe(200);
    expect(got).toEqual([{ hello: 'world' }]);
  });
  it('rejects bad signatures and bad JSON without calling the listener', async () => {
    const got: unknown[] = [];
    const base = await start((p) => got.push(p));
    const body = JSON.stringify({ a: 1 });
    expect((await fetch(`${base}/webhook`, { method: 'POST', body, headers: { 'x-hub-signature-256': 'sha256=00' } })).status).toBe(401);
    const junk = 'not json';
    expect((await fetch(`${base}/webhook`, { method: 'POST', body: junk, headers: { 'x-hub-signature-256': sign(junk) } })).status).toBe(400);
    expect(got).toEqual([]);
  });
  it('rejects oversized bodies and unknown paths', async () => {
    const base = await start(() => {});
    const big = 'x'.repeat(1_100_000);
    const res = await fetch(`${base}/webhook`, { method: 'POST', body: big, headers: { 'x-hub-signature-256': sign(big) } }).catch(() => null);
    expect(res === null || res.status === 413).toBe(true);
    expect((await fetch(`${base}/other`)).status).toBe(404);
  });
  it('refuses to be created with an empty appSecret or verifyToken', () => {
    expect(() => createWebhookServer({ verifyToken: 'tok', appSecret: '', onPayload: () => {} })).toThrow(/appSecret/);
    expect(() => createWebhookServer({ verifyToken: '', appSecret: 'sec', onPayload: () => {} })).toThrow(/verifyToken/);
  });
  it('answers 400 to a malformed request target and keeps serving', async () => {
    const base = await start(() => {});
    const port = Number(new URL(base).port);
    const reply = await new Promise<string>((resolve, reject) => {
      const sock = net.connect(port, '127.0.0.1', () => sock.write('GET http://[ HTTP/1.1\r\nHost: x\r\n\r\n'));
      let data = '';
      sock.on('data', (d) => { data += d.toString('utf8'); sock.end(); });
      sock.on('close', () => resolve(data));
      sock.on('error', reject);
    });
    expect(reply.startsWith('HTTP/1.1 400')).toBe(true);
    const ok = await fetch(`${base}/webhook?hub.mode=subscribe&hub.verify_token=tok&hub.challenge=77`);
    expect(ok.status).toBe(200);
    expect(await ok.text()).toBe('77');
  });
});
