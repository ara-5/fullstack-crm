# Security

## Reporting a vulnerability

Please **do not open a public issue** for security problems. Instead, report them privately through
[GitHub's private vulnerability reporting](https://github.com/ara-5/fullstack-crm/security/advisories/new).
Include steps to reproduce and the impact you observed. You'll get a response within a few days.

## Security design

- **Authentication:** passwords are hashed with bcrypt, sessions are signed JWT cookies (Auth.js), and
  failed logins are rate limited per email and (behind a trusted reverse proxy, via
  `TRUST_PROXY_HEADERS`) per IP.
- **Two-factor authentication:** TOTP (RFC 6238) with one-time recovery codes. Codes are single-use —
  the last accepted step is persisted and advanced with an atomic conditional update, so a captured
  code can't be replayed within its drift window, even from concurrent requests.
- **Authorization:** checked on the server for every page, Server Action and API call. Roles and the
  active flag are re-read from the database on each request, so revoking access takes effect immediately.
  Reps can only read or modify records they own.
- **API keys:** random 192-bit keys, stored only as SHA-256 hashes and shown once. Requests are rate limited.
- **Webhooks:** payloads are signed with HMAC-SHA256. Target URLs must resolve to public addresses
  (checked at creation and before every delivery), redirects are not followed, and the outbound
  connection is pinned to the exact address that check validated — closing the DNS-rebinding gap
  where a second, independent lookup at request time could answer differently and reach an internal
  service despite passing the check.
- **AI assistant:** the agent's write tools (create a task, move a deal, send an email) never execute
  directly. Each produces a proposal the signed-in user must explicitly approve, which then runs
  through the same permission-checked service-layer functions the UI uses — the assistant can never
  do more than the user already could by hand.
- **CSV:** exported cells that would run as spreadsheet formulas are escaped.
- **Headers:** `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff` and a strict referrer policy.
- **Public demo:** with `DEMO_MODE=true`, real email and webhook delivery and account management are
  disabled, and the data is reset nightly.
- **Automated scanning:** [CodeQL](.github/workflows/codeql.yml) runs static analysis on every push,
  pull request, and weekly on a schedule. [Dependabot](.github/dependabot.yml) opens a PR for
  vulnerable or outdated npm, GitHub Actions, and Docker base image dependencies.
