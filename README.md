# Halcyon

A conversational data analyst for a fictional retail and commercial bank. A business
user asks a question in plain English; Halcyon resolves it to a known query, executes
it read-only, and files the answer with the query attached.

The interesting claim is not that it answers questions. It is that **you can check it**.
Every answer carries the statement that produced it, the five safety checks it passed,
the tables it read and what it assumed — and every refusal explains itself just as
fully as a success.

## Running it

You need Node 22+ and pnpm 10+. You do not need Postgres, Docker, or an API key.

```bash
pnpm setup   # installs, writes .env, starts an embedded Postgres, migrates, seeds
pnpm dev     # API on :4000, client on :5173
```

Open <http://localhost:5173>. The database is a real PostgreSQL 18 server shipped via
npm and run out of `./.pgdata` — nothing is installed outside this repository.

Full instructions, including what to do when something does not work, are in
[SETUP.md](SETUP.md).

| Command          | What it does                                                 |
| ---------------- | ------------------------------------------------------------ |
| `pnpm test`      | Unit and integration tests across all packages               |
| `pnpm test:e2e`  | Playwright suite, including a WCAG AA audit of every state   |
| `pnpm typecheck` | Strict TypeScript across the workspace                       |
| `pnpm db:verify` | Proves the read-only role genuinely cannot write — 14 checks |
| `pnpm db:reset`  | Deletes the cluster; follow with `pnpm db:setup` to rebuild  |

## How a question becomes an answer

Six stages, streamed to the browser as each one finishes.

1. **Validate input** — length and shape only.
2. **Route to tables** — which of the four tables the question concerns.
3. **Generate SQL** — the question and the cached schema context go to the provider;
   the reply comes back as untrusted JSON and is validated before it is believed.
4. **Safety checks** — the Guard parses the returned statement and fails closed.
5. **Execute read-only** — inside a `READ ONLY` database transaction, under a
   five-second statement timeout, as a role holding no write grant.
6. **Choose output form** — the shape of the result decides the shape of the answer.

Stage events are real. The rail in the UI is driven by what the server actually
reported, not by a timer — see [ADR-0007](docs/adr/0007-pipeline-stages-are-streamed-not-simulated.md).
Every stage, every event and every failure path is drawn in [ARCHITECTURE.md](ARCHITECTURE.md).

## Why it can be trusted

Four independent controls, each of which would be sufficient on its own to prevent a
write, and none of which is relied upon alone.

**The Guard** parses generated SQL and checks five things: one statement only,
read-only verb, every table on an allow-list derived from the schema, a row limit
enforced, every value bound rather than concatenated. It works on the AST, never on
the text, because a regular expression can be defeated by a comment or an unusual
quote and a parser cannot. Anything it does not positively understand is refused.

**The role** holds `SELECT` and nothing else, with `default_transaction_read_only`
set on the role itself. If the Guard were bypassed entirely, the database would still
refuse the write. `pnpm db:verify` demonstrates this rather than asserting it.

**The transaction** is opened `READ ONLY` and carries a statement timeout, so a valid
but ruinous query is cancelled rather than allowed to exhaust the connection.

**The audit log** records every question — answered, unanswerable, blocked or failed —
with the statement, the checks and the timings. History and the audit log are the same
table, so the record cannot diverge from what the user is shown
([ADR-0005](docs/adr/0005-history-and-the-audit-log-are-one-table.md)).

**The generator** is a provider, and the mock is shaped like a hosted one: the schema
context goes in as a system message, the question as a user message, and the reply
comes back as untrusted JSON that is parsed and validated before anything acts on it.
The schema description is derived from the Drizzle definitions and built once per
process — roughly 560 tokens, paid for once rather than on every question — and the
rail reports the figure under "How the query was written" so the claim can be checked.

Row data never leaves the building. The model is sent the schema and the question;
it is never sent a result set. Narration is done locally from the returned rows, so
no customer record is ever part of a prompt.

What does the thinking behind that interface is the Question Catalogue: parameterised
templates, matched by keyword, with no network call and no API key, so the suite stays
reproducible offline
([ADR-0004](docs/adr/0004-no-llm-a-question-catalogue-behind-a-generator-interface.md)).
Swapping in a hosted model means writing one `LlmProvider` and setting `LLM_PROVIDER`;
every control above sits downstream of the boundary and would not move
([ADR-0010](docs/adr/0010-the-mock-provider-is-shaped-like-a-real-one.md)).

Because generation runs through the provider, the adversarial probes resolve there too.
`DELETE FROM customers` arrives **from the generator** and is refused by the Guard on
its contents — not recognised in advance by the pipeline as a question to decline.

## What it will not do

A question outside the catalogue is **unanswerable**, and says so with the nearest
questions it can answer. It does not guess, and it does not approximate. Asked to
forecast, it explains that it reports what is recorded and that the nearest field —
a risk band set at onboarding — would be wrong to use as a default predictor.

A statement that fails a safety check is **blocked**, and the refused statement is
printed with the failing check marked. A silent refusal cannot be audited.

A query that cannot finish inside five seconds **fails**, with its error code and
trace. No partial result is shown, because a partial answer to a question about
totals is worse than no answer.

## The shape of the repository

```
client/    React 19, Vite, Tailwind v4, Recharts. The reading experience.
server/    Express, Drizzle, node-sql-parser. The pipeline and the Guard.
  llm/     The provider interface, the mock behind it, and the cached schema context.
shared/    Types crossing the wire. One definition, both ends.
docs/adr/  Decisions, with the reasoning and the evidence that settled them.
CONTEXT.md The project's vocabulary. Worth reading before the code.
```

Two connection pools, deliberately: queries run as `halcyon_ro`, the audit log is
written by `halcyon_app`. A read that cannot write and a writer that can only append
to one table.

## Accessibility

The Playwright suite runs an axe audit against WCAG 2.1 AA on the empty, answered,
table-view, generator-card-open, notes-open, blocked and history-open states, and fails
on any violation. Beyond the automated pass: nothing is encoded by colour alone — every
safety check carries an icon as well as a colour, every pipeline stage states its status
in words, and the figures behind every chart are one keyboard-reachable toggle away.
Motion is limited to two movements, both of which respect `prefers-reduced-motion`.

## Documentation

| Document                           | What it covers                                                     |
| ---------------------------------- | ------------------------------------------------------------------ |
| [SETUP.md](SETUP.md)               | Getting it running, from prerequisites to a verified install       |
| [ARCHITECTURE.md](ARCHITECTURE.md) | How a question flows through the system, in diagrams               |
| [PRODUCTION.md](PRODUCTION.md)     | What a real deployment would change, and what it would cost        |
| [QUESTIONS.md](QUESTIONS.md)       | What to ask: five verified questions for each of the four outcomes |
| [DEMO.md](DEMO.md)                 | A six-minute walkthrough, including the parts designed to fail     |
| [MYPROCESS.md](MYPROCESS.md)       | How it was built: models, process, cost, and the AI disclosure     |
| [CONTEXT.md](CONTEXT.md)           | The project's vocabulary. Worth reading before the code            |
| [docs/adr/](docs/adr/)             | Ten decisions, with the reasoning that settled each one            |

## Notes for a reviewer

- Seed data is deterministic. The same `SEED_RNG` yields the same bank every time, so
  figures quoted in the documentation stay true.
- Nothing here is a real credential, and the bank, its customers and its transactions
  are fictional.
