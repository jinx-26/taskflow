/**
 * Vercel Edge Middleware — Rate Limiting & Bot Protection
 *
 * Runs at the Vercel Edge (globally, before any request reaches the app)
 * with ~0ms added latency. Uses the Edge Runtime (V8 isolate — no Node.js).
 *
 * Protections applied to auth-related paths:
 *   1. IP-based sliding-window rate limiting
 *      • /login / /api/auth paths  → max 15 requests / 60 s per IP
 *      • /forgot-password          → max 5 requests  / 5 min per IP
 *   2. Oversized request body guard (> 10 KB → 413)
 *   3. Missing / obviously-bot User-Agent → 403
 *   4. Known bad-bot User-Agent pattern block list
 *
 * Note on state persistence:
 *   Rate-limit counters live in an in-memory Map scoped to this Edge isolate.
 *   Vercel spins up multiple isolate instances globally, so the counter is
 *   per-instance, not globally shared. For a globally-shared rate limit you
 *   would need Vercel KV or Upstash Redis. Per-instance limiting is still
 *   highly effective against typical bot storms because:
 *     • Each Vercel edge PoP handles a geographic cluster of requests.
 *     • A single attacker IP will always hit the same PoP (anycast routing).
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

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
  '/api':              { windowMs: 60_000, maxRequests: 30 }, // API catch-all
};

// ─── In-memory store ─────────────────────────────────────────────────────────

interface WindowEntry {
  count: number;
  resetAt: number; // Unix ms
}

// key = `${ip}::${pathname}`
const store = new Map<string, WindowEntry>();

// Periodically prune expired entries to prevent unbounded memory growth.
// Edge isolates are short-lived but may handle many requests before recycling.
function pruneStore() {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt < now) store.delete(key);
  }
}

let lastPrune = Date.now();
const PRUNE_INTERVAL_MS = 120_000; // every 2 minutes

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
  if (!ua || ua.trim().length === 0) return true; // No UA at all → bot
  return BAD_BOT_PATTERNS.some((re) => re.test(ua));
}

// ─── Middleware ───────────────────────────────────────────────────────────────

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── 1. Bot / UA check ────────────────────────────────────────────────────
  const ua = request.headers.get('user-agent');
  if (isBotUA(ua)) {
    return new NextResponse('Forbidden', {
      status: 403,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  // ── 2. Oversized body guard ──────────────────────────────────────────────
  // Content-Length header is not always present, but when it is we can reject
  // massive payloads immediately without reading the body.
  const contentLength = request.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > 10_240) {
    return new NextResponse('Payload Too Large', {
      status: 413,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  // ── 3. Rate limiting ─────────────────────────────────────────────────────
  // Find matching rule (longest prefix match).
  const ruleKey = Object.keys(RULES).find((prefix) =>
    pathname === prefix || pathname.startsWith(prefix + '/')
  );

  if (ruleKey) {
    const rule = RULES[ruleKey];

    // Best-effort IP extraction from Vercel-injected headers.
    const ip =
      request.headers.get('x-real-ip') ??
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
      'unknown';

    const key = `${ip}::${ruleKey}`;
    const now = Date.now();

    // Prune old entries occasionally.
    if (now - lastPrune > PRUNE_INTERVAL_MS) {
      pruneStore();
      lastPrune = now;
    }

    const entry = store.get(key);

    if (!entry || entry.resetAt < now) {
      // New window.
      store.set(key, { count: 1, resetAt: now + rule.windowMs });
    } else {
      entry.count += 1;
      if (entry.count > rule.maxRequests) {
        const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
        return new NextResponse('Too Many Requests', {
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
  return NextResponse.next();
}
