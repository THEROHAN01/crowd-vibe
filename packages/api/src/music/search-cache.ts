interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export class SearchCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private ttlMs: number;
  private cleanupTimer: ReturnType<typeof setInterval>;

  constructor(ttlMinutes: number = 15) {
    this.ttlMs = ttlMinutes * 60 * 1000;
    // Sweep expired entries every 5 minutes
    this.cleanupTimer = setInterval(() => this.sweep(), 5 * 60 * 1000);
    this.cleanupTimer.unref();
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  set<T>(key: string, data: T): void {
    this.cache.set(key, { data, expiresAt: Date.now() + this.ttlMs });
  }

  makeKey(provider: string, query: string): string {
    return `${provider}:${query.toLowerCase().trim()}`;
  }

  destroy() {
    clearInterval(this.cleanupTimer);
  }

  private sweep() {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) this.cache.delete(key);
    }
  }
}

const globalForCache = globalThis as unknown as { searchCache: SearchCache };
export const searchCache =
  globalForCache.searchCache ?? new SearchCache(15);
globalForCache.searchCache = searchCache;
