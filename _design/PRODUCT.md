# PRODUCT.md — Halcyon

**What it is.** Halcyon is a conversational data analyst for a retail/commercial bank. A
business user types a question in plain English; Halcyon decides which tables are relevant,
constructs a read-only SQL query, validates it, runs it, and returns a textual answer plus
the right visual form — KPI card, table, bar chart or line chart.

**Who uses it.** A generic business user inside the bank: someone who owns a number but
does not write SQL. Branch operations, onboarding leads, segment managers. They are
numerate and impatient. They do not want to learn a BI tool. They will forward the answer
to someone more senior, so the answer has to be copyable and defensible.

**Brand voice vs product voice.** The brand voice is institutional and quiet — a bank does
not shout. The product voice is precise and literal: it states what it did, names the tables
it used, and says "I can't answer that" without apologising three times. No exclamation
marks. No emoji. Never claim more certainty than the data supports.

**Standing constraint — the audit trail is the feature.** Every answer must be traceable to
a query the user can read. The generated SQL, the tables it touched, and the verdict of the
safety validator are first-class product content, not debug output. An answer the user
cannot verify is worth less than no answer.

**Standing constraint — nothing destructive is reachable.** The product surface must make
it obvious that Halcyon can only read. This is a trust affordance as much as a control.

**Scope note.** This is a technical-screening exercise. The bank, its branches, its
customers and every figure shown are fictional and must be labelled as such.
