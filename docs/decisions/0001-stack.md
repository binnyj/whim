# 0001 · Stack & repository layout

- **Status:** Accepted
- **Date:** 2026-11-16
- **Card:** P0-01

## Context

Whim is a ~5-week build of a React web app and a Node API that share domain types
and validation schemas. Every later card (lint, CI, tests, provider clients, planner)
lands on these choices, so they are fixed up front.

## Decision

| Area                                                | Choice                                                                                                                  | Rationale                                                                                                                                      |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Language                                            | TypeScript everywhere, `strict`                                                                                         | One type system across FE, BE and shared domain code.                                                                                          |
| Module system                                       | ESM (`"type": "module"`)                                                                                                | Native in Node and Vite; avoids dual CJS/ESM config.                                                                                           |
| Node version                                        | Node 26 (Active LTS), pinned in `.nvmrc` + `engines`                                                                    | Current LTS line; matches the local dev machine.                                                                                               |
| Package manager                                     | pnpm workspaces, version pinned via `packageManager`                                                                    | Strict, non-hoisted deps catch undeclared imports between workspaces; fast, disk-efficient installs; good `--filter` fan-out for root scripts. |
| Monorepo layout                                     | `apps/web`, `apps/api`, `packages/shared` (scope `@whim/*`)                                                             | Two deployables plus one shared package for domain types and schemas.                                                                          |
| FE build tool                                       | Vite + React                                                                                                            | Fast dev server, simple config, first-class TS; shares config with Vitest.                                                                     |
| BE framework                                        | Express 5                                                                                                               | Widely known, large middleware ecosystem; v5 forwards rejected promises from async handlers to error middleware.                               |
| Test runner                                         | Vitest (v8 coverage) for all workspaces                                                                                 | Native TS/ESM, reuses Vite config, Jest-compatible API, built-in coverage thresholds.                                                          |
| Supporting libs (assumed, confirmed by their cards) | Zod (P0-06), supertest (P0-07), pino + pino-http (P0-12), React Testing Library + jsdom (P0-14), TanStack Query (P0-17) | Listed so later cards don't re-litigate them.                                                                                                  |
| API dev runner                                      | `tsx watch`                                                                                                             | Runs TS directly in dev without a build step.                                                                                                  |

## Consequences

- Contributors need pnpm (`corepack` is no longer bundled with Node 25+, so install with `npm i -g pnpm`).
- Express has no built-in schema validation, request injection or logging, so P0-07 (supertest),
  P0-10/P0-11 (hand-written error + Zod validation middleware) and P0-12 (pino-http) supply them.
- The API app factory (`createApp()`) stays separate from `server.ts` so tests never bind a port.
- One Vitest version and config style across all packages keeps P0-09 coverage thresholds uniform.

## Alternatives considered

- **npm workspaces:** no extra install, but hoisting lets a workspace import a package it never declared.
- **Fastify:** built-in `inject`, schemas and logging; not chosen in favor of Express familiarity.
- **Jest:** needs an extra TS/ESM transform layer that Vitest doesn't.

## Addendum · TypeScript configuration (P0-03, 2026-11-16)

- **Compiler:** TypeScript 6.0 (pinned `~6.0.3`), one root `devDependency`; every package runs `tsc -p tsconfig.json` (no emit).
  P0-03 started on TypeScript 7, but P0-04 moved to 6.0 because TypeScript 7's native compiler no
  longer ships the JavaScript compiler API that typescript-eslint needs (it supports `<6.1`). Revisit
  when typescript-eslint supports 7.
- **`tsconfig.base.json`:** `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noImplicitReturns`,
  `verbatimModuleSyntax`, target/lib ES2023. Each package's `tsconfig.json` extends it.
- **Module resolution:** `NodeNext` for `packages/shared` and `apps/api`, so relative imports in them use
  `.js` extensions (`import { x } from './x.js'`) and run unchanged on Node. `apps/web` overrides to
  `Bundler` (Vite resolves imports itself).
- **Cross-package imports:** `@whim/shared` is a `workspace:*` dependency whose `exports` point at its
  TypeScript source (`./src/index.ts`). Vite, tsx and Vitest all consume it with no build step and no
  `paths` aliases to keep in sync. If the API's production build (P0-07 / P5-02) needs compiled JS,
  it bundles `@whim/shared` rather than us publishing a built copy.

## Addendum · Lint and formatting (P0-04, 2026-11-16)

- **ESLint 10**, one flat config at the repo root (`eslint.config.js`) for every workspace; root `pnpm lint`
  runs it once over the whole repo, and each package's `lint` script runs it on that package only.
- **Rules:** typescript-eslint `strictTypeChecked` + `stylisticTypeChecked` (type-aware via `projectService`),
  `@eslint-react` + official `react-hooks` for `apps/web`, `simple-import-sort` for import ordering.
  `@eslint-react` replaces `eslint-plugin-react`, which doesn't support ESLint 10.
- **Prettier 3** (`singleQuote`, `printWidth: 100`) owns formatting; `eslint-config-prettier` turns off
  conflicting lint rules. `.editorconfig` covers editors that don't run Prettier.

## Addendum · Styling (P0-15, 2026-11-16)

- **CSS Modules + CSS custom properties.** Each component has a `*.module.css` file with scoped,
  camelCase class names (`styles.headerInner`); Vite supports this with no extra dependencies and no
  runtime cost. Chosen over Tailwind to keep markup readable and avoid another build tool and DSL.
- **Design tokens** live only in `apps/web/src/styles/tokens.css` as custom properties: semantic colors
  (`--color-primary`, `--color-text-muted`…), a 4px spacing scale, type scale, radius, shadows and
  motion. Light theme first; a dark theme later only redefines the color tokens.
- **Mobile-first breakpoints:** `40rem` (md) and `64rem` (lg), written as `@media (width >= 40rem)`
  since custom properties can't be used in media queries.
- **Enforced by Stylelint** (`stylelint-config-standard`): hex colors, named colors and color functions
  are errors everywhere except `tokens.css`. Runs in `pnpm lint` and the pre-commit hook.
