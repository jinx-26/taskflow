/**
 * Vercel Edge Middleware — Rate Limiting & Bot Protection
 *
 * Built with standard Web APIs (Request / Response) — zero external framework
 * dependencies (compatible with Vite/React apps on Vercel Edge Runtime).
 */

export const config = {
  // Only run middleware on these paths — keeps overhead minimal everywhere else.
  matcher: ['/login', '/forgot-password', '/reset-password', '/api/:path*'],
};

// ─── Rate limit configuration ────────────────────────────────────────────────

interface RateLimitRule {
  windowMs: number; // window duration in milliseconds
  maxRequests: number; // max requests per IP per window
}

const RULES: Record<string, RateLimitRule> = {
  '/login':            { windowMs: 60_000, maxRequests: 15 },
  '/forgot-password':  { windowMs: 300_000, maxRequests: 5 },
  '/reset-password':   { windowMs: 300_000, maxRequests: 5 },
  '/api':              { windowMs: 60_000, maxRequests: 30 },
};

// ─── In-memory store ─────────────────────────────────────────────────────────

interface WindowEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, WindowEntry>();

function pruneStore() {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt < now) store.delete(key);
  }
}

let lastPrune = Date.now();
const PRUNE_INTERVAL_MS = 120_000;

// ─── Bot / UA block list ─────────────────────────────────────────────────────

const BAD_BOT_PATTERNS = [
  /python-requests/i,
  /go-http-client/i,
  /java\/\d/i,
  /curl\//i,
  /wget\//i,
  /scrapy/i,
  /libwww-perl/i,
  /\bbot\b/i,
  /\bcrawler\b/i,
  /\bspider\b/i,
];

function isBotUA(ua: string | null): boolean {
  if (!ua || ua.trim().length === 0) return true;
  return BAD_BOT_PATTERNS.some((re) => re.test(ua));
}

// ─── Middleware Entrypoint ───────────────────────────────────────────────────

export default function middleware(request: Request): Response {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // ── 1. Bot / UA check ────────────────────────────────────────────────────
  const ua = request.headers.get('user-agent');
  if (isBotUA(ua)) {
    return new Response('Forbidden', {
      status: 403,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  // ── 2. Oversized body guard ──────────────────────────────────────────────
  const contentLength = request.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > 10_240) {
    return new Response('Payload Too Large', {
      status: 413,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  // ── 3. Rate limiting ─────────────────────────────────────────────────────
  const ruleKey = Object.keys(RULES).find((prefix) =>
    pathname === prefix || pathname.startsWith(prefix + '/')
  );

  if (ruleKey) {
    const rule = RULES[ruleKey];

    const ip =
      request.headers.get('x-real-ip') ??
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
      'unknown';

    const key = `${ip}::${ruleKey}`;
    const now = Date.now();

    if (now - lastPrune > PRUNE_INTERVAL_MS) {
      pruneStore();
      lastPrune = now;
    }

    const entry = store.get(key);

    if (!entry || entry.resetAt < now) {
      store.set(key, { count: 1, resetAt: now + rule.windowMs });
    } else {
      entry.count += 1;
      if (entry.count > rule.maxRequests) {
        const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
        return new Response('Too Many Requests', {
          status: 429,
          headers: {
            'Content-Type': 'text/plain',
            'Retry-After': String(retryAfter),
            'X-RateLimit-Limit': String(rule.maxRequests),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.ceil(entry.resetAt / 1000)),
          },
        });
      }
    }
  }

  // ── Pass through ─────────────────────────────────────────────────────────
  return new Response(null, {
    headers: {
      'x-middleware-next': '1',
    },
  });
}
