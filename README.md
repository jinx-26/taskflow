# TaskFlow

TaskFlow is an internal task and project management application for engineering
teams (hardware, firmware, mechanical, QA). It provides role-based task
tracking, project organization, team/department structure, realtime team chat,
company announcements, notifications, and file attachments — delivered as a
React single-page application backed by Supabase.

## Features

- **Task management** — Kanban-style statuses (Backlog → Todo → In Progress →
  In Review → Done), priorities, subtasks, co-assignees, blocking dependencies,
  time estimates/logged hours, and hardware-specific metadata (issue type, part
  number, hardware revision, test result).
- **Projects** — grouped tasks with progress tracking and per-project member
  privacy (users only see projects they created or are members of).
- **4-tier RBAC** — Admin, Manager, Lead, Member, with an account approval
  workflow (Pending / Approved / Rejected / Suspended) enforced at the
  database level.
- **Teams & departments** — organizational hierarchy with team leads and
  department managers.
- **Realtime collaboration** — team channel chat, company announcements, and
  live notifications via Supabase Realtime (WebSockets).
- **File attachments** — PDF/Excel/Word specs stored in a Supabase Storage
  bucket (`task-attachments`).
- **Manager approval gates** — tasks can require manager sign-off; account
  deletion goes through a request/approval flow.
- **Security hardening** — Vercel Edge middleware with rate limiting, bot
  filtering, body-size guards, and strict security headers (CSP, HSTS,
  X-Frame-Options, etc.).

## Tech Stack

| Layer        | Technology |
|--------------|------------|
| Frontend     | React 18, TypeScript, Vite 6, Tailwind CSS 3 |
| Routing      | React Router 6 |
| Data fetching| TanStack React Query 5 |
| Backend      | Supabase (PostgreSQL, Auth, Row Level Security, Realtime, Storage) |
| Charts       | Recharts |
| Icons        | lucide-react |
| Hosting/Edge | Vercel (static SPA + Edge middleware) |

## Prerequisites

- Node.js 18+ and npm
- A Supabase project (free tier works for development)

## Installation

```bash
git clone <repo-url>
cd TaskFlow
npm install
```

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
VITE_RESET_REDIRECT_URL=https://<your-domain>/reset-password
```

The app throws at startup if the Supabase variables are missing — there are no
hard-coded fallbacks.

## Database Setup

The schema is a versioned migration history under `supabase/migrations/`:

```
00000000000000_baseline_schema.sql           — full v2 schema + security patch
20260811005549_phase1_authz_hardening.sql    — least-privilege RLS, privilege
                                               trigger, admin_set_profile_role(),
                                               app_settings bootstrap
20260811005630_phase2_private_attachments.sql— private storage, project-scoped
                                               path policies
20260811010100_phase4_audit_log.sql          — audit_log + wiring
```

Fresh setup: run the files in order in the Supabase SQL editor (or
`npx supabase db push` once the CLI is linked to the project). All files
are idempotent (`DROP IF EXISTS` / `CREATE OR REPLACE`), so re-running is safe.

Before first deploy, change the bootstrap admin identity in the database:

```sql
UPDATE public.app_settings
SET value = 'admin@yourcompany.com'
WHERE key = 'bootstrap_admin_email';
```

## Security Model Notes

- Role/status changes happen ONLY via `supabase.rpc('admin_set_profile_role', …)`
  (admin-only, audited). Direct client UPDATEs to those columns are silently
  reverted by the `protect_profile_privileges` trigger.
- Attachments live in a private bucket; files are served as 15-minute signed
  URLs via `src/lib/attachments.ts`, path-scoped to `<projectId>/<taskId>/`.
- Admin/Manager accounts are forced through TOTP MFA (AAL2) by
  `src/routes/MfaGuard.tsx`; enrollment UI is on the Settings page.
- Turnstile CAPTCHA is enabled by setting `VITE_TURNSTILE_SITE_KEY` (and
  turning on Captcha in Supabase → Authentication → Attack Protection).
- Error reporting activates when `VITE_SENTRY_DSN` is set.


## Usage

```bash
npm run dev       # start the Vite dev server
npm run build     # type-check (tsc) and build for production into dist/
npm run preview   # preview the production build locally
```

### First run

1. Sign up with the master-admin email — it is auto-approved with the Admin role.
2. All other signups land in **Pending** status and the admin receives an
   in-app notification.
3. Approve users and assign roles/teams from the **Admin Panel**.
4. Create departments, teams, projects, and start assigning tasks.

## Architecture Overview

```
┌────────────────────────────────────────────────────────────┐
│ Vercel Edge                                                │
│  middleware.ts — rate limiting, bot UA block, body guard   │
│  vercel.json  — security headers (CSP/HSTS), SPA rewrites  │
└──────────────────────────┬─────────────────────────────────┘
                           │ HTTPS / WSS
┌──────────────────────────▼─────────────────────────────────┐
│ React SPA (Vite build, static)                             │
│  routes/      ProtectedRoute, RoleGuard, ApprovalGate      │
│  contexts/    AuthContext (session + profile + role)       │
│  services/    taskService, announcementService,            │
│               notificationService                          │
│  pages/       Dashboard, Tasks, Projects, Teams, Calendar, │
│               Admin Panel, Chat/Announcements, Settings    │
└──────────────────────────┬─────────────────────────────────┘
                           │ supabase-js (anon key + RLS)
┌──────────────────────────▼─────────────────────────────────┐
│ Supabase                                                   │
│  Postgres — profiles, departments, teams, projects, tasks, │
│             messages, announcements, notifications,        │
│             deletion_requests (RLS on every table)         │
│  Auth     — email/password, password reset                 │
│  Realtime — websocket publication for chat/tasks/notifs    │
│  Storage  — task-attachments bucket                        │
└────────────────────────────────────────────────────────────┘
```

**Authorization model:** the database is the single source of truth. Postgres
Row Level Security policies (with `SECURITY DEFINER` helpers `is_admin()` /
`is_approved_user()`) gate every read/write. Client-side route guards
(`RoleGuard`, `ApprovalGate`) are a UX convenience only.

**State/data flow:** UI components call service modules
(`src/services/*.ts`), which use React Query for caching/invalidation and the
supabase-js client for queries; Realtime subscriptions keep chat,
notifications, and task views live.

## Project Structure

```
├── middleware.ts            # Vercel Edge middleware (rate limit, bot block)
├── vercel.json              # Security headers + SPA rewrites
├── supabase_v2_clean_schema.sql   # Full production schema (destructive)
├── supabase_security_patch.sql    # Non-destructive security patch
├── src/
│   ├── components/          # common UI + modals
│   ├── contexts/AuthContext.tsx
│   ├── hooks/               # useAuth
│   ├── layouts/             # AppLayout, AuthLayout
│   ├── lib/                 # supabase client, password policy, rate limiter
│   ├── pages/               # route pages
│   ├── routes/              # ProtectedRoute, RoleGuard, ApprovalGate
│   ├── services/            # data access layer
│   └── types/               # shared TypeScript types
└── supabase/schema.sql      # original schema (legacy)
```

## Documentation

- [Technical Specification](TECHNICAL_SPECIFICATION.md) — full technology
  catalog with benefits/drawbacks per dependency.
- [System Design Audit](SYSTEM_DESIGN_AUDIT.md) — architecture evaluation and
  recommendations for a 100–200 employee deployment.
