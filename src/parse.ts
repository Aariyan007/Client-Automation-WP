export interface IncomingMessage { id: string; from: string; type: string; text: string | null }

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

export function parseWebhook(payload: unknown): IncomingMessage[] {
  const out: IncomingMessage[] = [];
  if (!isObj(payload)) return out;
  for (const entry of arr(payload.entry)) {
    if (!isObj(entry)) continue;
    for (const change of arr(entry.changes)) {
      if (!isObj(change) || !isObj(change.value)) continue;
      for (const m of arr(change.value.messages)) {
        if (!isObj(m) || typeof m.id !== 'string' || typeof m.from !== 'string') continue;
        const type = typeof m.type === 'string' ? m.type : 'unknown';
        const body = isObj(m.text) && typeof m.text.body === 'string' ? m.text.body : null;
        out.push({ id: m.id, from: m.from, type, text: type === 'text' ? body : null });
      }
    }
  }
  return out;
}
