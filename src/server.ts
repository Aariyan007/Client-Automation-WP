import http from 'node:http';
import { safeEqual, verifySignature } from './signature.js';

export interface ServerOptions {
  verifyToken: string;
  appSecret: string;
  onPayload: (payload: unknown) => void;
}
const MAX_BODY = 1_000_000;

export function createWebhookServer(opts: ServerOptions): http.Server {
  if (!opts.appSecret) throw new Error('appSecret must not be empty (an empty HMAC key makes signatures forgeable)');
  if (!opts.verifyToken) throw new Error('verifyToken must not be empty');
  return http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname !== '/webhook') { res.writeHead(404).end(); return; }

    if (req.method === 'GET') {
      const token = url.searchParams.get('hub.verify_token') ?? '';
      const challenge = url.searchParams.get('hub.challenge') ?? '';
      if (url.searchParams.get('hub.mode') === 'subscribe' && safeEqual(token, opts.verifyToken)) {
        res.writeHead(200, { 'content-type': 'text/plain' }).end(challenge);
      } else {
        res.writeHead(403).end();
      }
      return;
    }

    if (req.method !== 'POST') { res.writeHead(405).end(); return; }

    const chunks: Buffer[] = [];
    let size = 0;
    let rejected = false;
    req.on('data', (c: Buffer) => {
      if (rejected) return;
      size += c.length;
      if (size > MAX_BODY) {
        rejected = true;
        res.writeHead(413, { connection: 'close' }).end();
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (rejected) return;
      const raw = Buffer.concat(chunks);
      if (!verifySignature(raw, req.headers['x-hub-signature-256'] as string | undefined, opts.appSecret)) {
        res.writeHead(401).end();
        return;
      }
      let payload: unknown;
      try { payload = JSON.parse(raw.toString('utf8')); } catch { res.writeHead(400).end(); return; }
      try { opts.onPayload(payload); } catch { /* never fail the webhook; Meta would retry */ }
      res.writeHead(200).end();
    });
  });
}
