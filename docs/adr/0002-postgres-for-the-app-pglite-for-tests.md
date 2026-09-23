---
status: accepted
---

# Real PostgreSQL, shipped through npm; PGlite for the tests

The product's central claim is that generated SQL cannot do damage, and the strongest part of that claim is not the Guard — it is the layer beneath it: a login role with `SELECT` on four tables and nothing else, `default_transaction_read_only`, and a `statement_timeout` that bounds the cost of any query.

That requires a real PostgreSQL **server**. We get one from npm: `embedded-postgres` ships genuine PostgreSQL 18.4 binaries as platform-specific optional dependencies, covering macOS arm64 and x64, five Linux architectures, and Windows x64. `pnpm db:start` initialises a cluster in the repo and runs it on a local port. No Docker, no Homebrew, no system package — `pnpm install` is the whole install step.

The app also accepts an external `DATABASE_URL`, so anyone with their own Postgres can point at it instead. Production would always do that; the embedded cluster is for local development and review.

Tests run against PGlite — PostgreSQL compiled to WebAssembly, in-process — at the same major version (18.3 against the server's 18.4), so the dialect is identical and `pnpm test` is green on a bare clone with nothing started. The sole exception is the timeout integration test, which is tagged and runs against the real server, for the reason below.

## Considered options

Alternatives were rejected on measurement, recorded here because each looks viable and will otherwise be re-proposed.

**Docker Compose** was the original decision and was reversed. Beyond the setup burden it places on a reviewer, it is not achievable on the network this was built on: `registry-1.docker.io` is unreachable, as are `formulae.brew.sh` and `ftp.postgresql.org`. A `docker-compose.yml` would have been shipped untested. npm is the only reliable package source here, which is what led to `embedded-postgres`.

**PGlite for everything** would also have removed Docker. Its role support is real — `CREATE ROLE`, `GRANT`, `REVOKE` and `SET ROLE` all work and are enforced; as `halcyon_ro` an `INSERT`, a `DROP` and an ungranted table were each denied — and performance is ample at 250k rows inserted in 240ms. It was rejected because **`statement_timeout` is accepted and then ignored**: set to 250ms, a heavy query ran to completion in 36,946ms, including inside an explicit read-only transaction with `SET LOCAL`. Single-threaded WebAssembly has no signal mechanism to interrupt a running query. A timeout we cannot enforce means the Failed outcome would have to be simulated, which ADR-0007 forbids. The embedded server, by contrast, cancelled a runaway query at 2,002ms against a 2s limit.

**SQLite** was seriously considered for its zero-setup story. Two common objections to it proved wrong. Its authorizer hook is a genuine second control and more granular than Postgres `GRANT`s: with a one-table allow-list it permitted a `SELECT` on that table while refusing `sqlite_master`, `DELETE`, `DROP`, `ATTACH` and `PRAGMA`, all below the SQL layer. And although the mature drivers are synchronous, a worker thread keeps the server responsive — the main thread missed no heartbeat across a 15-second query. It was rejected on the objection that held: **a runaway query cannot be cancelled.** `worker.terminate()`, called 1.5s into a heavy query, had not resolved 15s later, because the thread sits inside native code until the query finishes. Real cancellation would need a child-process pool with `SIGKILL`. Secondary costs: no `date_trunc`, so the SQL in the approved design screenshots would be rewritten; and `node:sqlite` is still flagged experimental on Node 24.

Once `embedded-postgres` was found, SQLite's only remaining advantage — zero setup — disappeared, while its disadvantages did not.

## Consequences

Setup for a reviewer is `pnpm install && pnpm db:setup && pnpm dev`. Nothing is installed outside the repository; the cluster lives in a git-ignored directory and `pnpm db:reset` deletes it.

Every release of `embedded-postgres` carries a `-beta` suffix, including the one its `latest` tag points at — that is the wrapper's versioning convention rather than an unstable prerelease, and the PostgreSQL binary it ships is stable 18.4. It is a development and review convenience: the application only ever sees a connection string, so production points at a managed Postgres with no code change.

First run pays a one-off cluster initialisation of roughly 7 seconds. Subsequent starts take about 150ms.
