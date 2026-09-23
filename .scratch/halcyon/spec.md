# Halcyon — Build Spec

Status: awaiting confirmation before implementation starts.

The requirement is `docs/init.md`. The approved design is `_design/conversational-data-analyst/v2/` (direction B, Broadsheet, approved 2026-09-22). This spec records what we agreed in the grilling session and is the single source of truth for the build. Vocabulary is fixed by `CONTEXT.md`; the load-bearing decisions have ADRs in `docs/adr/`.

---

## 1. Decisions

| # | Decision | Recorded in |
|---|---|---|
| 1 | Monorepo: `client/`, `server/`, `shared/` under pnpm workspaces, no task runner | ADR-0001 |
| 2 | Real PostgreSQL 18 shipped via npm (`embedded-postgres`); PGlite for tests; no Docker | ADR-0002 |
| 3 | Drizzle owns schema, migrations, seed and `query_log`; generated SQL runs as raw parameterised text | ADR-0003 |
| 4 | No LLM. A Question Catalogue of templates behind the `SqlGenerator` interface | ADR-0004 |
| 5 | Chat history and the audit log are one `query_log` table, written via a second least-privilege connection | ADR-0005 |
| 6 | "Chat-style" is satisfied by a collapsible left history drawer, not a transcript | ADR-0006 |
| 7 | Pipeline stages streamed over SSE, never simulated | ADR-0007 |
| 8 | Fully responsive, overriding the design's desktop-only limitation | ADR-0008 |

Settled without an ADR: Recharts as the chart library (already fixed by `brand-spec.md` and design rule 8); Express and zod (already fixed by the architecture note); Tailwind v4 built on the existing `tailwind-theme.css`; shadcn/ui taken selectively and fully restyled; Framer Motion scoped to the answer feed and history drawer only; Vitest plus Playwright.

---

## 2. Stack

**Client** — React 18+, TypeScript strict, Vite, Tailwind v4, Recharts, shadcn/ui (Sheet, Collapsible, Toast, Tooltip, Table, Button only — radius and shadows stripped, colours remapped to Halcyon tokens), Framer Motion (answer feed and drawer only).

**Server** — Node + TypeScript strict, Express, zod, `pg`, Drizzle ORM, `node-sql-parser` (pg dialect) for the Guard, `helmet`, `express-rate-limit`, `cors` with an explicit origin.

**Database** — real PostgreSQL 18.4, shipped as npm binaries via `embedded-postgres` and run from a git-ignored `.pgdata/` in the repo. No Docker, no Homebrew, nothing installed outside the project. An external `DATABASE_URL_OWNER` is accepted for anyone who prefers their own server. PGlite 18.3 in tests.

**Tests** — Vitest for unit and integration, Playwright for end-to-end.

TypeScript is strict everywhere, with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` on, and branded types for identifiers. "Strong TypeScript usage" is an explicitly graded line in the brief.

---

## 3. Repository layout

```
/
├── CONTEXT.md                  glossary
├── AGENTS.md
├── README.md                   architecture, assumptions, limitations, AI disclosure
├── DEMO.md                     the question script, every state
├── .env.example
├── pnpm-workspace.yaml
├── docs/
│   ├── adr/                    0001–0008
│   ├── agents/                 issue tracker, triage labels, domain docs
│   └── design/                 curated from _design: design-doc, architecture-note,
│                               PRODUCT, brand-spec, approved direction, v2 screenshots
├── shared/                     the API contract, imported by both ends
├── server/
│   └── src/
│       ├── db/                 drizzle schema, migrations, seed, two connection pools
│       ├── pipeline/           the six stages, one module each
│       ├── catalogue/          question templates + adversarial templates
│       ├── routes/             /api/ask (SSE), /api/history, /api/schema
│       └── lib/                errors, logging, config
└── client/
    └── src/
        ├── components/         masthead, ask bar, story, evidence rail,
        │                       notes drawer, history drawer, charts
        ├── hooks/              useAskStream, useHistory
        └── styles/             tailwind theme (from tailwind-theme.css)
```

---

## 4. Data model

Four data tables, as the architecture note specifies, plus the audit table.

**`branches`** — `id`, `code`, `name`, `city`, `region`, `opened_on`.

**`customers`** — `id`, `name`, `segment` (`retail` | `sme` | `corporate` | `private_banking`), `branch_id` → branches, `risk_band` (`low` | `medium` | `high`), `onboarded_on`, `status`.

**`onboarding_applications`** — `id`, `customer_id` (nullable — an application may be declined before a customer exists), `branch_id` → branches, `segment`, `submitted_at`, `decided_at`, `decision` (`approved` | `rejected` | `pending`), `rejection_reason`, `channel`.

**`transactions`** — `id`, `customer_id` → customers, `branch_id` → branches, `occurred_at`, `amount_minor` (bigint, minor units — never a float for money), `currency`, `direction` (`credit` | `debit`), `category`.

**`query_log`** — `id`, `asked_at`, `question`, `outcome` (`answered` | `unanswerable` | `blocked` | `failed`), `template_id`, `sql_text`, `checks` (jsonb), `tables_touched` (text[]), `row_count`, `elapsed_ms`, `trace_id`, `answer` (jsonb, the full filed Answer). Written for every outcome, especially Blocked and Failed.

`query_log` is **not** on the Guard's allow-list.

### Roles

```sql
halcyon_ro   SELECT on the four data tables only
             default_transaction_read_only = on
             statement_timeout = '5s'

halcyon_app  SELECT, INSERT on query_log only
```

Created by `pnpm db:setup`, which runs against any Postgres — the embedded one or your own. The application holds two pools and never crosses them.

---

## 5. Seed

One deterministic generator (fixed RNG seed) at three scales, selected by `SEED_SCALE`:

| Scale | Transactions | Purpose |
|---|---|---|
| `demo` (default) | ~250,000 | Reviewer is running in seconds |
| `full` | ~2,900,000 | Matches the architecture note; volume alone triggers the timeout |
| `test` | ~5,000 | PGlite integration tests |

Loaded via `COPY`, not row-by-row inserts. Branches ~32, customers ~48,000, applications ~32,000 at demo and full scale — those are cheap, only `transactions` scales.

Data is shaped to resemble the approved mock — Retail dominant by volume, SME growing fastest, a plausible spread of branch rejection rates — without hardcoding the mock's exact figures. **Every number the UI displays, including the evidence rail's row counts, is queried live.** Nothing quoted in the interface is a literal.

---

## 6. The pipeline

Six stages, one module each, each independently testable, each emitting an SSE event on completion.

| # | Stage | Responsibility |
|---|---|---|
| 1 | `validateInput` | zod: non-empty string, ≤ 500 chars. Rejects before any cost |
| 2 | `route` | Match the question against the Question Catalogue. Returns a matched Template and its bound parameters, or nothing |
| 3 | `generateSql` | `SqlGenerator` interface. `CatalogueGenerator` emits parameterised SQL from the matched Template. An LLM implementation is deliberately absent |
| 4 | `guard` | The control. Five checks, all must pass, fails closed |
| 5 | `execute` | Parameterised query as `halcyon_ro`, inside `BEGIN TRANSACTION READ ONLY`, 5s statement timeout, row cap |
| 6 | `chooseForm` | Pure function from result shape to `kpi` \| `table` \| `bar` \| `line` |

### The Guard

Parse to AST with `node-sql-parser` (pg dialect). Never regex.

| # | Check | Blocks |
|---|---|---|
| 1 | Exactly one statement | Stacked `; DROP TABLE` |
| 2 | Root node is `select` | Every write and every DDL |
| 3 | Every referenced relation is on the allow-list (derived from the Drizzle schema) | `pg_catalog`, `pg_user`, `query_log` |
| 4 | Row limit — append `LIMIT 1000` if absent; **refuse** if the statement demands more | Unbounded scans |
| 5 | No user value concatenated into SQL; all values arrive as `$1, $2` | Injection |

All five verdicts are returned to the client on every outcome, pass or fail.

---

## 7. The Question Catalogue

Twelve answerable templates. Each carries: an id, canonical phrasing, a synonym list, bound parameters, parameterised SQL, the prose it produces, its expected Form, and its related templates (for "you could also ask").

| id | Canonical question | Tables | Form |
|---|---|---|---|
| `onboarding-by-month-segment` | Show monthly onboarding applications by customer segment | applications | grouped bar + KPIs |
| `branch-rejection-rate` | Which branches have the highest rejection rate? | applications, branches | horizontal bar + table |
| `compare-segments` | Compare retail and SME onboarding volumes | applications | paired bar + head-to-head |
| `top-customers-by-value` | Show the top five customers by transaction value | transactions, customers, branches | table + line |
| `transaction-value-trend` | How has transaction value moved over the year? | transactions | line |
| `approval-rate-over-time` | How has the approval rate changed over time? | applications | line |
| `customers-by-segment` | How many customers do we have in each segment? | customers | bar + KPI |
| `transactions-by-branch` | Which branches handle the most transaction value? | transactions, branches | horizontal bar |
| `average-transaction-by-segment` | What is the average transaction value by segment? | transactions, customers | bar |
| `applications-by-branch` | How many applications has each branch taken? | applications, branches | table |
| `customers-by-risk-band` | How are customers distributed across risk bands? | customers | bar + KPI |
| `customer-similarity` | Which customers have similar transaction patterns? | transactions (self-join) | table — **deliberately expensive; this is the honest timeout** |

The first four are the brief's examples and are the empty state's starters.

### Adversarial templates

A separately namespaced, explicitly flagged set whose SQL is unsafe by design, so the Guard has something real to refuse. They are never executed — the Guard fails closed and `halcyon_ro` could not run them regardless.

| id | Question | Fails check |
|---|---|---|
| `adv-delete-customers` | Delete all customer records | 2 — not a SELECT |
| `adv-drop-transactions` | Drop the transactions table | 2 — not a SELECT |
| `adv-stacked-statement` | Show customers; then drop the table | 1 — multiple statements |
| `adv-read-pg-catalog` | List the database users | 3 — table not on allow-list |
| `adv-unbounded-scan` | Show me every transaction ever | 4 — demands more rows than the cap |
| `adv-injected-predicate` | Show customers named `x' OR 1=1 --` | 5 — value concatenated, not bound |

Six probes, not the five originally listed: the original set left check 5 with nothing exercising it, so every check now has exactly one demonstration. A test asserts both that each probe is refused by the check it targets and that the probes collectively cover all five checks, so a check can never be added without a demonstration.

Surfaced in the UI as "test the guard" probes. If one ever passes, the suite fails.

**Parser constraint.** `node-sql-parser` does not accept PostgreSQL's `$1::text` cast syntax, though it accepts `column::text` and `CAST($1 AS text)`. Templates therefore write `CAST(...)` around bound parameters. The Guard being stricter than the database fails in the safe direction — valid SQL may be refused, invalid SQL cannot slip through — but it does constrain what the catalogue may emit, and the SQL builder tests are what catch a violation.

### Unanswerable examples

"Forecast next quarter's onboarding" (no forecasting, by design), "show me employee salaries" (no such data), "what's the weather". Each returns the nearest Templates as suggestions.

---

## 8. API

`POST /api/ask` — Server-Sent Events. Stage events as each completes, then one terminal event carrying the envelope:

```ts
type AskResponse =
  | { status: 'answered';     answer: Answer }
  | { status: 'unanswerable'; reason: string; suggestions: Suggestion[] }
  | { status: 'blocked';      reason: string; sql: string; checks: Check[] }
  | { status: 'failed';       code: string; message: string; traceId: string };
```

`Answer` carries `summary`, `kpis`, `form`, `columns`, `rows`, `related`, and a non-optional `audit` block of `{ sql, tables, checks, plan, rowCount, elapsedMs, stageTimings }`. An Answer without an audit cannot be constructed — the type forbids it.

`GET /api/history` — filed answers from `query_log`, newest first, for the drawer.
`GET /api/history/:id` — one filed Answer, restored unchanged.
`GET /api/schema` — the four tables with live row counts, for the evidence rail.

Status names match `CONTEXT.md` exactly: `answered`, `unanswerable`, `blocked`, `failed`. The word "rejected" appears in this product only as a bank decision on an application.

---

## 9. Client

**Layout** — masthead, ask bar at the top, the story column capped at 62ch, evidence rail on the right, history drawer sliding from the left. Below ~1280px the rail moves beneath the story; below ~1024px the drawer becomes a full overlay sheet and charts reflow.

**States** — empty (four starters), thinking (live SSE stages), answered, unanswerable, blocked, failed. Plus the history drawer open, and the notes drawer open.

**Copy affordances** — copy answer text, copy data as CSV, copy data as JSON, copy SQL, download chart as PNG. All real, all confirmed by a toast. The design's mock had these inert; here they work.

**Design rules that are non-negotiable** — radius 0 everywhere; no `box-shadow` anywhere; one accent (salmon) meaning "the system is speaking"; red for errors only, never a chart series; every figure mono, tabular, right-aligned; every chart carries a caption and a source line; body prose never uses `--color-ink-low`; nothing Recharts cannot reproduce.

**Accessibility** — WCAG 2.2 AA. Body ≥ 14px. Contrast measured. Charts never encode by colour alone; every bar prints its value. `:focus-visible` on everything, 2px salmon, never removed. `prefers-reduced-motion` respected globally. Drawers are real buttons with `aria-expanded`.

---

## 10. Security posture

Read-only role for all generated SQL. AST allow-list validation, fail closed. Parameterised queries only. 500-char input cap. Rate limit on `/api/ask`. `helmet` and an explicit CORS origin. Secrets from env only; `.env.example` committed, `.env` ignored. Errors sanitised for the client and given a trace id; full detail to the server log. The user sees "statement timeout", never a stack trace or a schema dump.

---

## 11. Testing

**Unit (Vitest, no database)** — the Guard against a table of malicious inputs; the property test over every adversarial template; the template resolver; the SQL builder; `chooseForm`.

**Integration (Vitest + PGlite)** — one round trip per output Form; the read-only transaction genuinely refusing a write; the audit row being written for every outcome.

**Evaluation harness** — every catalogue template's canonical question and its synonyms resolve to the expected template and SQL. Changing the catalogue cannot silently regress the question space.

**End-to-end (Playwright)** — empty → answered → history drawer → restored answer; a blocked probe; the timeout. Screenshots from these runs go in the README.

---

## 12. Deliverables

`README.md` covering architecture, assumptions, completed functionality, known limitations, how it would be productionised, and the AI-tooling disclosure with a clear statement of which decisions were made personally. `DEMO.md` with the full question script covering every state. `.env.example`. Schema and seed scripts (`db:setup`, `db:verify`, `db:profile`). The curated design docs under `docs/design/`.

---

## 13. Build order

1. Workspace scaffold, embedded Postgres, the two roles, `.env.example` — prove `pnpm setup` and both dev servers start from a clean clone
2. Drizzle schema, migrations, the scaled seed — prove the data is real and queryable
3. The Guard and its test suite — the highest-value piece, built and proven first
4. The Question Catalogue and the SQL builder, with the evaluation harness
5. The pipeline end to end, SSE, the audit log, the two pools
6. Tailwind theme compiled and verified, shadcn primitives restyled
7. The client: masthead, ask bar, story, evidence rail, notes drawer, charts
8. The history drawer and restored answers
9. Responsive work, accessibility pass
10. Playwright, README, DEMO, curated design docs

---

## 14. Known deviations from the approved design

1. A history drawer exists; the design had no history (ADR-0006).
2. Responsive to mobile; the design was desktop-only (ADR-0008).
3. Outcome vocabulary renamed — the design's `rejected` state splits into `unanswerable` and `blocked`, because `rejection` is a banking term about applications (`CONTEXT.md`).
4. Copy affordances work; the mock's were inert.
5. Adversarial templates exist in the product; the design assumed the blocked state arose from an LLM misbehaving.
6. Check 4 refuses rather than clamps. The original wording said "clamp if higher", but a clamp and a refusal cannot both be true of `adv-unbounded-scan`, and silently returning different rows than the statement asked for is what the audit trail exists to prevent. A missing limit is still filled in — that is a convenience, not a change of meaning.
7. Check 5 forbids **all** string literals in generated SQL rather than looking for injection patterns. Templates must bind every value as `$n`. This is stronger because it does not require anticipating what an attack looks like: concatenation becomes inexpressible. Numeric literals stay legal, so `GROUP BY 1` and `LIMIT 1000` are unaffected.
8. Two figures in the mock do not survive being computed. Both are corrected by querying, and no copy may restate either:
   - The mock's standfirst says the bank took **8,378** applications in FY2025 and that retail's 6,575 is 78.5% of them. Its own four monthly series sum to **9,361**, of which retail is 70.2%. The seed follows the series, so the UI reports ~70%.
   - The mock's KPI bar says the fastest-growing segment is **SME** at +81.4%. By the mock's own series, private banking grows +142% and corporate +94%, both faster. The seed reproduces that ordering (private banking +140%, corporate +81%, SME +70%, retail +69%), so the KPI must compute the fastest segment rather than name one. The `compare` state is unaffected: it pits retail against SME only, and SME does grow faster than retail.
9. A refused statement is displayed exactly as it was submitted, not as the Guard rewrote it. Check 4 appends a `LIMIT` before check 3 has finished deciding, so a statement refused for touching `pg_catalog` would otherwise be shown with a limit it never had. An audit trail that edits its evidence is not an audit trail.
10. The form is chosen from the result's shape, but the template's declared form breaks ties where several forms are honest. Twelve months by four segments reads equally well as lines or grouped bars, and the design asked for bars. The data can still veto: a template that declares `bar` gets a table when the result is too wide to chart without dropping columns.
11. Results are pivoted into wide shape server-side. SQL produces `(month, segment, applications)`; Recharts wants one row per month with a column per segment. Reshaping here means the client never transforms data it did not compute.
12. `query_log` gained a `reason` column. Restoring a blocked or failed question from history needs the explanation that was given at the time, and reconstructing it later would risk describing the present rather than the past.
13. Risk bands are seeded 62/28/10 rather than uniformly. A bank with a third of its customers rated high risk is not a bank, and a uniform split is the clearest possible tell that data was generated rather than observed.

---

## 15. Deferred, and stated as such in the README

No multi-turn context — each Question is self-contained. No forecasting. No authentication or per-user roles. No caching of question → SQL. No semantic layer. No query cost estimation before execution. No deployment target.
