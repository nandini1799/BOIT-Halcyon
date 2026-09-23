# validation.md — v2 (Broadsheet build-out)

Direction B approved 2026-09-22. This version adds the two remaining example questions and
the three requested documents. The three-direction gate does **not** re-run — this is
iteration after an approved direction, which is an explicit exemption.

## Gate 1 — impeccable detect

```
node ~/.wibey/skills/impeccable/scripts/detect.mjs design-demos/halcyon.html
```

**0 anti-patterns.** Clean on the first run; the v1 fixes (Hanken/em-dash) were
direction-A-only and B inherited none of them.

## Gate 2 — CRAFT-RULES

| Rule | Result |
|---|---|
| Body >= 14px | Pass. 15px body, 17.5px standfirst |
| Contrast >= 4.5:1 | Pass. 15.1 / 8.0 / 4.6, floor used for labels only |
| Focus visible | Pass |
| Radius 0 | Pass, including both new states |
| One accent | Pass. Salmon only |
| Colour never sole encoder | Pass. New horizontal bars print their value; the versus block labels both cohorts |
| Reduced motion | Pass |
| File size | **Fixed.** `halcyon.html` hit 869 lines, over the 600-line limit. CSS extracted to `shared/halcyon.css`; HTML now 641, CSS 231. Cohesive split — markup and styling were genuinely separable, not split to game a number |

## Gate 3 — runtime

```
NODE_PATH="$(npm root -g)" node scripts/shoot.js
```

**OK — 12 screenshots, 4 drawers opened, 0 console errors, 0 page errors.**
Re-run after the CSS extraction: still clean, so the extraction changed nothing visually.

## Gate 4 — data integrity

Every figure quoted in the new prose was reconciled against the raw series in Node, not
eyeballed:

| Claim | Computed | Match |
|---|---|---|
| Retail FY total 6,575 | 6575 | yes |
| SME FY total 1,974 | 1974 | yes |
| Ratio 3.3 to one | 3.33 | yes |
| SME growth 81.4% | 81.4 | yes |
| Retail growth 63.6% | 63.6 | yes |
| Branch rows | 6 | yes |

This matters more than it looks: a mock with numbers that do not add up is worse than a
mock with placeholder numbers, because it invites exactly the scrutiny it fails.

## Gate 5 — Tailwind theme

**Could not compile in this environment.** `npm install @tailwindcss/cli` fails with
`E403 MediaTypeBlocked` on the transitive dep `@jridgewell/sourcemap-codec` — a registry
policy block, not a fault in the CSS. Verified structurally instead:

| Check | Result |
|---|---|
| Braces balanced | 20 / 20 |
| `@import "tailwindcss"` | present |
| `@theme`, `@layer base`, `@layer components` | all present |
| Tokens declared | 46 |
| Unresolved `var()` references | none |
| Duplicate tokens | none |
| Colour values match the live design | 12 / 12 exact |

**Outstanding:** run `npx @tailwindcss/cli -i docs/tailwind-theme.css -o /tmp/out.css` once
on an unrestricted network to confirm the utilities generate. The risk is low (the syntax is
v4-standard and the structure is verified) but it is unproven, and unproven is not the same
as working.

## Known limitations carried forward

Unchanged from v1 and stated in `docs/design-doc.md` section 10: grouped bars flatten small
segments, desktop-only, copy buttons inert, hand-built SVG charts, all data fictional.
