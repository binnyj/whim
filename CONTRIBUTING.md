# Contributing to Whim

## Workflow

1. Get set up with the [README](README.md).
2. Make the change with tests (see below).
3. Commit. A pre-commit hook formats and lint-fixes staged files, and blocks the commit on errors it can't fix.
4. Push. [CI](.github/workflows/ci.yml) runs format check, lint, typecheck, tests with coverage and the build on every push to `main` and every PR.

Before pushing, the same checks CI runs:

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test:coverage && pnpm build
```

## Commits and pull requests

- **Title:** plain English describing the change, e.g. `Add request validation middleware`. No `type(scope):` prefixes.
- **Body:** one or two short sentences on what changed and why. No file lists.
- **Branches** (when used): `feat/<card-id>-<short-name>`, e.g. `feat/P1-07-places-client`.
- **PR descriptions:** same as commit bodies, one or two sentences.

## Tests

- Tests live next to the code they test: `foo.ts` → `foo.test.ts`.
- **Runner:** [Vitest](https://vitest.dev) for every package. `pnpm test` runs everything; `pnpm --filter <pkg> test` runs one package.
- **API:** test routes through `createApp()` with [supertest](https://github.com/ladjs/supertest) (no real port). Inject dependencies (clock, logger, fetch) instead of mocking modules. `memoryLogger()` in `apps/api/src/test-utils` captures log lines.
- **Web:** [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/) in jsdom. Use `renderRoute('/path')` to render the real routes, and `mockFetch(...)` to fake API responses. Query by role and accessible name, not by class or test ID.
- **Coverage:** `pnpm test:coverage` fails if `packages/shared` or `apps/api` drop below 80% on lines, functions, branches or statements. Raise thresholds over time; don't lower them.

## Code conventions

- **TypeScript is strict**, including `noUncheckedIndexedAccess`. In `apps/api` and `packages/shared`, relative imports end in `.js` (`import { x } from './x.js'`); the web app uses extensionless imports.
- **Shared shapes go in `@whim/shared`** as Zod schemas with inferred types. Never hand-write a type that a schema already describes.
- **API errors:** throw an `AppError` subclass (`ValidationError`, `NotFoundError`, `RateLimitedError`, `UpstreamError`). Its message must be safe to show users; put internal detail in `cause`. Validate inputs with the `validate({ body, query, params })` middleware.
- **Outbound HTTP** goes through `createHttpClient` (`apps/api/src/http`), which handles timeouts, retries, response schemas and logging.
- **Config:** new environment variables go in the schema in `apps/api/src/config.ts` and in the matching `.env.example`. Never commit real `.env` files or secrets.
- **Styling:** CSS Modules with camelCase class names. Use design tokens from `apps/web/src/styles/tokens.css`; Stylelint rejects raw colors anywhere else.

## Decisions

Architecture decisions are recorded in [`docs/decisions/`](docs/decisions/). If a change constrains later work (a new library, provider, data model or convention), add an ADR or an addendum to an existing one.
