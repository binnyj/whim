# Whim

[![CI](https://github.com/binnyj/whim/actions/workflows/ci.yml/badge.svg)](https://github.com/binnyj/whim/actions/workflows/ci.yml)

> "I have some free time today. What should I do?"

Whim turns a free afternoon into a plan. Tell it where you are, how you feel and how long you have, and it suggests nearby activities, then builds a realistic itinerary with travel time between stops.

**Status:** early development. The foundation is in place (web app, API, shared types, tests, CI); the first product features are next.

## Prerequisites

- **Node.js 26** (see `.nvmrc`; e.g. `nvm use`)
- **pnpm 12**: `npm install -g pnpm@12`
  - If npm refuses to run pnpm's install script, use `npm install -g --allow-scripts=pnpm pnpm@12`.

## Getting started

```bash
git clone https://github.com/binnyj/whim.git
cd whim
pnpm install
pnpm dev
```

Then open **http://localhost:5173**. The home page should say **"API is up"**.

`pnpm dev` starts both apps:

| App              | URL                   | Notes                                                     |
| ---------------- | --------------------- | --------------------------------------------------------- |
| Web (`apps/web`) | http://localhost:5173 | Vite dev server; forwards `/api` and `/health` to the API |
| API (`apps/api`) | http://localhost:3000 | Restarts on save; set `API_PORT` to use a different port  |

No configuration is needed to run locally. To override defaults, copy the example env files:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

## Scripts

Run from the repo root:

| Command                             | What it does                                                                     |
| ----------------------------------- | -------------------------------------------------------------------------------- |
| `pnpm dev`                          | Run the web app and API together, with reload on save                            |
| `pnpm test`                         | Run all tests once                                                               |
| `pnpm test:coverage`                | Run tests with coverage; fails if `packages/shared` or `apps/api` drop below 80% |
| `pnpm lint`                         | ESLint (TypeScript, React, import order) and Stylelint (CSS)                     |
| `pnpm typecheck`                    | TypeScript in every package                                                      |
| `pnpm format` / `pnpm format:check` | Format with Prettier / check formatting                                          |
| `pnpm build`                        | Production build of the web app (`apps/web/dist`)                                |

To run a script in one package: `pnpm --filter @whim/api test` (or `@whim/web`, `@whim/shared`).

## Repo layout

```
apps/
  api/        Express 5 API (Node). App factory in src/app.ts, entry in src/server.ts
  web/        React 19 + Vite web app. Routes in src/app/routes.tsx, design tokens in src/styles/tokens.css
packages/
  shared/     Zod schemas and types used by both apps (request/response shapes, error format)
docs/
  decisions/  Architecture decision records (ADRs)
.github/
  workflows/  CI: format, lint, typecheck, tests with coverage, build
```

## How it fits together

- **One source of truth for data shapes.** Anything the web app and API both touch is a Zod schema in `@whim/shared`. The API validates requests with it; the web app validates responses with it.
- **Consistent errors.** Every API error is `{ error: { code, message, details? } }`. The web app turns failures into a typed `ApiError` and decides what to show from its `code`.
- **AI judges what's enjoyable; data decides what's feasible.** AI never supplies opening hours, addresses or travel times. Those come from verified providers and application logic.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for tests, coding conventions, and commit style.
