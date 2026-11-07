export class RateLimiter {
  private hits = new Map<string, number[]>();
  constructor(private windowMs: number, private now: () => number = Date.now) {}
  tryAcquire(key: string, max: number): boolean {
    const t = this.now();
    const recent = (this.hits.get(key) ?? []).filter((x) => t - x < this.windowMs);
    if (recent.length >= max) { this.hits.set(key, recent); return false; }
    recent.push(t);
    this.hits.set(key, recent);
    return true;
  }
}
