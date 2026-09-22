# CRM

[![CI](https://github.com/ara-5/fullstack-crm/actions/workflows/ci.yml/badge.svg)](https://github.com/ara-5/fullstack-crm/actions/workflows/ci.yml)
[![CodeQL](https://github.com/ara-5/fullstack-crm/actions/workflows/codeql.yml/badge.svg)](https://github.com/ara-5/fullstack-crm/actions/workflows/codeql.yml)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](LICENSE)
![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue?logo=typescript)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-%2Bpgvector-336791?logo=postgresql&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38bdf8?logo=tailwindcss&logoColor=white)

A full-stack CRM built with Next.js 16 (App Router), Prisma/PostgreSQL, Auth.js and Tailwind CSS —
contacts, a drag-and-drop deal pipeline, tasks, automations, reporting, a REST API and signed
webhooks, all behind role-based access control. It also has an agentic AI layer with tool access to
real CRM data, gated so every write needs the user's explicit approval, and a durable Postgres-backed
job queue instead of fire-and-forget background work — see
[Engineering highlights](#engineering-highlights) below.

**[Live demo →](https://fullstack-crm-cyan.vercel.app)** · admin@crm.local / manager@crm.local / rep@crm.local, password `Password123!`

<p align="center">
  <img src="docs/screenshots/dashboard-light.png" width="49%" alt="Dashboard, light theme">
  <img src="docs/screenshots/pipeline-dark.png" width="49%" alt="Deal pipeline board, dark theme">
</p>
<p align="center">
  <img src="docs/screenshots/command-palette-light.png" width="49%" alt="Command palette with live search">
  <img src="docs/screenshots/mobile-dashboard.png" width="15%" alt="Mobile dashboard">
</p>

## Engineering highlights

A few things that go beyond a typical CRUD app, if you're skimming for signal:

- **One service layer, three callers.** The UI (Server Actions), REST API and CSV import all go
  through the same functions in [`src/lib/crm.ts`](src/lib/crm.ts) — so permissions, validation, the
  audit log and automations/webhooks behave identically everywhere, instead of being reimplemented
  (and drifting) per entry point.
- **SSRF-hardened webhooks, closed against DNS rebinding.** Target URLs are checked against
  private/internal address ranges before every delivery — and the outbound connection is pinned to
  the exact address that check just validated ([`src/lib/webhooks.ts`](src/lib/webhooks.ts)), so a
  malicious DNS server can't answer the check with a public IP and the real request a moment later
  with an internal one.
- **2FA with replay protection.** TOTP codes are single-use: the last accepted step counter is
  persisted and advanced with an atomic conditional update, so a captured code can't be replayed
  within its drift window — even from two concurrent requests
  ([`src/lib/two-factor.ts`](src/lib/two-factor.ts)).
- **An AI agent that can't outrun its own guardrails.** The assistant's write tools — create a task,
  move a deal, send an email — never execute directly. Each one produces a proposal card the user
  must approve, which then runs through the exact same `crm.ts` functions the UI uses. The model can
  suggest; only the signed-in user's own permissions can act
  ([`src/lib/agent.ts`](src/lib/agent.ts)).
- **A durable job queue, not a fire-and-forget request.** Webhook delivery and embedding computation
  run through a Postgres-backed outbox (`FOR UPDATE SKIP LOCKED`, retry with backoff) instead of
  inline in the request, so a crash or redeploy mid-delivery doesn't silently drop work
  ([`src/lib/jobs.ts`](src/lib/jobs.ts)).
- **Race-safe under real concurrency, not just in the happy path.** Approving an AI proposal,
  recording a webhook delivery outcome, and accepting a 2FA code all use atomic conditional updates —
  a claimed `updateMany`, or a single `CASE`-based `UPDATE` — instead of read-then-write, so two
  concurrent requests can't double-apply an approved action or race a failure counter into losing an
  increment. Verified against a live Postgres instance with concurrent requests, not just asserted in
  a unit test.
- **Explainable, not just a color.** The deal health score names the specific reasons a deal is at
  risk — gone quiet, missed its close date, no next step — instead of a black-box red/amber/green.
- **Tested at every layer.** 100+ unit tests — pure logic (TOTP against the RFC 6238 vectors,
  permissions, deal health, the SSRF guard, CSV) plus the race-sensitive state machines around the
  job queue (retry/backoff, exhausted attempts) and AI proposal approval (double-approve, expiry,
  claim races) against a mocked database — and an end-to-end suite covering auth/2FA, RBAC,
  drag-and-drop, automations, the REST API and accessibility (axe). Both run in CI on every push,
  against a real Postgres service container.

## Features

### Core CRM
- **Contacts & companies** — search, filters, pagination, tags, owners, an activity timeline and a
  field-level change history on every record.
- **Deal pipeline** — a drag-and-drop Kanban board (Lead → Qualified → Proposal → Negotiation →
  Won/Lost), stage probabilities, a weighted forecast, and an **explainable health score** on every
  open deal.
- **Tasks & activities** — tasks, calls, meetings, emails and notes, with due dates, priorities,
  and overdue/today/upcoming views.
- **Dashboard & reports** — KPI tiles, won revenue by month, pipeline by stage, a leaderboard,
  per-owner win rate and sales cycle, and lead-source conversion — all light/dark-mode aware charts
  built to WCAG-AA color contrast.
- **Command palette** (`Ctrl/⌘+K`) — fuzzy-jump to any page or record, or create a contact/company/
  deal/task, without leaving the keyboard.
- **Saved views & bulk actions** — save a filtered contacts/companies list by name and reapply it
  in one click; select multiple records to bulk-tag, bulk-reassign or bulk-delete.
- **Notifications** — an in-app bell for assignments and deal outcomes, and a **presence
  indicator** ("Ada is also viewing this") on any record two people have open at once.
- **Dark mode** — a real second theme (not an inverted filter), remembered per browser.

### AI & search _(optional — see [AI](#ai) for setup)_
- **AI deal insights** — one click on a deal summarizes its timeline, assesses risk, and drafts a
  follow-up email, powered by Claude with structured output.
- **Agentic AI command panel** — a chat drawer that answers questions and takes actions ("what's
  overdue this week?", "draft a follow-up to Ada about the renewal"), scoped to the signed-in user's
  own permissions. Every write is a proposal the user must explicitly approve.
- **Semantic search** — contacts, companies and deals are embedded (Voyage AI) and searchable by
  meaning, not just keyword match; also gives the AI assistant real retrieval instead of hand-built
  prompts.
- **AI observability** — every AI call is logged (latency, tokens, status), visible to admins in
  Settings, so "is the assistant actually good" is a query, not a guess.

### Platform & security
- **Auth & roles** — email/password login, rate-limited against brute force, with optional
  **two-factor authentication** (TOTP + one-time recovery codes, replay-protected — any authenticator
  app works).
  - **Admin** — everything, including users, webhooks and the audit log.
  - **Manager** — sees all records; manages automations, import/export and deletions.
  - **Rep** — sees and edits only their own records, everywhere (UI, API, exports).
- **Automations** — rules like *"when a deal moves to Won → create an onboarding task / email the
  contact / mark them as a customer"*, with conditions (stage, minimum value, contact status) and
  `{{placeholders}}`.
- **Audit trail** — every create/update/delete/stage-change is recorded with who, when, and a
  field-level diff, visible on the record and as a live feed for admins.
- **Durable background jobs** — webhook delivery and embedding computation run through a
  Postgres-backed job queue with retries and backoff (see `npm run jobs:worker` / the `worker`
  compose service).

### Data & integrations
- **Import / export** — CSV import for contacts and companies (flexible header matching, per-row
  error report) and CSV export with formula-injection escaping.
- **REST API** — `/api/v1`, authenticated with per-user API keys (stored hashed, shown once), rate
  limited, and documented with a live **[interactive API reference](/api-docs)** generated from the
  same Zod schemas that validate requests.
- **Webhooks** — HMAC-SHA256 signed, retried with backoff through the job queue, guarded against SSRF
  including DNS rebinding (see [Engineering highlights](#engineering-highlights)), and auto-disabled
  after repeated failures.
- **Public demo mode** — one-click role logins, real email/webhook delivery disabled, data reset
  nightly by a cron job.

## Tech stack

**App:** Next.js 16 (App Router, Server Actions, Turbopack) · TypeScript (strict) · Tailwind CSS 4 ·
Zod
**Data:** PostgreSQL · Prisma · pgvector (semantic search)
**Auth:** Auth.js (Credentials + TOTP 2FA)
**AI:** Claude (Opus 5 for deal insights, Sonnet 5 for the agent) · Voyage AI (embeddings)
**Testing:** Vitest (unit) · Playwright (e2e + accessibility via axe) · GitHub Actions (CI)
**Infra:** Docker Compose (app + worker + Postgres) · a Postgres-backed job queue (no Redis/queue
service required)

## Getting started

Requires Node.js 20.9+ and Docker (for local Postgres).

```bash
npm install
cp .env.example .env    # then set AUTH_SECRET: npx auth secret
npm run setup            # starts Postgres, applies migrations, seeds demo data
npm run dev
```

Open http://localhost:3000 and sign in. Every demo account's password is `Password123!`.

| Email | Role |
|---|---|
| admin@crm.local | Admin |
| manager@crm.local | Manager |
| rep@crm.local / sam@crm.local | Rep |

### All-in-Docker

No local Node.js needed — this builds and runs the whole stack (Postgres + migrations + seed + app +
background job worker):

```bash
docker compose --profile app up --build
```

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js dev server / production build / production server |
| `npm run lint` / `typecheck` | ESLint / `tsc --noEmit` |
| `npm test` / `test:watch` | Unit tests (Vitest) |
| `npm run test:e2e` / `test:e2e:ui` | End-to-end tests (Playwright), against a production build |
| `npm run screenshots` | Regenerates the screenshots in `docs/screenshots/` |
| `npm run db:migrate` | Create/apply a Prisma migration in development |
| `npm run db:seed` | Reset to fresh demo data |
| `npm run db:studio` | Browse the database |
| `npm run jobs:worker` | Continuously processes the background job queue (webhook delivery, embeddings) |

## Project structure

```
prisma/schema.prisma       data model (enum-like fields are strings, validated in code)
prisma/migrations/         SQL migration history
src/lib/demo-seed.ts       demo data (used by `prisma db seed` and the nightly demo reset)
src/proxy.ts               redirects signed-out visitors to /login (optimistic check only)
src/lib/env.ts             startup-validated environment variables (Zod)
src/lib/crm.ts             service layer: validation, record permissions, audit log, domain events
src/lib/automation.ts      event → automation rules → actions; webhooks enqueued after the response
src/lib/deal-health.ts     pure, unit-tested deal health scoring
src/lib/reports.ts         dashboard & report queries
src/lib/permissions.ts     role rules and record scoping
src/lib/ssrf.ts            outbound-URL guard used by webhooks (DNS-rebinding safe)
src/lib/openapi.ts         OpenAPI 3.1 spec, generated from the Zod validation schemas
src/lib/totp.ts            pure, unit-tested TOTP + recovery codes (RFC 4226/6238, no dependency)
src/lib/two-factor.ts      2FA login verification (TOTP or a one-time recovery code, replay-safe)
src/lib/notifications.ts   in-app notifications (assignment, deal outcome, automation tasks)
src/lib/presence.ts        "who else is viewing this" heartbeat, backed by a short-TTL table
src/lib/saved-views.ts     named, reusable filters for the contacts/companies list pages
src/lib/jobs.ts            Postgres-backed job queue: enqueue, claim (SKIP LOCKED), retry/backoff
src/lib/embeddings.ts      pgvector semantic search + the "embed_record" job handler
src/lib/agent.ts           agentic AI command layer: tools, the tool-use loop, proposal approval
src/lib/ai-log.ts          AI call logging + usage aggregation (Settings → AI usage)
scripts/worker.ts          long-running job worker (self-hosted/Docker; Vercel uses a cron route instead)
src/app/(app)/…            authenticated pages (Server Components + Server Actions)
src/app/api/v1/…           REST API (API-key auth)
src/app/api/export/…       CSV export (session auth)
src/app/api-docs/          interactive API reference (Scalar, reads /api/v1/openapi.json)
e2e/                       Playwright end-to-end tests
```

UI actions, the REST API and CSV import all call the same functions in `src/lib/crm.ts`. That means
permissions, validation, the audit log, automations and webhooks behave identically everywhere.

## REST API

Create a key under **Settings → Your API keys**, then browse the
[interactive reference](/api-docs) or:

```bash
curl -H "Authorization: Bearer crm_…" "http://localhost:3000/api/v1/deals?stage=PROPOSAL"

curl -X PATCH -H "Authorization: Bearer crm_…" -H "Content-Type: application/json" \
  -d '{"stage":"WON"}' http://localhost:3000/api/v1/deals/<id>
```

| Resource | Endpoints |
|---|---|
| Contacts | `GET/POST /api/v1/contacts`, `GET/PATCH/DELETE /api/v1/contacts/:id` |
| Companies | `GET/POST /api/v1/companies`, `GET/PATCH/DELETE /api/v1/companies/:id` |
| Deals | `GET/POST /api/v1/deals`, `GET/PATCH/DELETE /api/v1/deals/:id` |
| Activities | `GET/POST /api/v1/activities`, `PATCH/DELETE /api/v1/activities/:id` |

A validation error returns `422` with details; the API is rate limited to 300 requests/minute per
key (see the `X-RateLimit-*` response headers). A key sees only the records its owner can see.

### Webhooks

Events: `contact.created`, `contact.updated`, `deal.created`, `deal.stage_changed`,
`activity.completed`. Deliveries go through the background job queue and are retried up to 3 times
with backoff; a webhook is paused automatically after 10 consecutive failures. To verify a delivery,
compute `"sha256=" + HMAC_SHA256(secret, rawBody)` and compare it with the `X-CRM-Signature` header.

## Testing

```bash
npm test          # unit tests: validation, permissions, automation rules, deal health, SSRF guard,
                   # CSV, TOTP (verified against the RFC 6238 test vectors), the job queue's
                   # retry/backoff state machine, and AI proposal approval's race conditions
npm run build && npm run test:e2e   # end-to-end: auth incl. 2FA, RBAC, pipeline drag-and-drop,
                                     # automations, saved views, bulk actions, notifications,
                                     # presence, the REST API, the command palette, dark mode,
                                     # accessibility (axe)
```

CI (`.github/workflows/ci.yml`) runs lint, typecheck, both test suites and the build on every push
and pull request, against a real Postgres service container (with pgvector, for the semantic-search
migration).

## AI

Three independent, optional features — each hidden gracefully without its key, so the app works
fully without any of them configured.

| Feature | Requires | What it does |
|---|---|---|
| Deal insights | `ANTHROPIC_API_KEY` | One click on a deal summarizes its timeline, assesses risk, and drafts a follow-up email (Claude, structured output via a Zod schema), cached on the deal. |
| AI assistant (agent) | `ANTHROPIC_API_KEY` | A chat panel with tool access to search records and look up deals/tasks, and propose changes. Every write needs explicit approval before anything happens — see [Engineering highlights](#engineering-highlights). |
| Semantic search | `VOYAGE_API_KEY` | Contacts/companies/deals are embedded and searchable by meaning; also used as retrieval for the assistant. Falls back to keyword search alone without it. |

Every AI call is rate-limited per user and logged (latency, real token counts, status) — visible to
admins in **Settings → AI usage**, alongside a **Background jobs** health panel for the queue that
computes embeddings and delivers webhooks.

## Moving to a different Postgres provider

Point `DATABASE_URL` (pooled) and `DIRECT_URL` (direct, for migrations) at your provider — e.g.
[Neon](https://neon.tech) or [Supabase](https://supabase.com) both work as-is — and run
`npx prisma migrate deploy`. The migration enables the `vector` extension itself
(`CREATE EXTENSION IF NOT EXISTS vector;`), which both providers support.

## Deploying (Vercel)

1. Import the repo, set `DATABASE_URL`/`DIRECT_URL` (a Neon/Supabase Postgres) and `AUTH_SECRET`.
2. Set `CRON_SECRET` (a random string) — `vercel.json` uses it to authorize two scheduled routes:
   the nightly demo reset and `/api/cron/process-jobs`, which drains the background job queue
   (webhook delivery, embeddings). **Vercel's Hobby plan only runs cron once a day**, so
   `vercel.json` schedules both daily by default (a deploy with a more frequent cron is rejected
   outright on Hobby); on Pro, tighten `process-jobs`'s schedule to run every few minutes, or point
   an external scheduler (e.g. cron-job.org) at that route instead.
3. For a public demo: also set `DEMO_MODE=true`.
4. Optionally set `ANTHROPIC_API_KEY`, `VOYAGE_API_KEY`, and SMTP variables.

## Production notes

- Set a strong `AUTH_SECRET`; configure SMTP (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`,
  `EMAIL_FROM`) or emails are logged instead of sent.
- Money totals are summed only within the `CURRENCY` env var (default `USD`); deals in other
  currencies are counted but excluded from sums, never silently added together.
- Only admins can add webhook URLs; they're checked against private/internal address ranges at
  creation and before every delivery, with the outbound connection pinned against DNS rebinding, but
  a fully trusted admin is still assumed.
- Webhook delivery and embedding computation run through the durable job queue
  (`src/lib/jobs.ts`), not inline in the request — something needs to be processing it (see
  [Deploying](#deploying-vercel) / `npm run jobs:worker`), or work just queues up unprocessed.
  Automations still run inline, before the response, since their effects (e.g. a created task) need
  to be visible on the page that triggered them.
- Login rate limiting by IP only engages behind a trusted reverse proxy (`TRUST_PROXY_HEADERS=true`);
  without it, `X-Forwarded-For` is attacker-controlled and the per-account limiter is what protects
  you.
- See [SECURITY.md](SECURITY.md) for the full security model and how to report a vulnerability.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Copyright (C) 2026 Ara

This program is free software: you can redistribute it and/or modify it under the terms of the
GNU Affero General Public License as published by the Free Software Foundation, either version 3
of the License, or (at your option) any later version. See [LICENSE](LICENSE) for the full text.

In short: you may use, modify and self-host this CRM. If you run a modified version as a network
service (for example, a hosted SaaS), you must make your modified source code available to its
users under the same license.
