export class Batcher {
  private buf = new Map<string, { texts: string[]; timer: NodeJS.Timeout }>();
  constructor(private quietMs: number, private onFlush: (key: string, texts: string[]) => void) {}

  push(key: string, text: string): void {
    const existing = this.buf.get(key);
    const texts = existing ? existing.texts : [];
    if (existing) clearTimeout(existing.timer);
    texts.push(text);
    const timer = setTimeout(() => this.flush(key), this.quietMs);
    this.buf.set(key, { texts, timer });
  }
  private flush(key: string): void {
    const e = this.buf.get(key);
    if (!e) return;
    clearTimeout(e.timer);
    this.buf.delete(key);
    this.onFlush(key, e.texts);
  }
  flushAll(): void { for (const key of [...this.buf.keys()]) this.flush(key); }
  dispose(): void {
    for (const e of this.buf.values()) clearTimeout(e.timer);
    this.buf.clear();
  }
}
