---
status: accepted
---

# Drizzle owns the schema, not the query path

Drizzle defines the schema in TypeScript and drives migrations, the seed, and `query_log` writes. It does **not** execute the SQL that answers questions. That SQL is produced by a Question Template, inspected by the Guard, and executed as raw parameterised text through the `pg` driver inside a read-only database transaction.

This will look backwards to a reader who expects an ORM to own database access, so: the product exists to generate, inspect and execute SQL as a first-class artefact that the user reads. An ORM's job is to hide SQL. Routing the hot path through Drizzle would mean either abandoning the audit trail or reconstructing the SQL text for display, which would mean showing the user a query that is not the one that ran.

## Consequences

The Guard's table allow-list and the router's schema catalogue are both **derived from the Drizzle schema** rather than hand-maintained, so a security control cannot silently drift out of step with the real tables. Adding a table to the schema without deciding whether it belongs on the allow-list becomes a compile-time decision rather than an oversight.
