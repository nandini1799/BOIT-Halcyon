# direction-approved.md

**Status: DIRECTION CHOSEN — B · Broadsheet.**

Date: 2026-09-22.
User's own words: *"Okay, so yeah, based on the designs that you have given me, I really like
the design B."*

No mix was requested. B is taken as the sole direction. Per the gate rules this decision is
final for the project — the three-direction gate does **not** re-run on any later iteration,
and A and C are preserved in this version as the historical gate record rather than deleted.

Build-out continues in `../v2/`, which inherits B's tokens verbatim from this version's
`DESIGN.md`.

---

## Gate compliance (historical record)

- Gate type: 100% hard gate, no exemption claimed.
- Exemption used: **none**. This is new visual design, so the gate applies in full.
- Three directions built as real rendered HTML, not verbal description. 21 screenshots in
  `shots/`, covering all six states plus an open-drawer shot per direction.

## Three logics, as required

| Direction | Logic | Anchor |
|---|---|---|
| A · Instrument | 1 · seconds roulette | `date +%S` = 35 → `35 % 20 + 1` = **#16 Terminal-Core Soft-Futurism** (Cursor x Teenage Engineering) |
| B · Broadsheet | 2 · real-world benchmark | Financial Times financial-editorial language (Origami design system, FT salmon), rendered dark |
| C · Vault | 3 · best studio for this brief | Bloomberg terminal information density, disciplined by Teenage Engineering industrial restraint |

## Structural difference check (no reskins)

Required: the three must differ structurally, not just in colour and type.

- **A** — fixed left schema rail + single centred transcript + input docked at the bottom.
- **B** — full-width masthead, input docked at the **top**, wide prose column + sticky
  right-hand evidence rail. No left nav at all.
- **C** — three horizontal bands: header strip with inline input, split body
  (answer pane | permanent audit column), status bar pinned to the bottom. No side nav,
  no sticky rail, and the audit column never collapses.

Three genuinely different skeletons. Confirmed by screenshot comparison.

## The axis that actually matters

All three share one dataset and one chart engine, so the real difference is **where the
audit trail lives** — which is the single highest-leverage decision in this brief:

- **A** — drawer at the foot of each answer. Closed by default.
- **B** — "Notes on this answer", filed under the story, plus a permanent sources card.
- **C** — a permanent right-hand column. The verdict is never hidden; the drawer holds
  only the detail. This is the strongest answer to the brief's hardest grading line,
  and the most expensive in screen real estate.

## Form derivation (Step 3, Q5)

The motif for all three comes from banking's own printed conventions: the ruled line and
the right-aligned tabular figure. No direction uses a generic "AI product" trope. Each
states its derivation in the comment block at the top of its file.

## What the user selects

One direction to carry forward, or a mix (for example "C's audit column with B's prose").
A mix is a legitimate answer and does not re-run the gate.
