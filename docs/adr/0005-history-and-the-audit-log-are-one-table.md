## status: accepted

# Chat history and the audit log are the same table

Every Question and its outcome is written to a `query_log` row holding the question text, the SQL as executed, every Safety Check verdict, the outcome, timings, and the full Answer payload as `jsonb`. The history drawer reads from this table. There is no separate client-side history.

The two features are the same data. Halcyon's own architecture note files a persistent audit log under future work, calling it "a regulatory requirement, not a nice-to-have" in a bank. Building history any other way would mean building the same record twice and shipping the less defensible copy.

## Consequences

**It forces privilege separation, which is a feature.** The application cannot write an audit row using the read-only role that executes generated SQL. So there are two connections: `halcyon_ro` with `SELECT` on the four data tables, used for every generated query; and `halcyon_app` with `INSERT` on `query_log` and nothing else. Neither can do the other's job.

---

`query_log` **is not on the Guard's allow-list**, so generated SQL cannot read or write the audit trail even if the Guard were defeated. Audit rows are written for Blocked and Failed outcomes too — especially those.

**Answers are immutable.** Opening a past entry renders the stored payload rather than re-running the query. A filed Answer that silently changes when reopened would undermine the entire premise; re-asking remains available as an explicit action.