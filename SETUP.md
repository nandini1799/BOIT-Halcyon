# Setting up Halcyon

Everything below runs from a clone of this repository. You do not need to install
PostgreSQL, you do not need Docker, and you do not need an API key for any model
provider. The database ships as an npm package and runs out of `./.pgdata`.

If you only want the short version:

```bash
pnpm setup
pnpm dev
```

then open <http://localhost:5173>. The rest of this document explains what those two
commands do, how to confirm they worked, and what to try when they do not.

---

## 1. Prerequisites

| Requirement | Version     | Check with                                                       |
| ----------- | ----------- | ---------------------------------------------------------------- |
| Node.js     | 22 or newer | `node --version`                                                 |
| pnpm        | 10 or newer | `pnpm --version`                                                 |
| Disk space  | ~1.5 GB     | for `node_modules`, the Postgres binaries and the seeded cluster |

The repository pins `pnpm@10.31.0` in `package.json`. If you have Corepack enabled,
`corepack enable` will select the right version for you. Otherwise
`npm install -g pnpm@10` is enough.

### Supported platforms

The embedded PostgreSQL binaries are published per platform. These are the ones this
project allows to build:

macOS on Apple Silicon and Intel; Linux on x64, arm64, arm, ia32 and ppc64;
Windows on x64.

There is no binary for Windows on ARM. If that is your machine, use WSL2, or set
`DATABASE_MODE=external` and point the project at a PostgreSQL 14+ server you supply
yourself — see [Using your own PostgreSQL](#using-your-own-postgresql) below.

### Ports

Three ports must be free. Nothing else is bound.

| Port  | Used by                  | Change with               |
| ----- | ------------------------ | ------------------------- |
| 5173  | Vite dev server (the UI) | Vite's `--port` flag      |
| 4000  | Express API              | `PORT` in `.env`          |
| 55432 | Embedded PostgreSQL      | `POSTGRES_PORT` in `.env` |

Port 55432 is deliberately not 5432, so an embedded cluster cannot collide with a
PostgreSQL you already run.

---

## 2. Install and initialise

```bash
git clone <repository-url> halcyon
cd halcyon
pnpm setup
```

`pnpm setup` is three things in sequence:

1. `pnpm install` — installs the workspace, including the PostgreSQL binary for your
   platform.
2. `cp -n .env.example .env` — copies the defaults if, and only if, you do not already
   have a `.env`. An existing file is never overwritten.
3. `pnpm db:setup` — brings the database up.

That third step does the following, printing each as it goes:

- Starts an embedded PostgreSQL 18 server on `localhost:55432`, initialising a new
  cluster in `./.pgdata` if one is not already there. The first initialisation takes a
  few seconds; subsequent starts are immediate.
- Creates the `halcyon` database if it does not exist.
- Applies the on-disk Drizzle migrations from `server/drizzle/`.
- Creates the `halcyon_ro` and `halcyon_app` roles and applies their grants.
- Seeds the four data tables.
- Stops the cluster it started.

Expect output ending in:

```
halcyon  setup complete — run `pnpm dev`
```

The seed is deterministic. `SEED_RNG=halcyon-2026` produces the same 32 branches,
48,000 customers, 32,000 onboarding applications and 250,000 transactions on every
machine, which is why figures quoted in the documentation stay true on yours.

Seeding at the default `demo` scale takes a few seconds. If you want the larger data
set the architecture notes refer to, set `SEED_SCALE=full` in `.env` and run
`pnpm db:seed` — that is roughly 2.9 million transactions and takes appreciably longer.

---

## 3. Run it

```bash
pnpm dev
```

This starts two processes in parallel:

- the API on <http://localhost:4000>, with `tsx watch` restarting it on change;
- the Vite dev server on <http://localhost:5173>, which proxies `/api` to port 4000.

The API starts the embedded cluster itself if it is not already running, and stops it
again on `SIGINT`/`SIGTERM`. You do not need a separate terminal for the database.

Open <http://localhost:5173>. You should see four suggested questions under "Today's
desk". Click one. Six pipeline stages should tick through in order, and an answer
should file itself with a chart and a "Notes on this answer" block beneath it.

---

## 4. Confirm the install is sound

Four checks, in increasing order of thoroughness. All are optional, but the first is
the one worth running — it is the claim the whole product rests on.

### The read-only role genuinely cannot write

```bash
pnpm db:verify
```

This connects as `halcyon_ro` and attempts fourteen operations that should be refused:
writes to each data table, reads of `query_log`, DDL, and a deliberately slow query
that should hit the statement timeout. It prints a verdict per control and exits
non-zero if any behaved differently from specified.

```
halcyon  all 14 database controls behaved as specified
```

### The test suites

```bash
pnpm typecheck   # strict TypeScript across all three packages
pnpm test        # 231 server tests, 3 client tests
pnpm test:e2e    # 22 Playwright tests, including a WCAG 2.1 AA audit
```

The end-to-end suite starts the API and the client itself if they are not already
running, and reuses them if they are. It drives **Google Chrome** rather than
Playwright's bundled Chromium, so Chrome needs to be installed — but nothing needs to
be downloaded. See [Playwright cannot find a browser](#playwright-cannot-find-a-browser)
if that is not true on your machine.

**The server tests share the development database.** They attach to the same cluster
on port 55432 and write real rows to `query_log`. That is intentional — the integration
tests assert against a real PostgreSQL, not a simulation — but it means `pnpm db:setup`
must have run first, and it means the test run will add entries to your history drawer.

### What is actually in the database

```bash
pnpm db:profile
```

Prints the seeded figures the documentation quotes: FY2025 applications by segment,
January-to-December growth, branch rejection rates and the top customers by
transaction value.

---

## 5. Configuration

Every variable has a working default, so `.env` needs no edits for a normal run. The
full list, with defaults, is in [`.env.example`](.env.example). The ones worth knowing
about:

### Database

| Variable             | Default    | What it does                                                          |
| -------------------- | ---------- | --------------------------------------------------------------------- |
| `DATABASE_MODE`      | `embedded` | `embedded` runs PostgreSQL from `./.pgdata`; `external` uses your own |
| `PGDATA_DIR`         | `.pgdata`  | Cluster directory, relative to the repository root                    |
| `POSTGRES_PORT`      | `55432`    | Cluster port                                                          |
| `POSTGRES_DB`        | `halcyon`  | Database name                                                         |
| `DATABASE_URL_OWNER` | unset      | Owner connection string. Only read when `DATABASE_MODE=external`      |

Three roles, each with a distinct job:

| Role        | Default name    | Holds                                                                                                                       |
| ----------- | --------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Owner       | `halcyon_owner` | Everything. Used by setup, migrations and seeding — never by the running API                                                |
| Read-only   | `halcyon_ro`    | `SELECT` on the four data tables, `default_transaction_read_only = on`, a statement timeout. Executes every generated query |
| Application | `halcyon_app`   | `SELECT, INSERT` on `query_log` and nothing else. Writes the audit log and reads history                                    |

The passwords in `.env.example` are development defaults and are not secrets. Replace
them for anything resembling a real deployment — see [PRODUCTION.md](PRODUCTION.md).

### Generation

| Variable       | Default              | What it does                                                                                                                                           |
| -------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `LLM_PROVIDER` | `mock`               | `mock` routes generation through the provider interface with the cached schema context; `catalogue` skips the provider and uses the templates directly |
| `LLM_MODEL`    | `halcyon-sql-mock-1` | Recorded in the audit and shown in the rail                                                                                                            |

There is no API key because there is no network call. `mock` is a real provider
implementation whose inference happens to be deterministic — see
[ADR-0010](docs/adr/0010-the-mock-provider-is-shaped-like-a-real-one.md) for why that
distinction matters, and [PRODUCTION.md](PRODUCTION.md) for what adding a hosted
provider would involve.

### Limits

| Variable               | Default | What it does                                                                |
| ---------------------- | ------- | --------------------------------------------------------------------------- |
| `MAX_QUESTION_LENGTH`  | `500`   | Longer questions are refused at validation                                  |
| `ROW_LIMIT`            | `1000`  | Cap the Guard applies to any statement without one                          |
| `STATEMENT_TIMEOUT_MS` | `5000`  | Set on the `halcyon_ro` role, so it binds regardless of how a query arrives |
| `RATE_LIMIT_MAX`       | `60`    | Requests per minute per IP against `/api/ask`                               |

Changing `STATEMENT_TIMEOUT_MS` requires re-running `pnpm db:migrate`, because it is
applied to the role rather than set per connection.

---

## 6. Command reference

| Command           | What it does                                                       |
| ----------------- | ------------------------------------------------------------------ |
| `pnpm setup`      | Install, create `.env`, build the database                         |
| `pnpm dev`        | API and client together, both watching                             |
| `pnpm build`      | Production build of all three packages                             |
| `pnpm typecheck`  | Strict TypeScript across the workspace                             |
| `pnpm test`       | Unit and integration tests                                         |
| `pnpm test:e2e`   | Playwright, including the accessibility audit                      |
| `pnpm lint`       | Prettier check                                                     |
| `pnpm format`     | Prettier write                                                     |
| `pnpm db:setup`   | Migrate, apply roles, seed                                         |
| `pnpm db:migrate` | Apply migrations and reapply roles                                 |
| `pnpm db:seed`    | Truncate and reseed the four data tables. Leaves `query_log` alone |
| `pnpm db:reset`   | Delete the cluster entirely                                        |
| `pnpm db:verify`  | The fourteen database control checks                               |
| `pnpm db:profile` | Print what was seeded                                              |

Note that `pnpm db:reset` only deletes `./.pgdata`. To get back to a working database,
follow it with `pnpm db:setup`.

---

## 7. When it does not work

### `pnpm setup` fails while installing

Most often the PostgreSQL binary was not built. pnpm requires explicit permission to
run install scripts, and this repository grants it via `pnpm.onlyBuiltDependencies` in
the root `package.json`. If you see a warning about ignored build scripts, run
`pnpm approve-builds` and then `pnpm install` again.

### Something is already listening on 55432

The setup scripts attach to whatever is on that port rather than failing, which is
convenient when the API already has the cluster open and confusing when the listener
is something else entirely. If migrations then fail with authentication or protocol
errors, that is what happened. Either stop the other process, or set a different
`POSTGRES_PORT` in `.env` and run `pnpm db:setup` again.

`pnpm db:reset` refuses to delete the cluster while anything is listening on the
configured port. Stop `pnpm dev` first.

### The cluster directory exists but will not start

A `./.pgdata` that is not a valid cluster — a partial initialisation, or one written by
a different PostgreSQL major version — cannot be repaired in place. Delete and rebuild:

```bash
pnpm db:reset
pnpm db:setup
```

Nothing is lost but the seed and your query history, both of which are regenerated.

### Tests fail with missing tables or missing roles

The test suites attach to the development cluster and do not migrate it themselves.
Run `pnpm db:setup` first.

### The UI loads but every question fails

Check the API is up:

```bash
curl http://localhost:4000/api/health
# {"status":"ok"}
```

If it is, the likely cause is CORS. The server allows exactly one origin, set by
`CLIENT_ORIGIN` and defaulting to `http://localhost:5173`. If Vite started on a
different port because 5173 was taken, update `CLIENT_ORIGIN` to match and restart.

### Stages appear all at once instead of ticking through

That is a proxy buffering the event stream. The Vite dev proxy is configured not to,
and the server sends `X-Accel-Buffering: no`, but a corporate proxy in between may
ignore both. It is cosmetic — the answer is unaffected.

### Playwright cannot find a browser

`client/playwright.config.ts` sets `channel: 'chrome'`, so the suite drives an
installed Google Chrome. This was deliberate: the machine it was written on could not
reach the CDN Playwright downloads Chromium from, and Chrome is the same engine.

If you have no Chrome but can reach the CDN, drop the channel and use the bundled
browser instead:

```bash
pnpm --filter @halcyon/client exec playwright install chromium
```

then remove `channel: 'chrome'` from the `desktop` project in the config.

---

## Using your own PostgreSQL

If you would rather not run the embedded cluster — because your platform has no binary,
or because you want the data somewhere durable — point the project at your own server.
It needs PostgreSQL 14 or newer and the `pgcrypto` functions available for
`gen_random_uuid()`, which is built in from 13 onwards.

In `.env`:

```bash
DATABASE_MODE=external
DATABASE_URL_OWNER=postgres://owner:password@your-host:5432/halcyon
POSTGRES_HOST=your-host
POSTGRES_PORT=5432
POSTGRES_DB=halcyon
```

`DATABASE_URL_OWNER` overrides only the owner connection. The read-only and audit
connections are still assembled from `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`
and their respective user variables, so those must describe the same server.

Then:

```bash
pnpm db:setup
```

The owner role must be able to create databases, create roles and grant privileges.
Everything else — the two restricted roles, their grants, the timeouts — is applied by
the setup script exactly as it is for the embedded cluster.
