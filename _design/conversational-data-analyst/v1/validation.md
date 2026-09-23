# validation.md — v1 gate results

Order: cheap to expensive. Two fix-and-recheck cycles max; both were used, none remain open.

## Gate 1 — impeccable detect (47 mechanical rules)

```
node ~/.wibey/skills/impeccable/scripts/detect.mjs design-demos/*.html
```

| Run | Result |
|---|---|
| First | 2 findings, both in A: `overused-font` (Inter) and `em-dash-overuse` (9 in body copy) |
| After fix | **0 anti-patterns across all three files** |

Fixes applied:
- A's body face changed Inter → **Hanken Grotesk**. Inter is on the detector's overused
  list and, more to the point, is the default face of every AI-generated UI. Hanken is the
  open Söhne-adjacent grotesque, which suits an instrument better anyway.
- Em-dashes in body copy replaced with colons and full stops. Remaining em-dashes are in
  `<title>` and source comments, which are not body copy.

## Gate 2 — CRAFT-RULES walk

| Rule | Result |
|---|---|
| Body >= 14px | **Pass.** A 14px, B 15px, C 13.5px. C is a deliberate density choice consistent with its terminal reference; labels there are still >= 12px |
| Contrast >= 4.5:1 | **Pass.** Lowest ink is exactly 4.6:1 in all three and is used only for labels |
| Focus visible | **Pass.** `:focus-visible` ring on all three, 2px, accent colour |
| Radius discipline | **Pass.** 0 everywhere. No rounded-card-with-left-accent anywhere |
| One accent, one meaning | **Pass.** A amber, B salmon, C acid yellow. Each means "system state" |
| Colour is never the only encoder | **Pass** after fix (see below). Every series is labelled in a legend; table values are printed, not just barred |
| Reduced motion respected | **Pass.** Both animations wrapped in `prefers-reduced-motion` |
| No banned dark solution | **Pass.** No `#0D1117` + neon. A is blue-charcoal, B is warm espresso, C is neutral graphite |
| Honest placeholders | **Pass.** No lorem, no invented logos, all data labelled fictional |

Additional fixes found by eye, not by the detector:

- **Label collision.** `.chk__t` / `.chk__d` were inline spans, so check names ran into
  their descriptions ("Single statement**One statement**"). Set to `display:block` in all
  three. This was visible in every screenshot and the mechanical gate did not catch it —
  a good argument for looking at the render.
- **B's series 4 was indistinguishable from series 1.** `--claret #E3746E` sat too close in
  hue to `--salmon #FF9E7A` in the legend. Retuned to amber-gold `#C9A227`. Red is now
  reserved for errors and is never a chart series.

## Gate 3 — huashu verify (runtime)

```
NODE_PATH="$(npm root -g)" node scripts/shoot.js
```

**OK — 21 screenshots, 0 console errors, 0 page errors.**

Covers: 3 directions x 6 states, plus one open-drawer shot each. Every `[data-drawer]`
toggle was clicked and confirmed to open. `window.__ready` is set synchronously by the
shared switcher, so the harness never races the render.

## Gate 4 — huashu critique (6 dimensions, concept weighted highest)

| Dimension | A · Instrument | B · Broadsheet | C · Vault |
|---|---|---|---|
| Concept (weighted highest) | 8 | 8 | **9** |
| Philosophical consistency | 9 | **9** | 8 |
| Visual hierarchy | 8 | **9** | 7 |
| Detail execution | 8 | 8 | 8 |
| Functionality | 8 | 7 | **9** |
| Innovation | 7 | 8 | **9** |

**A** — the most faithful execution of its reference and the easiest to rebuild under time
pressure. Weakest on innovation: a developer-tool dark theme is the expected answer here,
which is exactly why the roulette picking it is a little ironic.

**B** — the best reading experience of the three and the only one whose answer feels
*authored*. Risk: an interviewer may read editorial polish as time spent on the wrong
thing. Also the slowest to rebuild, because the prose is load-bearing.

**C** — the best answer to the brief's hardest requirement. Putting the verdict in a
permanent column rather than a drawer means the safety story is legible without a single
click. Costs 372px of width and is the densest to build. Hierarchy scores lowest because
density is its whole thesis — that is a trade, not an accident.

## Known limitations, stated rather than hidden

1. **Grouped bars flatten the small segments.** Retail (412–674) dwarfs Private Banking
   (12–29), so two of four series are barely readable at this scale. This is honest to the
   data, not a rendering bug. Only **C** solves it, with a second horizontal-bar figure
   showing FY totals. If you pick A or B, port that idea across — or offer a log toggle.
2. **Charts are hand-built SVG, not Recharts.** Deliberate: no build step, `file://`
   openable. Geometry was restricted to what Recharts reproduces, so the port is mechanical.
3. **No real backend.** Timings, row counts and query plans are plausible fiction.
4. **Desktop only.** 1440x900. No responsive work, since the target is a desktop analyst
   tool and the screening demo will be shown on a laptop.
5. **Copy buttons are inert.** They are design affordances; wiring them is a build task.
