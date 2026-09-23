# Demonstrating Halcyon

Six minutes. The last third is the important part — it is where the product either
holds up or stops being interesting.

```bash
pnpm dev            # then open http://localhost:5173
```

If you have been clicking around beforehand, `pnpm db:reset` gives you an empty
filing cabinet to start from.

---

## 1 · The claim, in one question (60 seconds)

Ask, or click the first starter:

> **Show monthly onboarding applications by customer segment**

Watch the rail on the left as it runs. Six stages, each appearing as the server
reports it finishing, with its real elapsed time. Nothing here is on a timer.

What arrives is not a chart with a caption. It is a **headline stating the finding**,
a **standfirst** carrying the figures in prose, three **pull figures**, and then the
chart. Read the standfirst aloud — that sentence is the product's actual output. The
chart supports it.

Note what the evidence rail says on the right: which tables were read, why a bar chart
rather than a line, and what was assumed. The assumption *"applications are counted by
submission date, not decision date"* is the kind of thing that silently changes a
number in most tools.

## 2 · Show the working (60 seconds)

Open **Notes on this answer**.

The statement is there as it was executed — clause-aligned, every value bound to a
parameter, with the Guard's `LIMIT 1000` visible at the foot rather than applied
silently. This is not a reconstruction or a paraphrase; it is the text that was sent
to the database.

Beside it: the five safety checks, each with its own verdict and the reason for it,
and the per-stage timings.

Then use the buttons. **Copy data — CSV** puts real CSV on your clipboard. **Download
chart** gives you a PNG. Every affordance here works; none of them are decorative.

## 3 · Ask it something it cannot answer (45 seconds)

> **Which customers are likely to default next quarter?**

It declines, and says why: the question asks for a forecast, and there is no
credit-risk data in the schema. Note the specific refusal — the nearest field is
`customers.risk_band`, a static classification set at onboarding, and using it as a
default predictor would be wrong, *so it has not been used*.

It then offers the nearest questions it can actually answer. Click one; it runs
immediately.

**This is the point of the product.** A tool that guesses here is worse than no tool.

## 4 · Try to break it (90 seconds)

The starters page lists probes under *"Try to break it — these are refused on purpose"*.
Use at least two.

> **Show customers; then drop the table**

Blocked before execution. You are shown the exact statement that was refused — `DROP`
in red — and the checks it failed: two statements were submitted where one is
permitted, and a `DROP` is not a read. The checks it *passed* are shown too, because
a partial account of a refusal is not an audit.

> **Show customers named x' OR 1=1 --**

Also refused. Worth saying out loud: the injection never had anywhere to land, because
values are bound, not concatenated — but the Guard refuses it regardless, and the role
holds no write grant regardless of that.

If someone asks whether the read-only role is real rather than claimed:

```bash
pnpm db:verify
```

That script attempts writes as `halcyon_ro` and reports the database refusing each one.

## 5 · Make it fail honestly (45 seconds)

> **Which customers have similar transaction patterns?**

This one is a legitimate question that matches a template, passes all five checks, and
then cannot finish: it is a self-join across 250,000 transactions, and it hits the
five-second statement timeout.

Halcyon reports the timeout with its Postgres error code and the stage it reached. It
shows **no partial result** — a partial answer to a question about totals is worse
than no answer — and offers narrower questions instead.

## 6 · The filing cabinet (30 seconds)

Open **Filed** in the masthead.

Every question is there: answered, unanswerable, blocked and failed alike, with
timings and the tables touched. The refusals are recorded as prominently as the
successes, because an audit log that only keeps the successes is a marketing document.

Re-open the first answer. It comes back exactly as filed — it is **not** re-run. An
answer is a record of what was true when it was asked; quietly refreshing it would
turn the audit trail into a description of the present.

---

## Questions you will probably be asked

**Is there a language model in here?**
Not a hosted one. Generation goes through a provider interface shaped like a completion
API — the cached schema context as a system message, the question as a user message, and
a reply that comes back as untrusted JSON and is validated before anything acts on it.
The mock behind that interface resolves the question through a catalogue of parameterised
templates, so the SQL is deterministic and the suite runs offline with no API key.

Open "Notes on this answer" and it reports the model, the provider, and the token cost
split between the cached schema context and the question. Swapping in a real provider is
one implementation of `LlmProvider` and a change to `LLM_PROVIDER`; the Guard, the
read-only role and the audit log all sit downstream of that boundary and would not move.

**Then how do I know the Guard actually catches AI-written SQL?**
The adversarial probes resolve inside the provider, not in the pipeline. Ask "Delete all
customer records" and the generator returns `DELETE FROM customers`, which the Guard
refuses on the read-only check. The pipeline does not recognise the question in advance —
it refuses the statement on its contents.

**What happens when someone asks something you have not thought of?**
It says it cannot answer, and offers what it can. That is the honest failure mode, and
it is a great deal cheaper to live with than a confident wrong number.

**Could a clever prompt get it to write?**
It would have to defeat four independent controls: the Guard's AST checks, a role with
no write grant, a `READ ONLY` database transaction, and a statement timeout. The
second one is the load-bearing one, and `pnpm db:verify` demonstrates it.

**How much of this is real?**
The database is a real PostgreSQL 18 server. The queries are real SQL against 330,000
seeded rows. The timings are measured. The bank is fictional.

---

## If something goes wrong on the day

| Symptom | Cause | Fix |
| --- | --- | --- |
| Client loads, every question fails | API not running | `pnpm dev` from the repo root, not `client/` |
| "Too many questions in a short time" | 60 asks in a minute | Wait a minute; it is a deliberate bound |
| Figures differ from this document | Seed changed | `pnpm db:reset` restores the documented data |
| Port 4000 in use | An earlier server is still alive | `lsof -ti:4000 \| xargs kill` |
