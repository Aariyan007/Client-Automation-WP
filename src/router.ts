import type { IncomingMessage } from './parse.js';
import type { Registry } from './config.js';

export type Route =
  | { kind: 'drop' }
  | { kind: 'unsupported'; folder: string; type: string }
  | { kind: 'accept'; folder: string; text: string };

export function route(msg: IncomingMessage, registry: Registry): Route {
  const folder = registry[msg.from.replace(/\D/g, '')];
  if (!folder) return { kind: 'drop' };
  if (msg.type !== 'text' || !msg.text) return { kind: 'unsupported', folder, type: msg.type };
  return { kind: 'accept', folder, text: msg.text };
}
