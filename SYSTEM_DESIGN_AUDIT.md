# TaskFlow — System Design Audit

**Reviewer role:** Senior System Design Engineer
**Target deployment:** mid-sized corporate environment, 100–200 employees
(internal engineering org with PCB/hardware/firmware workflows, per the schema
metadata), deployed on Vercel + Supabase.
**Scope:** `E:\TaskFlow` — React SPA, Vercel Edge middleware, Supabase
(Postgres, Auth, Realtime, Storage).

---

## 0. Executive Summary

| Dimension | Score (1–5) | Verdict for 100–200 employees |
|---|---|---|
| Scalability | 3.5 | Comfortable headroom on infrastructure; risky only in RLS query cost and Realtime caps |
| Reliability | 3.0 | Managed backend absorbs most failures; no error tracking, no tests, single-person admin bootstrap |
| Maintainability | 2.5 | Readable modular code, but no tests/lint/CI, dual schema files, hand-maintained types |
| Security | 2.0 → 3.5 after patch | The *clean schema* RLS is dangerously permissive; `supabase_security_patch.sql` fixes the worst of it — **verifying the patch is applied in production is the #1 action item** |

TaskFlow is a well-organized, thoughtfully built internal tool with
genuinely good security instincts at the edge/header layer (CSP, HSTS, env-key
hygiene, client + edge rate limiting, approval-gated routes). Its critical
weakness is that **authorization correctness depends entirely on RLS policies
that ship in a permissive state**, plus a hard-coded personal Gmail as the
admin bootstrap — unacceptable in a corporate context. None of the gaps are
architectural dead ends; all are fixable with focused effort.

---

## 1. Architecture Overview (as found)

```
Browser (React SPA, static on Vercel CDN)
  │  HTTPS/WSS                        ┌─ Vercel Edge middleware: bot UA block,
  │                                   │  10 kB body guard, in-memory rate limit
  ▼                                   │  on /login, /forgot-password, /api/*
Supabase (single project)  ◄──────────┘
  ├─ Auth (email/password, reset links)
  ├─ Postgres + RLS: profiles, departments, teams, projects, tasks,
  │    project_members, announcements, messages, notifications,
  │    deletion_requests — 4-tier RBAC (Admin, Manager, Lead, Member),
  │    approval workflow (Pending/Approved/Rejected/Suspended)
  ├─ Realtime publication: tasks, notifications, profiles, announcements,
  │    messages, teams
  └─ Storage: `task-attachments` bucket (PUBLIC)
```

Key design decisions observed:
- **Database-as-API:** no custom backend; the supabase-js client with the
  anon key + RLS is the entire API layer.
- **Privacy model:** projects visible only to creator/members; tasks visible
  to assignee/creator/co-assignees/project members.
- **UX-layer defenses:** client-side login back-off
  (`lib/rateLimiter.ts`, exponential 10/30/60/120 s), password policy module,
  approval gate route — explicitly documented as defense-in-depth, which is
  the right framing.

---

## 2. Scalability (100–200 users)

**Load profile:** ~200 registered users, realistically 30–60 concurrent.
That is well within any Supabase Pro tier and Vercel's free/Pro band.

**Strengths**
- Stateless SPA served from a global CDN — horizontal scaling is free.
- Managed Postgres with connection pooling; table sizes will stay trivial
  (even 100k tasks/year is small).
- Realtime multiplexing via one client connection per user.

**Weaknesses / risks**
1. **RLS predicate cost.** The tasks policy evaluates
   `jsonb_array_elements(co_assignees)` per row and a `project_members`
   EXISTS subquery per row, and `is_admin()`/`SECURITY DEFINER` functions run
   per row. At current scale this is fine, but these predicates prevent index
   usage and will degrade superlinearly. Also **no non-PK indexes exist** —
   add indexes on `tasks(assignee_id)`, `tasks(project_id)`,
   `notifications(recipient_email)`, `messages(channel_id, created_at)`,
   `project_members(user_id)`.
2. **Realtime connection caps.** Free tier ≈ 200 concurrent connections; at
   60 concurrent plus background tabs you can brush the limit. Plan: Pro tier
   (~500 concurrent) and/or gate subscriptions to visible channel only.
3. **In-memory edge rate limiter** does not scale horizontally or persist
   (isolates are recycled) — limits are effectively per-PoP.
4. **Notifications fan-out by email string** (`recipient_email TEXT`) rather
   than FK to profiles — no index; fine now, awkward later.

**Verdict:** scalable to the target with a Supabase Pro plan and minor
indexing work. No re-architecture needed.

---

## 3. Reliability

**Strengths**
- Supabase handles DB backups/replication; Vercel handles CDN availability;
  session auto-refresh and persistence are correctly configured.
- Graceful degradation patterns: localStorage offline fallback for
  notifications (capped), fail-open rate limiter, defensive profile defaults
  when the trigger hasn't run yet.

**Weaknesses**
1. **No automated tests at all** — a task-approval or RLS regression ships
   silently. For a corporate tool this is the largest reliability gap.
2. **No error tracking/alerting.** All failures go to `console.error`. You
   will learn about production breakage from user complaints.
3. **Single point of administrative failure:** the system bootstraps and
   reports signup requests to one personal Gmail; the clean schema even
   `DELETE`s all other auth users on (re)application. If that mailbox/user is
   lost, recovery is manual SQL.
4. **Realtime single-channel subscriptions with no retry/backoff visibility**
   (moderate — supabase-js retries internally, but the UI has no
   connectivity indicator).
5. **Destructive schema scripts in-repo** (`supabase_v2_clean_schema.sql`
   drops tables and users) risk being run against production.

**Recommendations:** add Vitest + a handful of RLS integration tests
(via `pgTAP` or supabase-js service-role harness in CI); Sentry or Logflare;
a second bootstrap admin; move schema migrations to `supabase migration`
files; add an audit-log table for admin actions (approvals, role changes,
deletions).

---

## 4. Maintainability

**Strengths**
- Clean separation: `services/` data layer, `routes/` guards, `contexts/`
  auth, `types/` domain model; small atomic `ui/` primitives; consistent
  naming; good inline comments explaining *why* (rate limiter, middleware).
- Security patch shipped as an idempotent, well-commented SQL file —
  evidence of a real hardening pass (also visible in git history:
  "fixed lots of security bugs").

**Weaknesses**
1. **Three overlapping schema sources of truth** (`supabase/schema.sql`,
   `supabase_v2_clean_schema.sql`, `supabase_security_patch.sql`) — which is
   live? Consolidate into versioned migrations.
2. **No generated DB types; pervasive `as Type` casts** at the
   supabase-js boundary — schema drift will not be caught by `tsc`.
3. JSONB columns (`subtasks`, `comments`, `activity_log`, `co_assignees`,
   `pending_invitations`) make task logic stringly-typed and queries
   awkward; `tasks.due_date` is `TEXT`.
4. No ESLint/Prettier/CI; no `.env.example` (`.env` exists in tree — confirm
   it's gitignored and contains only the anon key).
5. Messy bits: duplicate rewrite rule in `vercel.json`, unused-looking
   `dist/` committed? / legacy `supabase_schema.sql` at root.

---

## 5. Security

**Strong points (genuinely good)**
- Strict security headers incl. CSP restricting `connect-src` to Supabase
  domains, HSTS preload, `frame-ancestors 'none'`.
- Edge middleware: bot UA filtering, body-size guard, path-scoped matcher,
  per-rule rate limits with proper headers.
- Client exponential backoff on failed logins; server-stated expectation
  that Supabase Auth enforces real limits.
- Approval workflow: new signups are `Pending`, gated client-side
  (`ApprovalGate`) and server-side (RLS).
- No service-role key anywhere in client code; env vars validated at startup.
- Security patch removes hard-coded email from privilege helpers, stops
  trusting client-supplied `raw_user_meta_data->>'role'` in the signup
  trigger (anti role-escalation), and pins `search_path` on SECURITY
  DEFINER functions — this is competent Postgres security work.

**Critical/high findings**
1. **[CRITICAL — if patch not applied] Clean schema profile policy allows
   any authenticated user to UPDATE any profile, including their own
   `role='Admin'` and `status='Approved'`.** Self-escalation = full
   compromise. Similarly broad: `WITH CHECK (true)` INSERT/DELETE policies
   on profiles, `tasks FOR ALL` single policy, `projects/departments/teams
   FOR ALL USING (is_approved_user())`, and `storage.objects`.
   *Action: confirm `supabase_security_patch.sql` (or stricter) is the
   deployed state; then add SELECT/UPDATE/DELETE-specific policies.*
2. **[HIGH] `task-attachments` bucket is public** (`public = true`) —
   any URL holder can fetch files; SELECT policy grants all authenticated
   users everything in the bucket. Hardware specs and project docs should be
   a **private bucket with signed URLs** scoped per task/project membership.
3. **[HIGH] Hard-coded personal Gmail as bootstrap admin** in triggers and
   (pre-patch) RLS helpers, plus a SQL step deleting all other users. Use a
   corporate alias; store bootstrap config outside code; never ship
   destructive statements in setup scripts.
4. **[MED] No MFA / no SSO.** For a corporate environment, Supabase Pro SAML
   SSO (or enforcing MFA via authenticator app) is expected baseline; the
   password-policy module is client-side only.
5. **[MED] Rate limiting reality:** real auth attempts go browser →
   `*.supabase.co/auth/v1/token`, never touching the Vercel middleware. Edge
   limits only guard the SPA pages and (nonexistent) `/api` routes. Enable
   Supabase CAPTCHA/Turnstile on sign-in/sign-up and rely on its built-in
   throttling.
6. **[MED] Email addresses as logical keys** (`notifications.recipient_email`)
   and full company directory visible to all authenticated users
   (`profiles SELECT USING (true)`) — acceptable for internal tools but
   note the privacy posture; pending users can see the directory.
7. **[LOW] CSP is mostly tight** but `style-src 'unsafe-inline'` and broad
   `img-src https:` weaken it; `messages.content`/`comments` are JSONB rendered
   in React (React escapes by default — verify no `dangerouslySetInnerHTML`;
   grep showed none).
8. **[LOW] `.env` in working tree** — verify gitignore coverage; ensure it
   never contains service-role credentials.

---

## 6. Actionable Recommendations (priority ordered)

**P0 — this week**
1. Verify the security patch is applied in production DB; write explicit
   per-action RLS policies (own-profile updates only; role/status changes
   admin-only; task UPDATE restricted to assignee/creator/lead+).
2. Make `task-attachments` private; signed URLs with 15-min expiry;
   add per-object policies keyed to task membership (path prefix
   `projectId/taskId/`).
3. Replace the hard-coded bootstrap email with a corporate alias and gate it
   behind an `is_bootstrap` check in exactly one place (patch already moves
   this direction); **remove the `DELETE FROM auth.users` statement** from
   setup scripts.

**P1 — this quarter**
4. Supabase Pro plan (realtime headroom, SAML SSO). Enforce MFA for
   Admin/Manager roles; add Turnstile to auth forms.
5. Consolidate schemas into `supabase/migrations/*`; add
   `supabase gen types` to CI; remove `as` casts.
6. Add CI: typecheck, ESLint, Vitest unit tests for guards/policies, and an
   RLS smoke-test suite run against a seeded Supabase instance.
7. Add missing indexes (§2.1); convert `tasks.due_date TEXT → TIMESTAMPTZ`;
   normalize `subtasks`/`comments`/`activity_log` out of JSONB when touched next.
8. Observability: Sentry for the SPA; Supabase Logflare drains; an
   `audit_log` table for admin actions; second admin account.

**P2 — hardening**
9. Real distributed rate limiting for any future `/api/*` routes (Upstash KV);
   drop or keep edge limiter as hygiene only.
10. Lazy-load Dashboard/Recharts; add bundle budgets to CI.
11. Add a connectivity indicator + single shared Realtime channel manager.
12. Rotation/backup runbook; periodic access review for suspended/rejected
    accounts; document the RLS model in the README.

---

## 7. Overall Assessment

TaskFlow's *shape* is right for its size: a BaaS-backed SPA with
database-enforced authorization, which minimizes operational burden for a
100–200-person company. The gap between "well-intentioned" and "safe" is
concentrated in three places: **RLS policy tightness, attachment privacy, and
the personal-email admin bootstrap.** Fix P0 and the system is defensible for
internal corporate use; P1 items move it from "functional internal tool" to
"maintainable corporate asset."
