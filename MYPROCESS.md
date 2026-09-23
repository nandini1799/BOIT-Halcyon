# How Halcyon was built

The brief asks which AI tools were used and which decisions were made personally. This is
that disclosure, written as the process it actually was rather than a list of products.

The one idea behind all of it: **decide expensively, execute cheaply.** A strong model was
used where a wrong answer is costly to unwind — the visual direction, the architecture, the
ADRs, the ticket breakdown — and a fast, cheap model was used to type the code those
decisions had already determined. Every phase below is a variation on that.

- [1. Design first, code second](#1-design-first-code-second)
- [2. Scoping: the workflow skill](#2-scoping-the-workflow-skill)
- [3. Switching models for execution](#3-switching-models-for-execution)
- [4. The backend, test-first](#4-the-backend-test-first)
- [5. The frontend](#5-the-frontend)
- [6. End-to-end tests](#6-end-to-end-tests)
- [7. Verifying the architecture](#7-verifying-the-architecture)
- [8. Documentation](#8-documentation)
- [What it cost, in money and time](#what-it-cost-in-money-and-time)
- [Tools used](#tools-used)
- [Decisions made personally](#decisions-made-personally)

---

## 1. Design first, code second

The brief in `docs/init.md` was handed to the agent as the only input. The first thing asked
for was not code. It was the interface.

The reason is a loop worth avoiding. Building the product and then redesigning it means
rebuilding it, and each pass costs the whole stack again: the layout, the components, the
state, the tests that assert against them. Settling the design while it is still disposable
HTML costs a few minutes to throw away. Settling it after the React app exists costs a day.

Design ran through **design studio**, an in-house orchestrator skill. It does not design
anything itself. It routes the brief to the right builder, seeds the brand inputs, and then
chains the validators:

| Role                                                             | Skill                   |
| ---------------------------------------------------------------- | ----------------------- |
| Builder — the design pipeline, the direction gate, the prototype | `huashu-design`         |
| Craft and taste layer — the anti-generic constraints             | `design-taste-frontend` |
| Validator — 47 mechanical rules read against the token lockfile  | `impeccable`            |

Its hardest rule is a **three-direction gate**: no single design may be presented. Three
structurally different directions are built as real rendered HTML and screenshotted, and the
choice is the user's. Three skeletons were produced, not three colour schemes — a left schema
rail with a centred transcript, a full-width masthead with a top-docked input and a sticky
evidence rail, and a three-band terminal layout with a permanent audit column. Twenty-one
screenshots across six states each, in `_design/conversational-data-analyst/v1/shots/`.

Direction B, Broadsheet, was chosen. The decision and the words that made it are recorded
verbatim in `v1/direction-approved.md`, and A and C were kept rather than deleted so the gate
leaves a record.

Build-out continued in `v2/`, which inherits B's tokens verbatim. Two things were requested
there deliberately, both aimed at the phase that had not started yet:

- **A Tailwind v4 abstraction of the design** — `v2/docs/tailwind-theme.css`, 46 tokens, an
  `@theme` block and the base and component layers. The design phase ends holding the file
  the frontend phase starts from, so the implementation inherits the design rather than
  re-deriving it by eye from a PNG.
- **An architecture note and a product doc**, so the scoping phase had something to argue
  with instead of a blank page.

Validation is recorded in `v2/validation.md`, including what failed. Gate 5 could not compile
the Tailwind theme — the registry blocked a transitive dependency — so the theme shipped out
of design **verified structurally but unproven**. That unresolved gate is what the frontend
phase opened with, in section 5.

---

## 2. Scoping: the workflow skill

With a design approved, the work moved to the workflow skill — the structured pipeline that
turns a brief into a specification, decisions and tickets. It ran on **Claude Opus 5**, which
is the single most expensive line in this project and the one with the best return.

**Grilling came first.** A dedicated skill interrogates the requirement, asking as many
questions as it can generate until the ambiguity is gone. This is uncomfortable and it is the
point. The brief says "chat-style interface"; grilling is what forces the question of whether
that means a transcript or a history drawer, and makes the answer a decision rather than a
default. The output is `.scratch/halcyon/spec.md`, which became the single source of truth for
the build: stack, data model, roles, the six pipeline stages, the five Guard checks, the
twelve catalogue templates, the six adversarial probes, the API contract, the build order, and
thirteen recorded deviations from the approved design.

**Then the ADRs.** Every load-bearing decision the grilling settled was written up in
`docs/adr/`, ten of them, each stating the decision and what it costs. They exist so that a
later change knows what it is overruling.

**Then the tickets.** The ADRs were decomposed into small implementation tickets under
`.scratch/halcyon/`, following the conventions in `docs/agents/issue-tracker.md`: one file per
ticket, numbered from `01`, with a `Status:` line carrying a triage label from
`docs/agents/triage-labels.md` (`ready-for-agent` for the fully specified ones,
`ready-for-human` for the rest). Tickets were closed out as they were completed, which is why
only `spec.md` remains in that directory.

`CONTEXT.md` was written in the same pass to fix the vocabulary. It is the reason the product
never says "rejected" about a question: in a bank, rejection is a decision on an application,
so a question is `unanswerable` or `blocked` instead.

---

## 3. Switching models for execution

Once the spec, the ADRs and the tickets existed, the expensive thinking was over. Writing the
code was execution against a written plan, which is a different job and wants a different
model.

Everything from here ran on **Gemini 3.8 Flash**, which benchmarks ahead of Sonnet 5 on task
execution and costs roughly a quarter as much. The trade is only acceptable because of what
came before it: a model executing a well-specified ticket does not need to be the model that
decided what the ticket should say.

**Claude Sonnet 5** was kept for review passes, and was used sparingly.

---

## 4. The backend, test-first

The Node and TypeScript backend was scaffolded to the shape ADR-0001 fixed: a pnpm workspace
of `client/`, `server/` and `shared/`, TypeScript strict everywhere with
`noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` on.

Then the tests were written — before the implementation, from the ADRs and the tickets rather
than from any code. There is a second reason beyond the usual one. A test written from a
ticket describes what was asked for; a test written afterwards describes what was built, and
cannot catch the gap between them. That matters more when a model is typing, because a model
will happily write a passing test for the wrong behaviour.

It is also the cheapest way to review AI-written code. Reading 7,800 lines of implementation
is expensive in attention and in tokens. Reading the assertions and checking they say what the
ticket said is not, and the implementation is then verified by the suite rather than by
inspection.

The Guard was built first, as the spec's build order required — the highest-value component
in the product, proven before anything depended on it. Twenty of the 65 unit and integration
cases are Guard cases, including a property test asserting that every adversarial probe is
refused by the specific check it targets and that the probes collectively exercise all five
checks, so a check cannot be added without a demonstration.

Backend tickets were then knocked down in order: schema and seed, the catalogue and SQL
builder, the pipeline and SSE, the audit log and the two connection pools.

---

## 5. The frontend

The frontend started where the design phase left off, with the Tailwind theme that
`validation.md` had flagged as unproven.

So the first thing built was not a feature. It was a throwaway page rendering every token at
once: the full type scale, every colour on its intended background, the rules, the tabular
figures, the focus states. It compiled, it matched the approved screenshots, and the open gate
from section 1 closed. Everything after that could trust `client/src/index.css` and stop
checking. The page was deleted once it had done its job.

Then the tickets again, one at a time: masthead and ask bar, the story column, the evidence
rail, the notes drawer, the charts, the history drawer, then the responsive and accessibility
passes that ADR-0008 had committed to.

---

## 6. End-to-end tests

Playwright was added last, over a working app: 19 specs across four files covering the answer
path, a Guard refusal, the history drawer and a restored answer, plus an accessibility suite
that runs an axe WCAG 2.1 AA audit against every state — empty, answered, table view,
generator card open, notes open, blocked and history open — and fails the build on any
violation.

Adding it after the UI was stable rather than alongside it was deliberate. End-to-end tests
assert against the rendered interface, so writing them while the interface is still moving
means rewriting them.

---

## 7. Verifying the architecture

The architecture was argued out during scoping and recorded in the ADRs. What happened at this
point was checking it had survived the build, which is a different activity and is the one
usually skipped.

The app was run locally and every state in the `DEMO.md` script was walked by hand — including
the ones designed to fail. The read-only role was proven rather than asserted, by `pnpm
db:verify`, which exercises fourteen database-level controls across both roles: `halcyon_ro`
must be refused every write, every DDL and any read of the audit log, a genuinely expensive
query must be cancelled by the statement timeout rather than allowed to finish, and the audit
role must be refused any read of customer data. Three claims in the documentation turned out
to be stale or wrong when checked against the code, and were corrected rather than softened.

---

## 8. Documentation

The last pass produced `README.md`, `SETUP.md`, `ARCHITECTURE.md` (nine Mermaid diagrams
covering the request flow, the Guard cascade, the trust boundaries and two worked scenarios),
`PRODUCTION.md` and this file. Every figure quoted in them was measured rather than estimated,
and every internal link and diagram was rendered and checked before the docs were considered
done.

---

## What it cost, in money and time

| Phase                              | Model            |          Wall-clock |      Spend |
| ---------------------------------- | ---------------- | ------------------: | ---------: |
| Design — three directions and gate | Opus 5           |             ~10 min |      $1.60 |
| Scoping, grilling, ADRs, tickets   | Opus 5           |           20–25 min |      $4.20 |
| Backend, test-first                | Gemini 3.8 Flash |             ~20 min |      $1.90 |
| Frontend                           | Gemini 3.8 Flash |           15–20 min |      $1.70 |
| Playwright suite                   | Gemini 3.8 Flash |           10–30 min |      $1.10 |
| Manual verification of every state | human            |             ~20 min |          — |
| Documentation                      | Opus 5           |           20–30 min |      $4.00 |
| Review passes                      | Sonnet 5         |         interleaved |      $1.20 |
| **Total**                          |                  | **1h 55m – 2h 35m** | **$15.70** |

Spend is provider-reported usage for the session, rounded to the nearest ten cents.

Two things the split shows. Design, planning and documentation are **62%** of the bill and
produced no production code, which is the intended shape: the expensive model bought
decisions, not output. And the entire implementation — backend, frontend and the end-to-end
suite, 7,859 lines across 79 source files — cost **$4.70**, because by the time it ran there
was nothing left to decide.

The brief allowed a 60-minute session. The three implementation phases come to 45–70 minutes
of that. The design gate, the manual verification and the documentation are what take the
total past two hours, and they are listed separately above for exactly that reason.

---

## Tools used

| Tool                                            | Where                                                                                                     |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **Cursor**                                      | Everything. The primary environment for all phases                                                        |
| **Claude Code**                                 | A small amount, early, during the design phase only                                                       |
| **design studio** (in-house orchestrator skill) | The design phase — routes to `huashu-design`, layers `design-taste-frontend`, validates with `impeccable` |
| **The grilling skill**                          | Locking down requirements before anything was written                                                     |
| **The workflow skill**                          | Brief → spec → ADRs → labelled tickets                                                                    |
| **Playwright**                                  | Design-gate screenshots in `_design`, then the 19-spec end-to-end suite                                   |
| **axe** (`@axe-core/playwright`)                | WCAG 2.1 AA audit inside the Playwright suite                                                             |
| **Vitest**                                      | 65 unit and integration cases                                                                             |
| **Mermaid CLI**                                 | Rendering and validating every diagram in `ARCHITECTURE.md` before committing                             |
| **Prettier**                                    | Formatting gate, wired to `pnpm lint`                                                                     |

Models: Claude Opus 5 (design and planning), Gemini 3.8 Flash (implementation), Claude Sonnet 5
(review).

---

## Decisions made personally

The brief asks for this explicitly. These were chosen by a person and handed to the models as
constraints, not produced by one:

1. **Design before code, and the three-direction gate.** The whole sequencing of this project.
2. **Direction B.** Chosen from three rendered options, on sight.
3. **No LLM in the shipped build** (ADR-0004). A Question Catalogue behind a generator
   interface, so the suite is reproducible offline and needs no key — with the interface shaped
   so a hosted model drops in behind it (ADR-0010).
4. **History and the audit log are one table** (ADR-0005). Two tables can disagree about what
   happened; one cannot.
5. **"Chat-style" is a history drawer, not a transcript** (ADR-0006). A transcript is the
   convention, not the requirement.
6. **Fully responsive**, overruling the approved design's desktop-only scope (ADR-0008).
7. **Stage events are streamed, never simulated** (ADR-0007). A progress indicator that is a
   timer is a lie about what the system is doing.
8. **The Guard refuses an over-large row limit rather than clamping it.** Silently returning
   different rows than the statement asked for is the thing an audit trail exists to prevent.
9. **The Guard forbids every string literal in generated SQL** rather than pattern-matching for
   injection. Stronger, because it does not require anticipating what an attack looks like.
10. **A blocked statement is shown exactly as submitted**, not as the Guard rewrote it
    (ADR-0009). An audit trail that edits its evidence is not an audit trail.
11. **The two figures in the approved mock that do not survive being computed** were corrected
    by querying rather than hardcoded to match the design.
12. **Risk bands are seeded 62/28/10, not uniformly.** A uniform split is the clearest possible
    tell that data was generated rather than observed.

The full list of thirteen deviations from the approved design, each with its reasoning, is in
`.scratch/halcyon/spec.md` section 14.
