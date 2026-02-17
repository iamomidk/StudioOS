export function parseCsvAllowlist(raw: string): string[] {
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

export function isOriginAllowed(origin: string | undefined, allowlist: string[]): boolean {
  if (!origin) {
    return true;
  }

  if (allowlist.length === 0) {
    return true;
  }

  return allowlist.includes(origin);
}

interface RateLimitEntry {
  count: number;
  windowStartMs: number;
}

export class MemoryRateLimiter {
  private readonly store = new Map<string, RateLimitEntry>();

  constructor(
    private readonly maxRequests: number,
    private readonly ttlSeconds: number,
    private readonly nowProvider: () => number = () => Date.now()
  ) {}

  check(key: string): { allowed: boolean; retryAfterSeconds: number } {
    const now = this.nowProvider();
    const windowMs = this.ttlSeconds * 1000;
    const current = this.store.get(key);

    if (!current || now - current.windowStartMs >= windowMs) {
      this.store.set(key, { count: 1, windowStartMs: now });
      return { allowed: true, retryAfterSeconds: this.ttlSeconds };
    }

    if (current.count >= this.maxRequests) {
      const remainingMs = Math.max(0, windowMs - (now - current.windowStartMs));
      return { allowed: false, retryAfterSeconds: Math.ceil(remainingMs / 1000) };
    }

    current.count += 1;
    this.store.set(key, current);
    const remainingMs = Math.max(0, windowMs - (now - current.windowStartMs));
    return { allowed: true, retryAfterSeconds: Math.ceil(remainingMs / 1000) };
  }
}
