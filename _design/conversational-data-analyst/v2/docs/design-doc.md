# Halcyon — Design Document

One page. What the interface is, why it is shaped that way, and the rules that hold it
together. Read this before changing anything; the constraints below are load-bearing.

---

## 1. The product in one line

A business user asks a question in plain English. Halcyon routes it to the right tables,
writes the SQL, validates it, executes it read-only, and **files the answer with the query
attached.**

## 2. The core design idea

> **An answer is a filed story, not a chat bubble.**

This is the decision everything else follows from. A chat transcript treats an answer as
ephemeral conversation. A bank analyst's answer is not ephemeral — it gets forwarded, quoted
in a meeting, and occasionally challenged. So the interface borrows the one visual language
built for exactly that job: **financial editorial**, specifically the Financial Times'
design language, rendered as a dark newsroom.

Concretely, every answer has the anatomy of a filed story:

| Newspaper element | In Halcyon | Why it earns its place |
|---|---|---|
| Kicker | `ONBOARDING · Filed 74 ms · 48 rows` | Section, cost and size at a glance |
| Headline | "Onboarding climbed through 2025..." | The answer, stated as a claim |
| Standfirst | The paragraph with the numbers in bold | The answer with its evidence |
| Pull figures | KPI row | The three numbers worth remembering |
| Figure + caption + source line | Chart | A chart without a source is an assertion |
| Correspondent's notes | The SQL drawer | How the claim was produced |
| Sources drawn on | Right rail | Which of the four tables were touched |

## 3. Why dark, and why *this* dark

Dark was mandated. The trap is that "dark + data product" converges on GitHub-dark:
flat `#0D1117` with cyan neon. That is the single most over-used dark palette in software
and it carries no brand information at all.

So the ground is **warm espresso `#13100E`**, not blue-black. It is the one decision that
makes the product read as an institution rather than a developer tool. The accent is
**FT salmon `#FF9E7A`** — the most recognisable colour in financial publishing, and warm
enough to sit on that ground without vibrating.

## 4. Layout

```
+---------------------------------------------------------------+
|  MASTHEAD              Halcyon  ·  read-only  ·  filed 10:42   |
+---------------------------------------------------------------+
|  ASK BAR      [ serif input, 20px ]                    [Ask]   |
+--------------------------------------------+------------------+
|                                             |                  |
|  THE STORY                                  |  EVIDENCE RAIL   |
|  kicker / headline / standfirst             |  sources drawn   |
|  pull figures                               |  assumptions     |
|  figure + caption + source                  |  why this form   |
|  > notes on this answer  [validated]        |                  |
|  copy answer | CSV | SQL | chart            |  (sticky)        |
+--------------------------------------------+------------------+
```

Three deliberate choices:

1. **Input at the top, not the bottom.** A chat app docks input at the bottom because the
   conversation is the artefact. Here the *answer* is the artefact, so the question sits
   above it like a masthead search. It also means the answer never jumps as you type.
2. **A persistent right rail.** Provenance is not a detail to be discovered. Which tables
   were used, what was assumed, and why this chart form — always on screen.
3. **Single column for prose, capped at 62ch.** The standfirst is the product. It gets
   newspaper measure, not full-bleed width.

## 5. Type

Three families, three jobs, zero overlap.

| Family | Job | Rationale |
|---|---|---|
| **Source Serif 4** | Headlines, standfirst, pull figures | Serif signals "this was written, not generated". Carries the editorial idea. |
| **Source Sans 3** | UI chrome, buttons, rail prose | Same superfamily as the serif, so they lock together with no fighting. |
| **IBM Plex Mono** | All figures, SQL, table names, timestamps | Every number is tabular and right-aligned. Always. |

**The tabular-figures rule is the brand's strongest signature.** It is inherited from
banking's own printed conventions, and it is the cheapest thing on this list to get right
and the most obvious when got wrong.

## 6. The audit trail

The brief's most heavily weighted requirement is *"should not allow unrestricted
AI-generated SQL to execute without validation or control."*

The design answer: **one click, never zero clicks and never hidden.**

- Every answer carries a permanent `VALIDATED · READ-ONLY` verdict chip. You never have to
  open anything to know the query was checked.
- "Notes on this answer" expands to the exact SQL as executed, alongside all five safety
  checks with their individual verdicts.
- Rejections show the **rejected statement itself** with the failing check marked. A silent
  refusal is not auditable; showing the blocked `DELETE` is the whole point.
- The masthead states `Read-only connection` at all times.

The drawer is closed by default because the default reader wants the answer. It opens in one
click because the second reader wants the proof.

## 7. The states

Eight, all built, all screenshotted. States are deliverables here, not polish — the brief
explicitly grades invalid-question and error handling.

| State | What it proves |
|---|---|
| `empty` | First run. Four starter questions, each labelled with the tables it will touch. |
| `kpi-bar` | Monthly onboarding by segment. KPI row + grouped bars. |
| `table-line` | Top five customers. Data table + line chart. |
| `branches` | Branch rejection rates. Ranked horizontal bars + counts table. |
| `compare` | Retail vs SME. Head-to-head block + paired bars. |
| `thinking` | Six pipeline stages, four done, one running. Routing is visible. |
| `rejected` | Two cases: unanswerable question, and a blocked `DELETE`. |
| `error` | Statement timeout. Valid query, honest failure, three recovery options. |

## 8. Rules that must not be broken

1. **One accent.** Salmon means "the system is speaking". Never decorative.
2. **Red is errors only.** It is never a chart series. (Series four was retuned from red to
   gold `#C9A227` for exactly this reason — at position four a red was indistinguishable
   from salmon at position one.)
3. **Radius zero, everywhere.** Ruled ledger lines are square.
4. **Divide with rules, never shadows.** There is not one `box-shadow` in the design.
5. **Every figure is mono, tabular, right-aligned.**
6. **Every chart has a caption and a source line.**
7. **Body prose never uses `--color-ink-low`.** That token is 4.6:1 — the accessibility
   floor — and is for labels and captions only.
8. **Nothing the chart library cannot reproduce.** No gradients under curves, no glow, no
   bezier smoothing. The mock was built to port mechanically to Recharts.

## 9. Accessibility

Targeting WCAG 2.2 AA.

- Body text 15px; smallest text 10px and only ever an uppercase mono label.
- Contrast measured, not guessed: ink 15.1:1, ink-mid 8.0:1, ink-low 4.6:1.
- Charts never encode meaning by colour alone — every series is in a legend, every bar
  prints its value, every table prints its numbers.
- `:focus-visible` ring on every interactive element, 2px salmon, never removed.
- `prefers-reduced-motion` respected globally.
- Drawers are real buttons with `aria-expanded`; panels are not divs pretending.

## 10. Known limitations

1. **Grouped bars flatten small segments.** Retail (412–674) against Private Banking (12–29)
   means two of four series are barely visible. This is honest to the data. The `compare`
   state exists partly to address it, and the caption says "note the axis" out loud. A log
   toggle or small-multiples would be the real fix.
2. **Desktop only, 1440×900.** No responsive work. The target user is at a desk.
3. **Copy buttons are inert** in the mock. They are affordances, not implementations.
4. **Charts are hand-built SVG,** deliberately restricted to Recharts-reproducible geometry.
5. **All data is fictional** and labelled as such in the UI.
