# 0001 · Stack & repository layout

- **Status:** Accepted
- **Date:** 2026-11-16
- **Card:** P0-01

## Context

Whim is a ~5-week build of a React web app and a Node API that share domain types
and validation schemas. Every later card (lint, CI, tests, provider clients, planner)
lands on these choices, so they are fixed up front.

## Decision

| Area | Choice | Rationale |
|---|---|---|
| Language | TypeScript everywhere, `strict` | One type system across FE, BE and shared domain code. |
| Module system | ESM (`"type": "module"`) | Native in Node and Vite; avoids dual CJS/ESM config. |
| Node version | Node 26 (Active LTS), pinned in `.nvmrc` + `engines` | Current LTS line; matches the local dev machine. |
| Package manager | pnpm workspaces, version pinned via `packageManager` | Strict, non-hoisted deps catch undeclared imports between workspaces; fast, disk-efficient installs; good `--filter` fan-out for root scripts. |
| Monorepo layout | `apps/web`, `apps/api`, `packages/shared` (scope `@whim/*`) | Two deployables plus one shared package for domain types and schemas. |
| FE build tool | Vite + React | Fast dev server, simple config, first-class TS; shares config with Vitest. |
| BE framework | Express 5 | Widely known, large middleware ecosystem; v5 forwards rejected promises from async handlers to error middleware. |
| Test runner | Vitest (v8 coverage) for all workspaces | Native TS/ESM, reuses Vite config, Jest-compatible API, built-in coverage thresholds. |
| Supporting libs (assumed, confirmed by their cards) | Zod (P0-06), supertest (P0-07), pino + pino-http (P0-12), React Testing Library + jsdom (P0-14), TanStack Query (P0-17) | Listed so later cards don't re-litigate them. |
| API dev runner | `tsx watch` | Runs TS directly in dev without a build step. |

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
