# Halcyon — Architecture Note

One page. The pipeline the UI implies, and the controls that make it defensible.

The brief's sharpest line is a prohibition:

> *"The candidate should not allow unrestricted AI-generated SQL to execute without
> validation or control."*

Stated as a prohibition because they have seen people fail it. Everything below exists to
answer it, and the UI was designed to make the answer **visible** rather than merely true.

---

## 1. Shape

```
React + TS (Vite)          Node + TS (Express)              PostgreSQL
─────────────────          ───────────────────              ──────────
  ask a question   ──POST──▶  /api/ask
                              │
                              ├─ 1 validate input     (zod)
                              ├─ 2 route to tables    (schema catalogue)
                              ├─ 3 generate SQL       (LLM or mock, same interface)
                              ├─ 4 GUARD              ◀── the load-bearing step
                              ├─ 5 execute            ──────▶ role halcyon_ro
                              └─ 6 choose output form          READ ONLY tx
                              │                                5s timeout
  render answer    ◀──JSON────┘
```

**Separation.** `client/` and `server/` are separate TS projects with their own tsconfigs,
sharing one `shared/types.ts`. The client never sees a connection string; the server never
renders.

## 2. The six stages

Each stage is a pure, separately testable module. That is not architecture astronomy — it is
what makes stage 4 unit-testable, which is the one the assignment actually grades.

| # | Module | Responsibility |
|---|---|---|
| 1 | `validateInput` | zod: non-empty, <= 500 chars, string. Rejects before any cost. |
| 2 | `routeTables` | Match question against a hand-written schema catalogue. Returns candidate tables + columns, or `null` if nothing is relevant. |
| 3 | `generateSql` | `SqlGenerator` interface. Two implementations: `MockGenerator` (pattern-matched, deterministic) and `LlmGenerator`. Swappable by env var. |
| 4 | **`guardSql`** | **The control. Detailed below.** |
| 5 | `execute` | Parameterised query, read-only transaction, statement timeout, row cap. |
| 6 | `chooseForm` | Result shape -> KPI / table / bar / line. Pure function of the result set. |

**Why the `SqlGenerator` interface matters.** The brief permits a mocked AI. Building both
behind one interface means the safety guard is provably independent of the generator — the
same tests pass whether SQL came from GPT or a regex. That is the point worth making out
loud in the README.

## 3. Stage 4 — the guard

Never trust generated SQL. Five checks, all must pass, fail closed.

| # | Check | Implementation | Blocks |
|---|---|---|---|
| 1 | Single statement | Parse to AST; reject if statement count != 1 | Stacked `; DROP TABLE` |
| 2 | Read-only | AST root node must be `select`. Reject any `insert/update/delete/drop/alter/truncate/grant/copy` | Every write |
| 3 | Table allow-list | Every referenced relation must be one of the four known tables | Reading `pg_catalog`, `pg_user` |
| 4 | Row limit | If no `LIMIT`, append `LIMIT 1000`; if `LIMIT > 1000`, clamp it | Accidental 3m-row scan |
| 5 | Parameters bound | No user string ever concatenated into SQL. Values arrive as `$1, $2` | Injection |

**Parse, do not regex.** Use a real parser (`node-sql-parser` / `pgsql-ast-parser`).
A regex for `/drop/i` is defeated by a comment, a string literal, or casing; an AST is not.
This distinction is worth stating in the README because it is the difference between looking
careful and being careful.

**Defence in depth — the guard is not the only control:**

```sql
CREATE ROLE halcyon_ro LOGIN PASSWORD :'pw';
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM halcyon_ro;
GRANT CONNECT ON DATABASE halcyon TO halcyon_ro;
GRANT USAGE ON SCHEMA public TO halcyon_ro;
GRANT SELECT ON customers, branches, onboarding_applications, transactions TO halcyon_ro;
ALTER ROLE halcyon_ro SET statement_timeout = '5s';
ALTER ROLE halcyon_ro SET default_transaction_read_only = on;
```

Every query additionally runs inside `BEGIN TRANSACTION READ ONLY`. So a write would have to
defeat the AST guard **and** the role grant **and** the transaction mode. The `rejected`
screen in the UI says exactly this — *"two independent controls, both of which held"* — and
it is true, not marketing.

## 4. API contract

One structured envelope for every outcome. The client renders from `status`, never from
guessing at HTTP codes.

```ts
type AskResponse =
  | { status: 'ok';        answer: Answer }
  | { status: 'no_answer'; reason: string; suggestions: string[] }
  | { status: 'blocked';   reason: string; sql: string; checks: Check[] }
  | { status: 'error';     code: string; message: string; traceId: string };

interface Answer {
  summary:  string;                    // the standfirst
  kpis:     Kpi[];
  form:     'kpi' | 'table' | 'bar' | 'line';
  columns:  Column[];
  rows:     Row[];
  audit: {
    sql: string;                       // exactly what ran
    tables: string[];
    checks: Check[];                   // all five, with verdicts
    plan: string;
    rowCount: number;
    elapsedMs: number;
  };
}
```

`audit` is not optional and not a debug field. It is the payload behind "Notes on this
answer", and the UI is built so that an answer without it cannot render.

Note that `blocked` **returns the offending SQL**. Showing the rejected statement is a
feature: a silent refusal cannot be audited.

## 5. Data

Two logically distinct datasets, as required, plus the two that make joins interesting:

| Table | Rows | Purpose |
|---|---|---|
| `customers` | 48,201 | Who. Segment, branch, risk band. |
| `branches` | 32 | Where. |
| `onboarding_applications` | 31,886 | Dataset 1: applications, decisions, timestamps. |
| `transactions` | 2,914,330 | Dataset 2: money movement. |

Seeded by `server/db/seed.ts`, deterministic (fixed RNG seed) so tests are reproducible.
`transactions` is large on purpose — it is what makes the timeout state real rather than
theatrical.

## 6. Security posture

- Read-only DB role, no write grant anywhere.
- AST allow-list validation before execution; fail closed.
- Parameterised queries only; no string interpolation of user input.
- Input capped at 500 chars (prompt-injection surface and cost control).
- Rate limit on `/api/ask`.
- `helmet` + explicit CORS origin.
- Secrets from env only; `.env.example` committed, `.env` git-ignored.
- Errors are sanitised for the client and given a `traceId`; the full error goes to the
  server log. Users get "statement timeout", never a stack trace or schema dump.

## 7. Testing

The brief asks for at least one meaningful automated test. The meaningful one is the guard.

```ts
describe('guardSql', () => {
  it.each([
    ['DROP TABLE customers;',                                'not a SELECT'],
    ['SELECT 1; DROP TABLE customers;',                      'multiple statements'],
    ['DELETE FROM onboarding_applications WHERE 1=1',        'not a SELECT'],
    ['SELECT * FROM pg_catalog.pg_user',                     'table not on allow-list'],
    ["SELECT * FROM customers WHERE name = 'x'; --",         'unbound literal'],
  ])('rejects %s', (sql, reason) => {
    const r = guardSql(sql);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain(reason);
  });

  it('appends a LIMIT when none is present', () => {
    expect(guardSql('SELECT * FROM customers').sql).toMatch(/LIMIT 1000/);
  });
});
```

Plus: one round-trip test per output form, and a `chooseForm` unit test (pure function,
trivially testable, proves the form choice is not hand-waved).

## 8. Productionising — what changes

Worth stating plainly in the README, because "what would you do with more time" is a graded
question:

1. **Cache** question -> SQL. Identical questions should not re-hit the LLM.
2. **Semantic layer.** Hand-written schema catalogue does not scale past ~20 tables. Move to
   a dbt-style metric layer so "revenue" has one definition.
3. **Per-user DB roles + row-level security**, so a branch manager sees only their branch.
4. **Audit log.** Persist every question, generated SQL, verdict and user. In a bank this is
   a regulatory requirement, not a nice-to-have.
5. **Query cost estimation.** `EXPLAIN` before executing; refuse above a cost ceiling instead
   of waiting for the timeout.
6. **Evaluation harness.** A fixed set of question/expected-SQL pairs run in CI, so changing
   the prompt cannot silently regress correctness.
7. **Streaming** the pipeline stages over SSE — the `thinking` state is already designed for
   it.

## 9. Honest limitations

- The router is hand-written matching, not learned. It handles the demo's question space and
  will miss paraphrases outside it.
- No multi-turn context. "Now break that down by branch" is not supported; each question is
  self-contained. Deliberate scope cut.
- No forecasting, by design — see the `rejected` state.
- Mock generator covers the four example questions plus near variants; outside that it
  returns `no_answer` rather than guessing.
