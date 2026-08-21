# TaskFlow — Self-Hosting Migration Package

Context: TaskFlow is a React (Vite) SPA deployed on Vercel, backed by Supabase
(PostgreSQL, GoTrue Auth, Storage, RLS, Realtime). The target is the client's
private infrastructure. This document contains (1) a client questionnaire and
(2) a step-by-step migration plan.

Key architectural note: **Supabase is open source and can be self-hosted as-is**
(via the official `supabase/supabase` Docker Compose stack). This is the lowest-risk
migration path: the React app, RLS policies, migrations, and auth flows require
zero code changes — only environment variables and URLs change. The alternative
(replacing Supabase Auth/Storage/Realtime with bespoke services) is possible but
is a re-architecture project, not a migration, and is not recommended.

---

# Part 1 — Technical Questionnaire for the Client

Send this to the client's infrastructure/ops team. Answers drive the sizing,
cost estimate, and migration runbook.

## A. Business & Compliance Drivers
1. Why self-host? (Data residency, regulation, cost, policy?) Which regulation applies (GDPR, HIPAA, ISO 27001, SOC 2, internal policy)?
2. Must data stay in a specific country/region/network zone?
3. Is outbound internet access from servers allowed (for OS package mirrors, Docker Hub, Sentry, Turnstile verification)? If air-gapped, describe the artifact-mirror process.
4. Who owns ongoing operations after handover — the client, or us under a support contract?
5. Required RTO (max time to restore after disaster) and RPO (max acceptable data loss)?
6. Target go-live date and any blackout/maintenance windows?

## B. Current Usage & Sizing Baseline (we will fill this partially; client confirms)
7. Number of registered users, and monthly/daily active users.
8. Peak concurrent users and peak requests/sec observed.
9. Current database size on Supabase, and monthly growth rate (we can pull this from the Supabase dashboard).
10. Current Supabase Storage usage (task attachments): total GB, file-count, average/max file size, monthly ingress/egress bandwidth.
11. Expected growth over 12–24 months (users, data, storage).
12. Are there batch/periodic workloads (reports, imports) with predictable load spikes?

## C. Infrastructure Target
13. Target environment: bare metal, existing VMware/Hyper-V cluster, OpenStack, on-prem Kubernetes, or private cloud?
14. Preferred OS (Ubuntu LTS / RHEL / Debian)? Any hardened baseline (CIS) images?
15. Is Docker + Docker Compose permitted and supported, or is Kubernetes the mandated platform? (This decides between the official Supabase compose stack vs. the community Supabase Helm chart.)
16. VM budget: how many VMs can be allocated? Can we have separate VMs for (a) app/reverse-proxy, (b) Supabase services, (c) database?
17. Available CPU generations — any constraints (e.g., no AVX)? Reserved vs. shared (burstable) vCPUs?
18. RAM per VM and expandable ceiling.
19. Storage: type (SSD/NVMe/SAN), IOPS guarantee, thin vs. thick provisioning, max volume size? Database needs low-latency SSD storage.
20. Can block storage volumes be snapshotted at the hypervisor level?

## D. Networking, DNS, TLS
21. Target public URL(s) for the app (e.g., `tasks.client.com`) and the API/auth/storage endpoints (e.g., `tasks-api.client.com` or a path-based single domain).
22. DNS management: who controls the zone, and how are changes made (TTL, change lead time)?
23. TLS: public CA cert (Let's Encrypt possible?) or internal CA? If internal CA, how do end-user devices trust it?
24. Is there an existing reverse proxy / load balancer / WAF (NGINX, Traefik, F5, Cloudflare on-prem)? Do we integrate with it or deploy our own?
25. Firewall rules: which ports can be opened to users (443 only?), and from the server outbound?
26. Is IPv6 in play? Any proxy requirement for outbound traffic?
27. Cloudflare Turnstile is used in the frontend — will it remain, and is `challenges.cloudflare.com` reachable from client browsers?

## E. Security & Access
28. VPN/bastion/jump-host requirements for administrative access? SSH key policy?
29. Mandatory authentication integration: keep Supabase Auth (email/password, magic links), or must we integrate with corporate IdP (LDAP/AD/OIDC/SAML/Entra ID)? (Supabase Auth supports SSO/OIDC; this affects configuration.)
30. Secret management: do you have Vault / SOPS / sealed-secrets, or are we delivering `.env` files under file permissions?
31. Vulnerability scanning / patching SLAs we must adhere to?
32. Audit logging requirements for DB and server access; SIEM integration?

## F. Observability & Monitoring
33. Existing monitoring stack (Prometheus/Grafana, Zabbix, Datadog)? Should we integrate or ship our own?
34. Log retention policy and central log destination (syslog/Loki/ELK)?
35. Alerting channel (email, Slack/Teams, PagerDuty)?
36. Sentry is currently used for frontend error reporting — is outbound HTTPS to `sentry.io` permitted, or must we self-host Sentry / use an alternative?
37. Uptime/synthetic monitoring: who verifies availability, from inside or outside?

## G. Backup, DR, Data Lifecycle
38. Backup target storage: local disk, NFS/S3-compatible (MinIO?), tape, offsite?
39. Approved backup encryption/key management?
40. Backup schedule/retention (e.g., daily, 30 days) beyond our default?
41. DR: single site with restore-from-backup, or warm standby / replicated second site?
42. Email delivery: Supabase Auth sends signup/reset emails — provide SMTP relay details (host, port, auth, from-address) or confirm we run a local relay.
43. Retention/deletion policy for attachments and audit logs?

## H. Migration Logistics
44. How will the existing Supabase data be handed over — do you grant us temporary VPN access to pull a `pg_dump` + storage export, or do we deliver encrypted archives?
45. Remotely accessible staging environment available before production cutover?
46. Acceptable downtime window for cutover (duration + time of day)?
47. Who signs off UAT on the new environment?
48. Rollback approval chain if the cutover fails?

## I. Costs to Estimate (we compute from answers above)
- Compute: VM sizing (see Part 2, Phase 0 sizing table).
- Storage: DB volume + storage volume, 12-month growth buffer, backup storage (3× DB size typical).
- Licenses: Windows/RHEL subscriptions if applicable, support contracts.
- Bandwidth/egress costs if any.
- Ops labor: initial build, monthly patching/backup verification, on-call arrangement.
- Tooling: SMTP relay, TLS certs, monitoring, IdP licenses.

---

# Part 2 — Migration Plan (Vercel + Supabase Cloud → Self-Hosted)

## Phase 0 — Sizing & Architecture (deliverable of the questionnaire)

Reference sizing for the official Supabase Docker Compose stack (adjust per questionnaire answers):

| Component | Min (pilot) | Recommended (prod) | Notes |
|---|---|---|---|
| DB VM (PostgreSQL) | 2 vCPU / 4 GB / 50 GB SSD | 4 vCPU / 8–16 GB / 100+ GB NVMe | Dedicated VM; size volume = 3× current DB size |
| Supabase services VM (Kong, GoTrue, PostgREST, Realtime, Storage, Studio, meta) | 2 vCPU / 4 GB | 4 vCPU / 8 GB | Stateless; horizontally repeatable later |
| Edge/web VM (NGINX/Caddy serving the SPA static build) | 1 vCPU / 1 GB | 2 vCPU / 2 GB | Tiny; Vite build is static files |
| Backup storage | — | 3× DB size + storage bucket size | Separate volume/host, offsite copy |

Optionally collapse all onto one VM (4 vCPU / 8 GB) for small installs.

## Phase 1 — Provision & Stage (no production impact)

1. Provision VMs per approved sizing; apply client hardening baseline; open only required ports (443 to web VM; 5432 restricted to internal; SSH via bastion).
2. Install Docker Engine + Compose v2 on the Supabase VM(s). If air-gapped, pre-load the Supabase image set by tag/digest.
3. Clone `supabase/supabase` → `docker/` compose stack at a pinned commit. Configure `docker/.env`:
   - `POSTGRES_PASSWORD`, `JWT_SECRET` (generate ≥32-byte random), `ANON_KEY`/`SERVICE_ROLE_KEY` minted from that JWT secret.
   - `SITE_URL`/`API_EXTERNAL_URL` = client's API domain; SMTP settings from Q42; disable signup if the client wants invitation-only.
4. Deploy reverse proxy in front: terminate TLS, route `/auth/v1`, `/rest/v1`, `/storage/v1`, `/realtime/v1` to Kong. Reproduce the security headers and SPA fallback rewrites currently in `vercel.json` in NGINX/Caddy config.
5. Apply the schema: `supabase db push` (or `psql -f` each file) using the repo's `supabase/migrations/` in order — baseline → all fixes. Verify with the app's generated types (`npm run gen:types` pointed at the new DB) that the API surface matches.
6. Build the SPA with staging env vars and deploy to the edge/web VM. Full smoke test of auth, CRUD, attachments, notifications, realtime.

## Phase 2 — Data Migration (rehearsed on staging, then production)

7. **Export from Supabase Cloud:**
   - Schema+data: `pg_dump --format=custom --no-owner --no-privileges` against the cloud project (use the direct connection string, not the pooler).
   - Storage objects: script a full bucket download via the Storage API / `supabase storage` (attachments incl. private buckets), preserving object paths — paths are the join key to DB rows.
   - Export Auth users: GoTrue stores users in the `auth` schema; the dump includes `auth.users` with bcrypt password hashes — passwords carry over, users are NOT forced to reset.
8. **Import to self-hosted:** `pg_restore` into the self-hosted Postgres (schema already present from migrations; use `--data-only` where appropriate, or restore full then re-apply migrations). Re-upload storage objects to the self-hosted Storage service, then fix `storage.objects` rows to match.
9. Validate: row counts per table, FK integrity, storage object counts vs. DB references, sample login with a migrated user account, attachment download, RLS spot-checks (login as low-privilege user, confirm scoping).
10. Rehearse the entire export/import once against staging; time it — this defines the cutover downtime window (Q46).

## Phase 3 — Release Engineering

11. **Environment variables** (build-time in Vite — baked into the bundle, so one build per environment):
    - `.env.production` → `VITE_SUPABASE_URL=https://<client-api-domain>` and the self-hosted `ANON_KEY`.
    - Remove all references to `*.supabase.co`.
    - Secrets (JWT secret, DB password, service-role key, SMTP password) live ONLY server-side in compose env, managed per client's secret store (Q30). No service-role key may ever appear in the frontend bundle.
    - Update the CSP header (in reverse proxy, replacing the `vercel.json` version): change `connect-src`/`wss://*.supabase.co` to the self-hosted API domain.
12. **Deployment pipeline:** replace Vercel Git integration with CI (GitHub Actions/GitLab CI/client's CI): `npm ci && npm run build` → rsync/push `dist/` to the web VM (or build an NGINX Docker image with the bundle). Supabase schema changes continue via `supabase/migrations/` + `supabase db push` gated in the pipeline. Add automated rollback = redeploy previous artifact + DB rollback script per migration.

## Phase 4 — Cutover (minimize downtime)

Pre-cutover (days before): lower DNS TTL to 60–300s; freeze schema changes; final staging rehearsal signed off.

Cutover runbook:
1. Announce maintenance window; enable maintenance page on Vercel deployment (zero-downtime if the client accepts read-only mode instead — see note below).
2. Final `pg_dump` + storage delta export (only files changed since rehearsal, using object `updated_at`).
3. Restore + delta upload to self-hosted; run validation queries (step 9).
4. Flip DNS to the new environment (or repoint the existing load balancer).
5. Smoke test on the live URL: login, create task, upload attachment, notifications, realtime updates.
6. Keep the Supabase Cloud project and Vercel deployment **frozen but intact for 30 days** as instant rollback (DNS flip back).
7. Post-cutover: watch logs/Sentry for 48h; confirm nightly `pg_dump` backup job + storage sync and test one restore; verify disk/CPU/RAM headroom vs. projections and adjust VM sizing.

Downtime expectation: with rehearsal, typically 30–90 minutes, dominated by the final dump/restore. If near-zero downtime is required, the options are (a) logical replication from Supabase Cloud Postgres to the self-hosted DB with a short write-freeze at switchover, or (b) admitting the downtime window — decide with the client using Q45/Q46.

## Phase 5 — Decommission & Handover

- After the 30-day rollback window: export final backup archive, deliver to client, then delete/terminate Supabase Cloud project and Vercel project.
- Handover pack: architecture diagram, runbook (backup/restore, cert renewal, patching, adding users), credentials transfer via client's vault, monitoring/alert contacts, support/on-call agreement.

## Risk Register (top items)

| Risk | Mitigation |
|---|---|
| Air-gapped network blocks Docker Hub / Sentry / Turnstile | Q3/Q36/Q27 answers; internal mirrors, self-hosted Sentry, swap Turnstile for local captcha |
| Corporate IdP requirement | Supabase Auth OIDC/SAML SSO config (Q29) |
| Migration data mismatch | Scripted row/object count reconciliation in step 9; staging rehearsal |
| Client ops team unfamiliar with Supabase stack | Training session + runbook in Phase 5; single-VM compose keeps ops simple |
| Larger-than-expected storage/bandwidth | Sizing table recomputed from Q9–Q11 before VM order |
