# Contributing

Thanks for your interest in improving this CRM! Bug reports, ideas and pull requests are welcome.

## Getting set up

Requirements: Node.js 20.9+ and Docker.

```bash
npm install
cp .env.example .env     # set AUTH_SECRET (npx auth secret)
npm run setup            # starts Postgres, applies migrations, seeds demo data
npm run dev
```

## Before opening a pull request

```bash
npm run lint
npm run typecheck
npm test                 # unit tests (Vitest)
npm run build
npm run test:e2e         # end-to-end tests (Playwright) against the production build
```

CI runs the same checks on every pull request.

## Guidelines

- Keep business rules in the service layer (`src/lib/crm.ts`) so the UI, REST API and CSV import
  stay consistent. Pages and Server Actions should stay thin.
- Validate all input with the Zod schemas in `src/lib/validation.ts`.
- Schema changes need a migration: `npx prisma migrate dev --name <change>`.
- Add or update tests for behavior changes.
- Use clear commit messages that explain *why* a change was made.

## License

This project is licensed under the [GNU AGPL-3.0-or-later](LICENSE). By contributing, you agree that
your contributions are licensed under the same terms.
