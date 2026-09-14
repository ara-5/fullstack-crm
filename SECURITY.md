# Security

## Reporting a vulnerability

Please **do not open a public issue** for security problems. Instead, report them privately through
[GitHub's private vulnerability reporting](https://github.com/ara-5/fullstack-crm/security/advisories/new).
Include steps to reproduce and the impact you observed. You'll get a response within a few days.

## Security design

- **Authentication:** passwords are hashed with bcrypt, sessions are signed JWT cookies (Auth.js), and
  failed logins are rate limited per email and per IP.
- **Authorization:** checked on the server for every page, Server Action and API call. Roles and the
  active flag are re-read from the database on each request, so revoking access takes effect immediately.
  Reps can only read or modify records they own.
- **API keys:** random 192-bit keys, stored only as SHA-256 hashes and shown once. Requests are rate limited.
- **Webhooks:** payloads are signed with HMAC-SHA256. Target URLs must resolve to public addresses
  (checked at creation and before every delivery), and redirects are not followed, which blocks SSRF
  against internal services.
- **CSV:** exported cells that would run as spreadsheet formulas are escaped.
- **Headers:** `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff` and a strict referrer policy.
- **Public demo:** with `DEMO_MODE=true`, real email and webhook delivery and account management are
  disabled, and the data is reset nightly.
