# CRM

A full-stack CRM built with Next.js 16 (App Router), Prisma, Auth.js and Tailwind CSS.

## Features

- **Contacts & companies**: search, filters, pagination, tags, owners, and a timeline of activities and emails on every record.
- **Deals pipeline**: a drag-and-drop Kanban board (Lead → Qualified → Proposal → Negotiation → Won/Lost), stage probabilities and a weighted forecast.
- **Tasks & activities**: tasks, calls, meetings, emails and notes, with due dates, priorities, and overdue/today/upcoming views.
- **Dashboard & reports**: KPI tiles, won revenue by month, pipeline by stage, a leaderboard, per-owner win rate and sales cycle, and lead-source conversion.
- **Auth & roles**: email/password login.
  - **Admin**: everything, including users and webhooks.
  - **Manager**: sees all records; can manage automations, import/export and delete records.
  - **Rep**: sees and edits only their own records.
- **Automations**: rules like *"when a deal moves to Won → create an onboarding task / email the contact / mark the contact as a customer"*, with conditions (stage, minimum value, contact status) and `{{placeholders}}`.
- **Email**: sent through SMTP when configured. Otherwise emails are logged to the console. Either way they appear in the email log.
- **Import / export**: CSV import for contacts and companies (flexible header matching, per-row error report) and CSV export with formula-injection escaping.
- **REST API + webhooks**: `/api/v1` with per-user API keys (stored hashed). Webhooks are signed with HMAC-SHA256 (`X-CRM-Signature`).

## Getting started

Requires Node.js 20.9+.

```bash
npm install
cp .env.example .env        # then set AUTH_SECRET (npx auth secret)
npm run setup               # creates the SQLite DB and seeds demo data
npm run dev
```

Open http://localhost:3000 and sign in. Every demo account's password is `Password123!`.

| Email | Role |
|---|---|
| admin@crm.local | Admin |
| manager@crm.local | Manager |
| rep@crm.local / sam@crm.local | Rep |

Useful scripts: `npm run db:seed` (reset demo data), `npm run db:studio` (browse the DB), `npm run typecheck`, `npm run lint`.

## Project structure

```
prisma/schema.prisma      data model (enum-like fields are strings for SQLite/Postgres portability)
prisma/seed.ts            demo data
src/proxy.ts              redirects signed-out visitors to /login (optimistic check only)
src/lib/crm.ts            service layer: validation, record permissions, domain events
src/lib/automation.ts     event → automation rules → actions; webhooks delivered after the response
src/lib/reports.ts        dashboard & report queries
src/lib/permissions.ts    role rules and record scoping
src/app/(app)/…           authenticated pages (Server Components + Server Actions)
src/app/api/v1/…          REST API (API-key auth)
src/app/api/export/…      CSV export (session auth)
```

UI actions, the REST API and CSV import all call the same functions in `src/lib/crm.ts`. That means permissions, validation, automations and webhooks behave the same everywhere.

## REST API

Create a key under **Settings → Your API keys**, then:

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

A validation error returns `422` with details. A key sees only the records its owner can see.

### Webhooks

Webhook events: `contact.created`, `contact.updated`, `deal.created`, `deal.stage_changed`, `activity.completed`.

To verify a delivery, compute `"sha256=" + HMAC_SHA256(secret, rawBody)` and compare it with the `X-CRM-Signature` header.

## Moving to PostgreSQL

1. In `prisma/schema.prisma`, set `provider = "postgresql"`.
2. Set `DATABASE_URL` to your Postgres connection string.
3. Run `npx prisma migrate dev --name init` (or `prisma db push`).

Search uses `contains`. That is case-insensitive on SQLite but case-sensitive on Postgres. To keep case-insensitive search there, add `mode: "insensitive"` to the filters in `src/lib/crm.ts`.

## Production notes

- Set a strong `AUTH_SECRET`, and configure SMTP (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`).
- Only admins can add webhook URLs. If untrusted admins are possible, restrict them to public hosts to prevent SSRF.
- Automations run inline with the request, and webhooks run after the response via `after()`. For high volume, move both to a job queue.
