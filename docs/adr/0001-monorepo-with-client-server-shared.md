---
status: accepted
---

# Monorepo: `client/`, `server/`, `shared/` under pnpm workspaces

The brief requires TypeScript on both ends and grades "clear frontend and backend separation", so the two halves must be visibly separate projects rather than one blurred codebase. We keep them in a single pnpm workspace with three packages — `client/` (React + Vite), `server/` (Node + Express) and `shared/` (the API contract types) — each with its own `tsconfig.json`. `shared/` exists so the `AskResponse` envelope is defined exactly once and both ends fail to compile if they disagree about it.

No task runner. Three packages do not justify Turborepo, and plain pnpm scripts keep the root `package.json` readable by someone who has never seen this repo.

## Consequences

The client can never import from `server/`, and this is enforced by the workspace dependency graph rather than by convention — `client/` simply does not list `server/` as a dependency. A reviewer needs pnpm, which `corepack enable` provides; the version is pinned via the `packageManager` field.
