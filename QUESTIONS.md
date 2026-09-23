# What to ask Halcyon

Every question in this document was run against the API and its outcome recorded. Nothing
here is a guess about what the product would probably do.

A question lands in exactly one of four places, and all four are designed outcomes. A
refusal is not a failure of the product; it is the product working.

| Outcome          | Meaning                                             | What you see                                             |
| ---------------- | --------------------------------------------------- | -------------------------------------------------------- |
| **Answered**     | Matched a catalogue template, passed the Guard, ran | Headline, figures, chart or table, and the statement     |
| **Unanswerable** | Understood, and declined for a stated reason        | The reason, and the nearest questions it can answer      |
| **Blocked**      | A statement was generated and the Guard refused it  | The refused SQL and which of the five checks failed      |
| **Failed**       | Passed every check and then could not finish        | The error code, the stage reached, and no partial result |

- [Answered](#answered)
- [Unanswerable](#unanswerable)
- [Blocked](#blocked)
- [Failed](#failed)
- [Not an outcome: the rate limit](#not-an-outcome-the-rate-limit)
- [Reproducing this list](#reproducing-this-list)

---

## Answered

Five to start with. The first four are the examples from the brief.

| #   | Question                                                 | Form  | Rows |
| --- | -------------------------------------------------------- | ----- | ---: |
| 1   | Show monthly onboarding applications by customer segment | bar   |   12 |
| 2   | Which branches have the highest rejection rate?          | bar   |   32 |
| 3   | Compare retail and SME onboarding volumes                | bar   |   12 |
| 4   | Show the top five customers by transaction value         | table |    5 |
| 5   | How has transaction value moved over the year?           | line  |   12 |

Those five cover all three output forms. Row counts are from the default `demo` seed, which
is deterministic — the same `SEED_RNG` produces the same bank every time.

### All twelve templates

The catalogue holds twelve questions. Eleven answer; the twelfth is deliberately too
expensive and is covered under [Failed](#failed).

| Question                                                 | Form  | Rows | Tables read                       |
| -------------------------------------------------------- | ----- | ---: | --------------------------------- |
| Show monthly onboarding applications by customer segment | bar   |   12 | onboarding_applications           |
| Which branches have the highest rejection rate?          | bar   |   32 | onboarding_applications, branches |
| Compare retail and SME onboarding volumes                | bar   |   12 | onboarding_applications           |
| What is the average transaction value by segment?        | bar   |    4 | transactions, customers           |
| How are customers distributed across risk bands?         | bar   |    3 | customers                         |
| Show the top five customers by transaction value         | table |    5 | transactions, customers, branches |
| How has the approval rate changed over time?             | line  |   12 | onboarding_applications           |
| How has transaction value moved over the year?           | line  |   12 | transactions                      |
| Which branches handle the most transaction value?        | bar   |   32 | transactions, branches            |
| How many applications has each branch taken?             | table |   32 | onboarding_applications, branches |
| How many customers do we have in each segment?           | bar   |    4 | customers                         |
| Which customers have similar transaction patterns?       | —     |    — | times out, by design              |

### You do not have to phrase it exactly

Routing matches on synonym groups, not on the sentence. Each of these was verified to reach
the same template as its canonical form above:

| Shorthand                                    | Reaches                         |
| -------------------------------------------- | ------------------------------- |
| `monthly signups by segment`                 | onboarding by month and segment |
| `which branch rejects the most applications` | branch rejection rate           |
| `retail vs sme`                              | compare segments                |
| `who are our biggest customers`              | top customers by value          |
| `how has spend moved over the year`          | transaction value trend         |
| `average spend per segment`                  | average transaction by segment  |
| `customer count by segment`                  | customers by segment            |
| `how many customers are high risk`           | customers by risk band          |
| `which branch moves the most money`          | transactions by branch          |
| `application volume per branch`              | applications by branch          |
| `approval rate trend`                        | approval rate over time         |

A template matches only when **every** one of its required term groups is satisfied. That is
why "how many customers" alone is not enough for the segment breakdown — it also needs a word
meaning segment. Miss a group and the question becomes unanswerable with the near misses
offered as suggestions, which is the intended behaviour rather than a gap.

---

## Unanswerable

Five that are understood and turned down for a specific, stated reason rather than a shrug.

| #   | Question                                            | Why it is declined                                                                                                                                                                   |
| --- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Which customers are likely to default next quarter? | A forecast. No arrears, defaults or credit scores exist in the schema, and `risk_band` is a static classification set at onboarding — wrong to use as a predictor, so it is not used |
| 2   | Forecast next quarter onboarding volumes            | Asks what will happen. A projection from one year of history would carry authority it has not earned                                                                                 |
| 3   | Why did applications fall in March?                 | Asks _why_. The tables record what happened and when, not why; any cause would be correlation presented as explanation                                                               |
| 4   | How does our market share compare to competitors?   | Reaches outside the bank's own records. Nothing here describes other institutions or any external benchmark                                                                          |
| 5   | Show me employee salaries                           | No staff or HR data in the schema. Branches are places, not the people who work in them                                                                                              |

Each of these hits a curated topic, so the refusal explains the specific gap. Anything else
that misses the catalogue still gets a general refusal naming the four tables and offering
the nearest answerable questions. `What's the weather in London?` and
`Show me mortgage arrears by region` both land there, verified.

Two more paths reach the same outcome from the validation stage, before anything is
generated:

| Input                    | Response                                                |
| ------------------------ | ------------------------------------------------------- |
| An empty question        | _A question is needed before anything can be answered._ |
| More than 500 characters | _Questions are limited to 500 characters._              |

---

## Blocked

These generate an unsafe statement on purpose, so the Guard has something real to refuse.
The statement comes **out of the generator**, and the Guard refuses it on its contents — the
pipeline does not recognise the question in advance as one to decline.

Five questions, one per safety check:

| #   | Question                            | Check it trips        | What the check is for                                    |
| --- | ----------------------------------- | --------------------- | -------------------------------------------------------- |
| 1   | Show customers; then drop the table | `single-statement`    | Stacked statements hidden behind a semicolon             |
| 2   | Delete all customer records         | `read-only`           | Anything that writes                                     |
| 3   | List the database users             | `tables-allow-listed` | Reads outside the four data tables, such as `pg_catalog` |
| 4   | Show me every transaction ever      | `row-limit`           | A statement demanding more rows than the cap             |
| 5   | Show customers named x' OR 1=1 --   | `parameters-bound`    | A value written into the SQL instead of bound to it      |

A sixth probe, **Drop the transactions table**, also trips `read-only` — DDL rather than a
write, but the same check refuses it.

Question 1 is worth opening: it fails **three** checks, not one (`single-statement`,
`read-only` and `row-limit`), and all three are reported. The checks it _passed_ are shown
too, because a partial account of a refusal is not an audit.

### These are matched exactly, on purpose

Case and punctuation are ignored, so `delete all customer records` works. Extra words are
not: `Delete all customer records please` returns **unanswerable**, not blocked.

That is deliberate. Probes are matched against the exact question the interface offers, so
nobody stumbles into an unsafe statement by phrasing a real question oddly. Type them as
written above.

---

## Failed

Failure has exactly one reachable cause by design: a legitimate question that matches a
template, passes all five checks, and then cannot finish inside the five-second statement
timeout. It is a self-join across 250,000 transactions, and the planner cannot avoid the cost.

Five phrasings, all verified to reach it:

| #   | Question                                           | Result                       |
| --- | -------------------------------------------------- | ---------------------------- |
| 1   | Which customers have similar transaction patterns? | `statement_timeout` at ~5.1s |
| 2   | find customers with similar spending               | `statement_timeout` at ~5.1s |
| 3   | which customers behave alike                       | `statement_timeout` at ~5.1s |
| 4   | customers with comparable transaction patterns     | `statement_timeout` at ~5.1s |
| 5   | show me customers alike in their spending          | `statement_timeout` at ~5.1s |

Expect a five-second wait. That is the control working, not the app hanging.

What comes back is the Postgres error code, the stage it reached, a trace id, and **no
partial result** — a partial answer to a question about totals is worse than no answer. It
is filed in the audit log exactly like a success.

---

## Not an outcome: the rate limit

Ask faster than `RATE_LIMIT_MAX` allows in a minute and the API returns **HTTP 429** with
_"Too many questions in a short time"_. This is not one of the four outcomes — the request
never reaches the pipeline, so nothing is filed.

The committed default in `.env.example` is 60 per minute. Check your own `.env`; a lower
value there will bite sooner. Only relevant if you are scripting; a person cannot type fast
enough to hit it.

---

## Reproducing this list

```bash
pnpm dev     # API on :4000, client on :5173
```

Then ask through the interface at <http://localhost:5173>, or directly:

```bash
curl -N -X POST http://localhost:4000/api/ask \
  -H 'content-type: application/json' \
  -d '{"question":"Which branches have the highest rejection rate?"}'
```

The response is Server-Sent Events: one frame per pipeline stage as it completes, then a
final frame carrying the outcome. Row counts above assume the default `demo` seed; `pnpm
db:reset` followed by `pnpm db:setup` restores it.
