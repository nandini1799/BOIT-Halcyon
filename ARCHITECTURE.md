# Architecture

How a question becomes an answer, and what stops it becoming something else.

This document is the map. [CONTEXT.md](CONTEXT.md) defines the vocabulary it uses,
[docs/adr/](docs/adr/) records why each decision was taken, and
[PRODUCTION.md](PRODUCTION.md) covers what would change under real load with a real
model.

---

## 1. The system at a glance

Three packages and one database. The client renders, the server decides, and the
database is reached through two connections that hold different powers.

```mermaid
flowchart LR
  subgraph Browser
    UI["React 19 + Vite<br/>client/"]
  end

  subgraph Server["Express API — server/"]
    direction TB
    R["Routes<br/>/api/ask · /api/history · /api/schema"]
    P["Pipeline<br/>six stages"]
    G["Guard<br/>node-sql-parser"]
    L["LLM boundary<br/>provider + cached schema context"]
    R --> P
    P --> L
    L --> G
  end

  subgraph PG["PostgreSQL 18"]
    direction TB
    D[("branches · customers<br/>onboarding_applications · transactions")]
    Q[("query_log")]
  end

  UI -- "POST /api/ask<br/>SSE response" --> R
  G -- "halcyon_ro<br/>SELECT only, READ ONLY txn" --> D
  P -- "halcyon_app<br/>INSERT only" --> Q

  SH["shared/<br/>types crossing the wire"] -.-> UI
  SH -.-> R
```

`shared/` holds every type that crosses the network, defined once and imported by both
ends, so a change to the wire format is a compile error rather than a runtime surprise.

---

## 2. The request, end to end

`POST /api/ask` responds with Server-Sent Events. Each of the six stages emits a
`running` frame and then a `done` or `skipped` frame, and a final `result` frame
carries the outcome. The client uses `fetch` rather than `EventSource`, because
`EventSource` cannot send a request body.

Every frame is the same shape on the wire — `data: <JSON>\n\n` — and the JSON's `type`
field discriminates. There are no named SSE events.

```mermaid
sequenceDiagram
  autonumber
  participant B as Browser
  participant A as POST /api/ask
  participant PL as Pipeline
  participant LLM as Provider
  participant GD as Guard
  participant RO as halcyon_ro
  participant AU as halcyon_app

  B->>A: {"question": "..."}
  A-->>B: 200 text/event-stream

  PL->>PL: traceId = randomUUID()

  Note over PL: 1 · validate
  PL-->>B: stage validate running
  PL-->>B: stage validate done · "52 characters"

  Note over PL: 2 · route
  PL-->>B: stage route running
  PL-->>B: stage route done · "onboarding_applications"

  Note over PL: 3 · generate
  PL-->>B: stage generate running
  PL->>LLM: system = cached schema context<br/>user = the question
  LLM-->>PL: untrusted JSON reply
  PL->>PL: JSON.parse + zod validate
  PL-->>B: stage generate done · "halcyon-sql-mock-1 · 675 tokens"

  Note over PL: 4 · guard
  PL-->>B: stage guard running
  PL->>GD: statement + bound parameters
  GD-->>PL: five verdicts, possibly a row bound
  PL-->>B: stage guard done · "5 of 5 checks passed"

  Note over PL: 5 · execute
  PL-->>B: stage execute running
  PL->>RO: BEGIN TRANSACTION READ ONLY
  PL->>RO: EXPLAIN (FORMAT JSON) …
  PL->>RO: the parameterised statement
  RO-->>PL: rows
  PL->>RO: COMMIT
  PL-->>B: stage execute done · "12 rows in 69ms"

  Note over PL: 6 · choose-form
  PL-->>B: stage choose-form running
  PL-->>B: stage choose-form done · "bar"

  PL->>AU: INSERT INTO query_log
  PL-->>B: result · {"status":"answered", …}
```

Two details in that diagram are load-bearing.

**The audit row is written before the terminal frame is sent.** The user cannot be
shown an answer that was not recorded.

**Timings are measured, not simulated.** The client holds each completed stage on
screen for a minimum of 260 ms so the sequence is legible, but the numbers it displays
are the server's own — see
[ADR-0007](docs/adr/0007-pipeline-stages-are-streamed-not-simulated.md).

---

## 3. The six stages and the four outcomes

Every question ends in exactly one of four outcomes. Stages after the deciding one are
not skipped silently: each emits a `skipped` frame carrying the reason, so the UI can
show where the pipeline stopped and why.

```mermaid
flowchart TD
  START([question]) --> V{"1 · validate<br/>length and shape"}
  V -- fails --> U1["<b>Unanswerable</b><br/>the validation message"]
  V -- passes --> RT{"2 · route<br/>does a Template match?"}

  RT -- "no match" --> U2["<b>Unanswerable</b><br/>+ nearest questions"]
  RT -- matched --> GEN{"3 · generate<br/>ask the provider"}

  GEN -- "not JSON" --> U3["<b>Unanswerable</b><br/>'not JSON'"]
  GEN -- "wrong shape" --> U4["<b>Unanswerable</b><br/>'unexpected shape'"]
  GEN -- "answerable: false" --> U5["<b>Unanswerable</b><br/>the model's reason"]
  GEN -- "a statement" --> GD{"4 · guard<br/>five checks on the AST"}

  GD -- "any check fails" --> BL["<b>Blocked</b><br/>the refused statement,<br/>the failing check marked"]
  GD -- "all five pass" --> EX{"5 · execute<br/>READ ONLY transaction"}

  EX -- "57014" --> F1["<b>Failed</b><br/>statement_timeout"]
  EX -- "other error" --> F2["<b>Failed</b><br/>execution_error"]
  EX -- rows --> CF["6 · choose-form<br/>kpi · table · bar · line"]

  CF --> ANS["<b>Answered</b><br/>headline, standfirst,<br/>figures, chart, audit"]

  ANS --> LOG[("query_log")]
  U1 --> LOG
  U2 --> LOG
  U3 --> LOG
  U4 --> LOG
  U5 --> LOG
  BL --> LOG
  F1 --> LOG
  F2 --> LOG
```

Note that three of the five Unanswerable paths did not exist before generation ran
through a provider. A reply that is not JSON, is JSON of the wrong shape, or declines
the question are failure modes only a model has. They settle as ordinary outcomes with
a sentence explaining what arrived, rather than as exceptions.

The words matter and are not interchangeable — **Unanswerable** means nothing was
executed, **Blocked** means a statement existed and was refused, **Failed** means a
permitted statement did not complete. [CONTEXT.md](CONTEXT.md) is strict about this,
and `rejection` is reserved for what a bank does to an onboarding application.

---

## 4. The Guard

The Guard is the control that makes generated SQL safe to run. It sits downstream of
the generator precisely because a generator cannot be trusted the way a template can.

It parses the statement once with `node-sql-parser` in PostgreSQL dialect and works
entirely on the resulting tree. It never inspects the text, because a regular
expression can be defeated by a comment, an unusual quote or a nested construct, and a
parser cannot. If parsing throws, all five checks are marked failed with the parse
error, and nothing reaches the database. It fails closed.

```mermaid
flowchart TD
  IN([generated SQL + parameters]) --> PARSE{"parse<br/>node-sql-parser · PostgreSQL"}
  PARSE -- throws --> CLOSED["all five checks fail<br/><b>Blocked</b>"]
  PARSE -- ast --> C1

  C1{"1 · One statement<br/>exactly one parsed statement?"}
  C1 -- no --> FAIL
  C1 -- yes --> C2

  C2{"2 · Read-only<br/>every statement type = select?"}
  C2 -- no --> FAIL
  C2 -- yes --> C3

  C3{"3 · Known tables only<br/>every base table in DATA_TABLES?<br/>CTE names excluded · schema must be public"}
  C3 -- no --> FAIL
  C3 -- yes --> C4

  C4{"4 · Row limit"}
  C4 -- "LIMIT &gt; cap" --> FAIL
  C4 -- "LIMIT ≤ cap" --> C5
  C4 -- "no LIMIT" --> INJECT["append LIMIT 1000<br/>re-parse to confirm it landed"]
  INJECT --> C5

  C5{"5 · Values bound<br/>no string literals in the tree<br/>distinct $n count = parameters.length"}
  C5 -- no --> FAIL
  C5 -- yes --> PASS(["<b>all five pass</b><br/>→ execute"])

  FAIL(["<b>Blocked</b><br/>statement shown as submitted"])
```

Four things about this worth stating plainly.

**The allow-list is derived, not written down.** It is built from `DATA_TABLES`, the
same constant the schema exports. A table added to the database is not readable until
it is added there, and `query_log` is absent from it — which is why a generated query
cannot read the audit log even though the audit log is in the same database.

**The row limit is injected, not merely checked.** A statement without a `LIMIT` gets
one appended to the text as written, and the result is re-parsed to confirm the bound
actually landed. Appending rather than reconstructing from the tree matters, because
`sqlify()` returns the parser's idea of the statement — its own casing, its own quoting,
all on one line — and the audit block would then be showing a paraphrase under the
heading "as executed". See
[ADR-0009](docs/adr/0009-the-audit-shows-the-statement-as-written.md).

**String literals are refused outright.** Not escaped, not quoted — refused. The check
walks the whole tree for `single_quote_string`, `string` and `double_quote_string`
nodes, and requires the count of distinct `$n` placeholders to equal the number of
parameters supplied. Numeric literals are permitted.

**A refusal shows what was submitted.** Not the Guard's rewrite. An audit trail that
edits the evidence before presenting it is not an audit trail.

---

## 5. Defence in depth

Four independent controls. Each would be sufficient on its own to prevent a write, and
none is relied on alone. The diagram reads downward: each branch asks what would happen
if every control above it had failed.

```mermaid
flowchart TD
  ATT(["a write reaches the pipeline<br/>however it got there"]) --> C1

  C1{"<b>① The Guard</b> — in the application<br/>parses the AST · fails closed"}
  C1 -- "statement type is not select" --> S1["<b>Blocked</b><br/>refused statement shown, audited"]
  C1 -- "suppose the Guard were bypassed" --> C2

  C2{"<b>② The role</b> — database privileges<br/>halcyon_ro holds SELECT on four tables<br/>and no INSERT, UPDATE, DELETE or DDL grant anywhere"}
  C2 -- "permission denied for table" --> S2["<b>Failed</b><br/>execution_error, audited"]
  C2 -- "suppose a grant were wrong" --> C3

  C3{"<b>③ The transaction</b> — session state<br/>BEGIN TRANSACTION READ ONLY<br/>default_transaction_read_only = on for the role"}
  C3 -- "cannot execute in a read-only transaction" --> S3["<b>Failed</b><br/>execution_error, audited"]
  C3 -- "suppose all three had failed" --> C4

  C4["<b>④ The audit log</b> — after the fact<br/>every outcome written before it is shown, by halcyon_app,<br/>which holds no grant on the bank's data"]
  C4 --> S4(["the write is not prevented,<br/>but it cannot happen unrecorded"])
```

The same three rings bound cost as well as damage: `statement_timeout = 5s` and
`idle_in_transaction_session_timeout = 10s` are set on the role, and the Guard caps
rows at 1,000. A valid but ruinous query is cancelled rather than allowed to exhaust
the connection pool.

The second ring is the one worth dwelling on, because it is the one that holds if the
application is wrong. `pnpm db:verify` connects as `halcyon_ro` and attempts fourteen
operations that should fail — writes to each data table, reads of `query_log`, DDL, and
a query designed to exceed the timeout. It demonstrates the claim rather than asserting
it.

The separation in the fourth ring is deliberate and slightly unusual: the role that
writes the audit log holds no grant on the bank's data, and the role that reads the
bank's data holds no grant on the audit log. Neither can forge the other's evidence.

---

## 6. The LLM boundary

Generation goes through a provider whose interface is the shape a hosted completion
API has: messages in, content and a token count out. `mockProvider` implements it
without a network. Swapping in a hosted model is an implementation of `LlmProvider`
and a value in `LLM_PROVIDER` — nothing downstream moves.

```mermaid
flowchart LR
  Q([question]) --> GEN

  subgraph GEN["generateSql — server/src/llm/generator.ts"]
    direction TB
    CTX{"schema context<br/>cached?"}
    CTX -- no --> BUILD["build from Drizzle definitions<br/>4 tables · 30 columns · 5 FKs · 5 rules<br/>~2,240 chars ≈ 560 tokens"]
    CTX -- yes --> USE
    BUILD --> USE["hold for process lifetime"]
    USE --> MSG["messages = [<br/>&nbsp;&nbsp;system: schema context,<br/>&nbsp;&nbsp;user: the question<br/>]"]
  end

  MSG --> PROV["LlmProvider.complete<br/>temperature 0"]

  PROV --> MOCK["mockProvider<br/><i>inference = Question Catalogue</i>"]
  PROV -.-> HOSTED["a hosted model<br/><i>not implemented</i>"]

  MOCK --> REPLY(["reply — a string, untrusted"])
  HOSTED -.-> REPLY

  REPLY --> J{"JSON.parse"}
  J -- throws --> UA1["Unanswerable"]
  J -- ok --> Z{"zod discriminated union<br/>on 'answerable'"}
  Z -- invalid --> UA2["Unanswerable"]
  Z -- "answerable: false" --> UA3["Unanswerable"]
  Z -- "answerable: true" --> PLAN([SqlPlan → the Guard])
```

**What is real and what is mocked.** The context, the message roles, the token
accounting, the untrusted reply and its validation are all genuine. Only the inference
in the middle is deterministic — the mock resolves the question through the Question
Catalogue. The statement that reaches the Guard is byte-identical to what the catalogue
produced before the provider existed, which is why every pre-existing test passed
unchanged when this was introduced.
[ADR-0010](docs/adr/0010-the-mock-provider-is-shaped-like-a-real-one.md) sets out the
reasoning; [ADR-0004](docs/adr/0004-no-llm-a-question-catalogue-behind-a-generator-interface.md)
is the decision it amends.

**Adversarial probes resolve inside the provider.** `DELETE FROM customers` arrives
_from the generator_ and is refused by the Guard on its contents. The demonstration is
not the pipeline recognising a question it was told in advance to decline.

**The context is cached because it is invariant.** A description assembled per question
is a cost paid on every request and a description that can drift from the database. The
cache is `cached ??= build()` and holds for the process lifetime, which is sound here
because the schema cannot change under a running server. Under continuous deployment
with online migrations it would not be — see
[PRODUCTION.md](PRODUCTION.md#the-schema-context-problem), which treats this as the
central question a real deployment has to answer.

**Row data never reaches the model.** The model is sent the schema and the question. It
is not sent results. Narration — the headline, the standfirst, the pull figures — is
computed locally from the returned rows. No customer record is ever part of a prompt.

---

## 7. Scenario: a question that is answered

> _"Show monthly onboarding applications by customer segment"_

```mermaid
sequenceDiagram
  autonumber
  participant U as User
  participant C as Client
  participant P as Pipeline
  participant M as mockProvider
  participant G as Guard
  participant DB as halcyon_ro
  participant AL as query_log

  U->>C: clicks the suggested question
  C->>P: POST /api/ask

  P->>P: validate — 52 characters, within 500
  P->>P: route — matches a Template over onboarding_applications

  P->>M: system 560 tok + user 15 tok, temperature 0
  M-->>P: {"answerable":true,"sql":"SELECT to_char(…)","parameters":["month","YYYY-MM","2025-01-01","2026-01-01"]}
  Note right of P: 575 prompt / 100 reply tokens<br/>context served from cache

  P->>G: the statement and its four parameters
  G->>G: 1 statement ✓ · SELECT ✓ · onboarding_applications ✓
  G->>G: no LIMIT → append LIMIT 1000, re-parse ✓
  G->>G: 4 distinct $n = 4 parameters, no string literals ✓
  G-->>P: pass, with the bounded statement

  P->>DB: BEGIN TRANSACTION READ ONLY
  P->>DB: EXPLAIN (FORMAT JSON) … → cost 3574.7
  P->>DB: the statement, parameters bound
  DB-->>P: 12 rows × 4 series
  P->>DB: COMMIT

  P->>P: choose-form — 12 periods × 4 categories → bar
  P->>P: narrate — headline, standfirst, three pull figures

  P->>AL: INSERT outcome=answered, sql, checks, tables, rows, trace
  P-->>C: result — answered
  C-->>U: a filed answer, the chart, and the notes beneath it
```

The user sees the headline claim, a figure row, a grouped bar chart with a
chart/table toggle, and "Notes on this answer" containing the statement as executed,
the bound values, the five checks and the stage timings. The rail carries the tables
read, why a bar was chosen, what was assumed, and — collapsed — the model, provider and
token counts.

---

## 8. Scenario: a question that is blocked

> _"Delete all customer records"_

This is the path the product exists to demonstrate, so it is worth being precise about
where the refusal happens.

```mermaid
sequenceDiagram
  autonumber
  participant U as User
  participant C as Client
  participant P as Pipeline
  participant M as mockProvider
  participant G as Guard
  participant DB as halcyon_ro
  participant AL as query_log

  U->>C: asks the probe from the home page
  C->>P: POST /api/ask

  P->>P: validate — within length ✓
  P->>P: route — a probe, tables unverified

  P->>M: system 560 tok + user 12 tok
  M-->>P: {"answerable":true,"sql":"DELETE FROM customers","parameters":[]}
  Note right of P: the generator produced a write.<br/>Nothing so far has objected.

  P->>G: DELETE FROM customers
  G->>G: parse → one statement ✓
  G->>G: type = 'delete' ✗ <b>read-only fails</b>
  G->>G: customers is allow-listed ✓
  G->>G: no LIMIT → bound applied ✓
  G->>G: no literals, 0 = 0 parameters ✓
  G-->>P: <b>refused</b> — 4 of 5 passed

  Note over P,DB: the database is never opened
  P--xDB: no connection acquired

  P->>AL: INSERT outcome=blocked, refused sql, all five checks
  P-->>C: result — blocked
  C-->>U: "Blocked before execution"<br/>the statement, with Read-only marked failed
```

Three things this shows that a hardcoded refusal would not.

The statement came **from the generator**, not from a list of questions the pipeline was
told to decline. The Guard refused it on **its contents** — the parsed statement type —
not on the wording of the question. And **the other four checks still ran and still
report**, because a refusal that says only "no" cannot be audited; the user is shown
that four controls passed and precisely which one did not.

If the Guard were removed entirely, the statement would reach a role with no `DELETE`
grant inside a `READ ONLY` transaction, and PostgreSQL would refuse it. That is ring
two of [Defence in depth](#5-defence-in-depth), and `pnpm db:verify` demonstrates it.

---

## 9. Data model

Four tables the user can ask about, and one they cannot.

```mermaid
erDiagram
  BRANCHES ||--o{ CUSTOMERS : "employs"
  BRANCHES ||--o{ ONBOARDING_APPLICATIONS : "processes"
  BRANCHES ||--o{ TRANSACTIONS : "books"
  CUSTOMERS ||--o{ ONBOARDING_APPLICATIONS : "became"
  CUSTOMERS ||--o{ TRANSACTIONS : "makes"

  BRANCHES {
    integer id PK
    text code UK
    text name
    text city
    text region
    timestamptz opened_on
  }
  CUSTOMERS {
    integer id PK
    text name
    enum segment "retail|sme|corporate|private_banking"
    integer branch_id FK
    enum risk_band "low|medium|high"
    timestamptz onboarded_on
    text status
  }
  ONBOARDING_APPLICATIONS {
    integer id PK
    integer customer_id FK "null if declined pre-customer"
    integer branch_id FK
    enum segment
    timestamptz submitted_at
    timestamptz decided_at "null while pending"
    enum decision "approved|rejected|pending"
    text rejection_reason "null unless rejected"
    text channel
  }
  TRANSACTIONS {
    integer id PK
    integer customer_id FK
    integer branch_id FK
    timestamptz occurred_at
    bigint amount_minor "pence, never pounds"
    text currency
    enum direction "credit|debit"
    text category
  }
  QUERY_LOG {
    uuid id PK
    timestamptz asked_at
    text question
    enum outcome "answered|unanswerable|blocked|failed"
    text sql_text
    jsonb checks
    text_array tables_touched
    integer row_count
    integer elapsed_ms
    text trace_id
    jsonb answer
  }
```

`query_log` is drawn apart from the others because it is unreachable from a question.
It is excluded in four independent places: it is not in `DATA_TABLES`, `halcyon_ro`
holds no grant on it, the Guard's allow-list is derived from `DATA_TABLES` so a
reference to it fails check three, and it is absent from the schema context so the
model has never been told it exists.

The same table is both the audit log and the history drawer, so the record the
compliance officer would read and the record the user sees cannot diverge —
[ADR-0005](docs/adr/0005-history-and-the-audit-log-are-one-table.md).

At the default `demo` seed scale: 32 branches, 48,000 customers, 32,000 onboarding
applications, 250,000 transactions.

---

## 10. Where things live

| Concern                                             | Path                                                      |
| --------------------------------------------------- | --------------------------------------------------------- |
| HTTP surface, middleware, CORS, rate limits         | `server/src/app.ts`                                       |
| The SSE endpoint                                    | `server/src/routes/ask.ts`                                |
| The six stages, and which outcome each produces     | `server/src/pipeline/ask.ts`                              |
| The five safety checks                              | `server/src/pipeline/guard.ts`                            |
| Read-only execution, timeouts, error classification | `server/src/pipeline/execute.ts`                          |
| Form selection and narration                        | `server/src/pipeline/choose-form.ts`, `narrate.ts`        |
| The provider contract and the mock                  | `server/src/llm/provider.ts`                              |
| Reply validation and token accounting               | `server/src/llm/generator.ts`                             |
| The cached schema context                           | `server/src/llm/schema-context.ts`                        |
| Question Templates, routing, adversarial probes     | `server/src/catalogue/`                                   |
| Roles, grants, pools                                | `server/src/db/roles.ts`, `pools.ts`                      |
| Audit writes                                        | `server/src/db/audit.ts`                                  |
| Wire types, shared by both ends                     | `shared/src/index.ts`                                     |
| Client state machine and stream reader              | `client/src/hooks/use-ask.ts`, `client/src/api/client.ts` |
