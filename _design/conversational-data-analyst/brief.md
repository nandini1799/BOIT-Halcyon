# Brief — Conversational Data Analyst (Halcyon)

Source: `docs/init.md`. Technical screening, 60-minute monitored build session.

## Design spec (Fallback Phase 3 — the shared input to all three directions)

**Product.** Halcyon — a chat-style interface over a bank's structured data. User asks a
business question in natural language; system routes to the right tables, constructs SQL,
validates it, executes it read-only, and renders the answer.

**Audience & scenario.** A generic business user inside a mid-size retail/commercial bank.
Desktop, 1440×900, in the office, mid-morning, being asked a question by their manager.
They need an answer in under a minute and need to be able to paste it into a reply.

**Core content, by block.**
- Question input — always reachable, the primary affordance.
- Conversation history — prior questions and their answers.
- The answer itself — text summary, plus one or more of: KPI card, table, bar chart, line chart.
- "Show the work" — routed tables, generated SQL, validation verdict. Collapsed by default,
  one interaction to open. This is the highest-leverage block in the product.
- Copy affordances — copy the answer text, the data (CSV/JSON), or the chart.
- Suggested questions — the four examples from the brief, as first-run starters.

**Six required states.** Every direction must render all six:
1. `empty` — first run, nothing asked yet, suggested questions offered.
2. `kpi-bar` — answer with KPI cards + bar chart (monthly onboarding by segment).
3. `table-line` — answer with data table + line chart (top customers / value trend).
4. `thinking` — the pipeline mid-flight, stages visible.
5. `rejected` — question cannot be answered from this data; plus a blocked write attempt.
6. `error` — technical failure (statement timeout), handled without the UI collapsing.

**Emotional register.** Institutional, precise, quietly confident. Dark theme, mandated.
Not a consumer chatbot; not a Bloomberg screaming match. The feeling to aim for is
"a well-made instrument".

**Output format.** Single-file HTML, 1440×900 viewport, `file://` double-clickable, zero
network dependency. Vanilla JS state switcher. Charts hand-built as inline SVG whose shape
is achievable in Recharts, since Recharts is the chosen production library.

**Known constraints.**
- Dark theme is mandatory.
- Recharts is the target chart library — the chart language must be reproducible in it
  (cartesian grid, axis ticks, tooltip, legend). No effects Recharts cannot do.
- Fictional bank; all figures invented and labelled as sample data.
- Single-shot Q&A. No multi-turn context carry-over in the design.
- Every direction shares one identical dataset (`shared/halcyon-data.js`) so the three can
  be compared on design alone.
- Layout skeletons must be structurally different between directions — not three reskins.

**Imagery.** None required. This is a tool/data product, not a content product, so
Phase 3.5 resolves to "no photography needed". No logos to fetch: Halcyon is fictional, so
its wordmark is set in type rather than sourced. No third-party brands appear.

**Visual motif seed (form 推导 Q5).** Banking's own native visual language is the *ruled
ledger line* and the *right-aligned tabular figure*. Each direction should find its motif
in that territory rather than in generic "AI product" tropes.
