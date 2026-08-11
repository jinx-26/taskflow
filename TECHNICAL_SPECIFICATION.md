# TaskFlow — Technical Specification Report

## 1. Technology Catalog

### 1.1 Runtime & Language

| Technology | Version | Role |
|---|---|---|
| TypeScript | ~5.7.2 | Primary language across frontend and edge middleware |
| Node.js | 18+ (dev) | Build toolchain host |
| PostgreSQL | 15+ (via Supabase) | Primary data store |

**TypeScript — benefits:** full-stack type safety in one language; the
`src/types/index.ts` domain model is shared by contexts, services, and pages;
`tsconfig.app.json` / `tsconfig.node.json` split keeps build-time and
app-time types clean. **Drawbacks:** there is no generated DB-type pipeline
(e.g. `supabase gen types typescript`), so `UserProfile`, `Task`, etc. are
hand-maintained and can silently drift from the SQL schema — the
`data as UserProfile` casts in `AuthContext`/`fetchProfile` bypass the
compiler at exactly the trust boundary where errors matter most.
**Technical debt:** add schema-to-types generation to CI.

---

### 1.2 Frontend Framework & Build

#### React 18.3 (`react`, `react-dom`)
- **Context:** SPA with context-based auth (`AuthContext`), hooks, modals.
- **Benefits:** mature ecosystem; concurrent features available; team hiring pool is large.
- **Drawbacks:** no SSR/SEO (irrelevant for an internal tool, but means every
  route is client-rendered; initial auth check flashes a loading gate).
  State management relies on `useState`/`useContext` — fine at this scale,
  but cross-cutting state (profiles cache, online presence) has no single store,
  so invalidation is manual via React Query.

#### Vite 6
- **Benefits:** fast HMR dev loop; static env replacement
  (`import.meta.env.VITE_*`) which the codebase uses correctly — missing keys
  throw at startup instead of falling back to a hard-coded key.
- **Drawbacks:** env values are baked into the client bundle (by design) — the
  anon key is public; all security must come from RLS (see §3). Build output
  is a static SPA, so any "server logic" must live in Edge middleware or the DB.

#### React Router 6.28
- **Benefits:** declarative guards (`ProtectedRoute`, `RoleGuard`,
  `ApprovalGate`, `PublicRoute`) give a clean authorization matrix at the
  routing layer; layout routes separate `AuthLayout` from `AppLayout`.
- **Drawbacks:** SPA rewrites in `vercel.json` are required for deep links;
  the rewrite rules are duplicated/overlapping (two catch-all rules), which
  is a minor maintenance smell.

#### Tailwind CSS 3 + PostCSS + Autoprefixer
- **Benefits:** consistent design system, tiny production CSS via purging;
  light/dark mode supported.
- **Drawbacks:** utility-class sprawl in large page components (e.g.
  `Dashboard.tsx`, `Tasks.tsx`); no design tokens extracted.

#### clsx + tailwind-merge
- **Benefits:** idiomatic conditional class composition in the `ui/` primitives.
- **Drawbacks:** negligible — appropriate choice.

#### lucide-react 0.475
- **Benefits:** tree-shakeable SVG icons, no font assets.
- **Drawbacks:** none material.

#### Recharts 2.15
- **Benefits:** React-native charting for the Dashboard analytics (task status
  distribution, progress, workload) without a separate BI tool.
- **Drawbacks:** large bundle contribution (~100 kB gzipped with d3 deps);
  not lazily loaded, so every user pays the cost on first load.
  **Recommendation:** `React.lazy()` the Dashboard charts route.

#### TanStack React Query 5
- **Benefits:** server-state caching, background refetch, and mutation
  invalidation for tasks/notifications/announcements; removes an entire class
  of manual `useEffect` fetching bugs.
- **Drawbacks:** cache invalidation is manual — the services layer must
  remember to invalidate every affected key, and Realtime events can race the
  query cache (stale reads until refetch). **Debt:** define a central query-key
  factory to avoid key typos.

---

### 1.3 Backend (Supabase)

#### @supabase/supabase-js 2.48
- **Benefits:** one client for Auth, PostgREST queries, Realtime
  subscriptions, and Storage; session persistence + auto token refresh
  configured correctly in `lib/supabase.ts`.
- **Drawbacks:** all data access goes over the public anon key — correct *only
  because* RLS is enabled on every table. Any table created later without
  `ENABLE ROW LEVEL SECURITY` is a silent data-exposure hole. The client also
  hand-writes JSON queries, so there is no compile-time coupling to the schema.

#### Supabase Auth (GoTrue)
- **Benefits:** managed email/password auth, password-reset flows
  (`resetPasswordForEmail` with env-pinned redirect — good), session JWTs.
- **Drawbacks:** no MFA, no SSO/SAML (problematic for a corporate
  environment — see audit doc), no org-level password policy enforcement
  beyond client-side `lib/passwordPolicy.ts` (client-side policy is UX, not
  security).

#### PostgreSQL + RLS
- **Benefits:** authorization enforced at the data layer;
  `is_admin()` / `is_approved_user()` `SECURITY DEFINER` helpers centralize
  privileged checks; JSONB columns (`subtasks`, `comments`, `activity_log`)
  allow flexible task payloads without migrations.
- **Drawbacks (significant):**
  - **RLS policies are far too permissive.** Examples from
    `supabase_v2_clean_schema.sql`:
    - `profiles`: *"Authenticated users can update profiles" … `WITH CHECK (true)`*
      → any user can promote themselves to Admin. `supabase_security_patch.sql`
      appears to address some of this, but the clean schema ships insecure.
    - `tasks`: a single `FOR ALL` policy means anyone who can *see* a task can
      *update/delete* it.
    - `projects FOR ALL ... USING (is_approved_user())` → any approved member
      can edit any project.
    - `notifications`, `announcements INSERT`, `messsages FOR ALL`,
      `deletion_requests`: all `USING (true)`.
  - **Hard-coded master admin email** in `is_admin()`, `is_approved_user()`,
    `handle_new_user()`, and a schema step that `DELETE`s all other auth users.
  - **JSONB columns** (`co_assignees`, `comments`, `activity_log`) lose
    referential integrity, indexing, and per-field RLS; the tasks RLS policy
    does `jsonb_array_elements(co_assignees)` per row — unindexable, linear scan.
  - `tasks.due_date` is `TEXT` instead of `DATE/TIMESTAMPTZ`.
  - Missing indexes beyond PKs (no index on `assignee_id`, `project_id`,
    `notifications.recipient_email`, `messages.channel_id/created_at`).

#### Supabase Realtime
- **Benefits:** websocket push for chat, notifications, task updates with no
  separate pub/sub infrastructure; publication added for all key tables.
- **Drawbacks:** RLS applies to realtime only with explicit configuration —
  publication alone does not guarantee filtered delivery; Realtime throughput
  on lower Supabase tiers is connection-capped (~200 concurrent on free,
  500+ on Pro); the in-app chat (`messages` with `channel_id TEXT`) has no
  channel membership table, so "team channels" rely on client discipline.

#### Supabase Storage
- **Benefits:** zero-config file attachments bucket; integrated with auth.
- **Drawbacks:** bucket `task-attachments` is **`public = true`**, so files
  are reachable by anyone with the URL — combined with SELECT policy
  `bucket_id = 'task-attachments'` for all authenticated users, there is no
  per-task/per-project access control on attachments. No antivirus scanning,
  no size/MIME allowlist at the bucket level. For hardware specs/CAD exports
  this is a confidentiality gap.

---

### 1.4 Edge Layer (Vercel)

#### `middleware.ts` (Vercel Edge Runtime, standard Web APIs)
- **Benefits:** zero framework deps; UA bot blocklist, 10 kB body guard, and
  per-IP fixed-window rate limiting on `/login`, `/forgot-password`,
  `/reset-password`, `/api/*`; correct `Retry-After` / `X-RateLimit-*`
  headers.
- **Drawbacks (important):**
  - **In-memory `Map` store does not work on Edge.** Each edge isolate has its
    own memory and is recycled — limits are per-isolate, not global, and are
    defeated trivially by routing around a PoP. A distributed store (Upstash
    Redis, Vercel KV) is required for real enforcement.
  - The matcher covers `/login` etc., but **Supabase auth endpoints
    (`/auth/v1/token`) are called directly from the browser to Supabase** —
    the middleware never sees real login attempts. Actual brute-force
    protection must come from Supabase's own rate limits/CAPTCHA.
  - UA blocklist is easily spoofed and blocks legitimate API clients
    (curl/void UA → 403).
- **vercel.json headers:** strong — CSP, HSTS preload, `X-Frame-Options:
  DENY`, `nosniff`, restrictive Permissions-Policy. Minor: CSP allows
  `img-src https:` (broad) and `style-src 'unsafe-inline'` (needed by
  Tailwind/Google fonts); duplicate rewrite rules.

---

### 1.5 Dev Tooling

- **No test framework** (no Vitest/Jest/Playwright) — zero automated tests.
- **No linter/formatter config** (no ESLint/Prettier) despite TS.
- **No CI workflow** in the repo.
- **No error tracking** (Sentry etc.); errors are `console.error`.
- **`.env` is committed?** A `.env` file exists in the working tree — verify
  it is gitignored and contains only the publishable anon key (it must never
  contain the service-role key).

---

## 2. Benefits vs. Drawbacks Summary

| Area | Key Benefit | Key Drawback / Debt |
|---|---|---|
| React SPA | Fast dev, rich UX | No SSR; per-page bundle bloat (Recharts) |
| Supabase BaaS | Backend without servers; RLS at DB | Public anon-key trust model; permissive policies; public storage bucket |
| Postgres RLS | Single source of truth for authz | Policies written broadly (`USING (true)`); self-escalation to Admin possible in clean schema |
| JSONB task fields | Flexible payloads | No integrity, no indexing, slow RLS predicate |
| Realtime | Live chat/notifications for free | Connection caps; channel security by convention |
| Edge middleware | Cheap bot/rate protection | In-memory store ineffective at edge; doesn't cover real auth endpoint |
| React Query | Robust server-state cache | Manual invalidation; no key factory |
| TypeScript | Type safety | No generated DB types; trust-boundary casts |

## 3. Consolidated Technical Debt Register (priority ordered)

1. **RLS tightening** — least-privilege rewrite of all policies (profiles UPDATE
   restricted to own row / admin-only role changes; split task SELECT vs
   UPDATE vs DELETE policies; scope storage access).
2. **Private storage bucket + signed URLs** for attachments.
3. **Remove hard-coded master-admin email** — replace with an `app_settings`
   table or claims-based check; remove the destructive `DELETE FROM auth.users`.
4. **Distributed rate limiting** (Upstash/Vercel KV) or remove edge limiter and
   rely on Supabase auth protections + Turnstile CAPTCHA.
5. **SSO/MFA for corporate deployment** (Supabase supports SAML SSO on Pro+).
6. **Normalize JSONB columns** (subtasks, comments, activity_log, co_assignees)
   into tables; fix `tasks.due_date` type; add missing indexes.
7. **Generate TS types from the schema** in CI; add ESLint + Vitest + a CI
   workflow.
8. **Lazy-load Recharts**; audit bundle.
9. **Observability** — error tracking, audit log table for admin actions
   (beyond task-scoped `activity_log`).
