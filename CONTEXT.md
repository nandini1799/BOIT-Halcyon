# Halcyon

A conversational data analyst for a fictional retail and commercial bank. A business user asks a question in plain English; Halcyon resolves it to a known query, executes it read-only, and files the answer with the query attached.

## Language

### The product

**Halcyon**:
The product. A fictional institution's internal analyst tool.
_Avoid_: the app, the dashboard, the chatbot

**Question**:
The plain-English business question a user submits. Always self-contained — Halcyon carries no conversational context between questions.
_Avoid_: query (reserved for SQL), prompt, message

**Answer**:
The filed response to one Question: a headline claim, a standfirst, pull figures, a visual form, and the audit that produced it. An Answer is immutable once filed; re-opening one from history shows what was filed, never a fresh result.
_Avoid_: response, result, reply, message

**Filed**:
The act of committing an Answer to history. A filed Answer has a timestamp, a cost and a row count, and is retrievable later unchanged.

### Anatomy of an Answer

**Kicker**:
The uppercase line above the headline carrying section, elapsed time and row count.

**Headline**:
The Answer stated as a claim, in serif display type.

**Standfirst**:
The paragraph beneath the headline that states the answer in prose with its figures in bold. The product's primary output.
_Avoid_: summary, description, blurb

**Pull figure**:
One of the two-to-three numbers in the KPI row worth remembering.
_Avoid_: KPI card, metric card, stat

**Form**:
The visual shape chosen for an Answer's data: `kpi`, `table`, `bar` or `line`. Chosen by the system from the result set, never by the user.
_Avoid_: chart type, visualisation, widget

**Evidence rail**:
The panel showing which tables were drawn on, what was assumed, why this Form was chosen, and what else you could ask.
_Avoid_: sidebar, right panel, metadata panel

**Audit**:
The record of how an Answer was produced: the SQL as executed, the tables touched, every Safety Check with its verdict, the plan cost, the row count and the elapsed time. First-class product content, never debug output. Surfaced under "Notes on this answer".
_Avoid_: debug info, metadata, trace

### Resolving a question

**Question Catalogue**:
The set of Question Templates Halcyon can answer. Its contents are the product's true capability, and the product advertises them rather than hiding them.

**Question Template**:
One canonical question pattern with its synonyms, its parameterised SQL, and the prose and Form it produces. A Question is answerable only if it matches a Template.
_Avoid_: intent, pattern, rule

**Routing**:
Deciding which tables a Question concerns, and which Template it matches.

**Guard**:
The control that inspects generated SQL before execution and fails closed. Independent of whatever produced the SQL.
_Avoid_: validator, sanitiser, filter

**Safety Check**:
One of the Guard's five verdicts — single statement, read-only, tables on allow-list, row limit enforced, parameters bound. All five are shown to the user with their individual verdicts, whether or not they passed.

**Allow-list**:
The set of tables generated SQL may reference. Derived from the schema, so it cannot drift from the real tables.

### The four outcomes

A Question produces exactly one of these. The words are not interchangeable, and `rejection` is deliberately absent from all four — see below.

**Answered**:
A Template matched, the Guard passed, the query returned rows. The user gets a filed Answer.

**Unanswerable**:
No Template matched, or the Question concerns data Halcyon does not hold. Nothing was executed. The user gets the nearest Templates as suggestions.
_Avoid_: rejected, failed, unsupported, invalid

**Blocked**:
SQL was produced but the Guard refused it. The offending statement is shown to the user with the failing Safety Check marked, because a silent refusal cannot be audited.
_Avoid_: rejected, denied, forbidden

**Failed**:
A Template matched and the Guard passed, but execution did not complete — most often a statement timeout. An honest technical failure, carrying a trace identifier.
_Avoid_: error state, crash, broken

### The bank's own language

**Rejection**:
A bank decision declining an Onboarding Application. **This word belongs exclusively to the banking domain.** It never describes Halcyon refusing a Question — that is Unanswerable or Blocked. "Rejection rate" is a business metric about applications, and nothing else.

**Customer**:
A person or organisation holding a relationship with the bank. Belongs to one Segment, one Branch and one risk band.
_Avoid_: client, user, account holder

**User**:
The bank employee asking Halcyon a question. Never a Customer.
_Avoid_: analyst, operator

**Branch**:
A physical location of the bank. Owns Customers and processes Onboarding Applications.

**Segment**:
The customer classification: Retail, SME, Corporate or Private Banking.
_Avoid_: tier, category, class, cohort

**Onboarding Application**:
A submitted request to become a Customer, carrying a submission timestamp and a decision (approved or rejected).
_Avoid_: signup, application form, KYC case

**Transaction**:
A single movement of money against a Customer. Never used to mean a database transaction — that is always written "database transaction".
_Avoid_: payment, transfer, txn
