export class KeyedQueue {
  private tails = new Map<string, Promise<unknown>>();

  run<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.tails.get(key) ?? Promise.resolve();
    const next = prev.catch(() => undefined).then(fn);
    this.tails.set(key, next);
    next
      .finally(() => { if (this.tails.get(key) === next) this.tails.delete(key); })
      .catch(() => undefined);
    return next;
  }

  async idle(): Promise<void> {
    while (this.tails.size > 0) await Promise.allSettled([...this.tails.values()]);
  }
}
