# ADR-0009 — The audit shows the statement as written

**Status**: Accepted
**Date**: 2026-09-22

## Context

The Guard bounds every result set. When a generated statement carries no `LIMIT`,
one is added before execution.

The obvious way to add it is to set the limit on the parsed tree and ask the parser to
print the tree back out. `node-sql-parser` will do this, and the statement it returns
is correct.

It is also not the statement anyone wrote. The parser emits a single line, quotes
every identifier, and uppercases type names, so a hand-written query like this:

```sql
SELECT to_char(date_trunc(CAST($1 AS text), submitted_at), CAST($2 AS text)) AS month,
       segment::text AS segment,
       count(*)::int AS applications
  FROM onboarding_applications
 WHERE submitted_at >= CAST($3 AS timestamptz)
 GROUP BY 1, 2
```

comes back as one unbroken line of `SELECT ... AS "month", ... FROM
"onboarding_applications" WHERE ... LIMIT 1000`.

We were printing that under the heading **"Query as executed"**.

It was true, in that the two statements mean the same thing to Postgres. But the
product's whole argument is that you can read the query and check the answer. Showing
a machine's paraphrase under that heading asks the reader to trust a transformation
they cannot see, at exactly the moment we are inviting them not to trust us. A
reviewer who knows SQL and finds an unreadable reconstruction learns something true
about how much care went into the claim.

## Decision

The row bound is **appended to the statement as written**, and the result is
re-parsed to confirm the bound landed as a limit.

```
original text → strip any trailing semicolon → append "\n LIMIT <cap>"
              → re-parse → assert the limit is the cap
```

If the re-parse does not show the expected limit, the parser's reconstruction is used
instead. An ugly statement that is definitely bounded beats a readable one that might
not be.

Three cases are covered by tests in `guard.test.ts`: a statement gains the bound with
its formatting untouched, an already-bounded statement is returned byte-for-byte, and
a statement ending in a semicolon is bounded rather than having the limit stranded
after the terminator.

## Consequences

**The audit block is readable.** Clause-aligned SQL, as authored, with the Guard's
`LIMIT 1000` visible on its own line at the foot — so the reader can see both the
query and the fact that the system bounded it.

**The displayed text is the executed text.** Not equivalent to it; the same string.
This is the property worth having, and it is stronger than what we had before.

**A textual transformation now sits in the Guard.** This is the part to be uneasy
about: the Guard's other work is all AST-based, deliberately, because text
manipulation is how SQL controls get defeated. The mitigation is that this
transformation is append-only, runs after every safety check has passed, and is
verified by re-parsing — the check is on the tree, as everything else here is.

**A future generator that emits ugly SQL gets an ugly audit block.** Correct. The
audit shows what was run. If that becomes unreadable, the honest fix is to format the
SQL at generation time, where the change is visible, and not to quietly beautify it
on the way to the screen.
