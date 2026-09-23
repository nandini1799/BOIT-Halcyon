# DESIGN.md — token lockfile, v1

Three directions are live simultaneously in this version, so each owns its own token set.
Once you pick one, the losing two get deleted and this file collapses to the winner's block.
`impeccable`'s `design-system-*` rules read this file.

## Shared across all three

- Dark theme, mandated by the user.
- Charts restricted to what Recharts reproduces: cartesian grid, banded/linear axes,
  grouped bars, straight-segment lines with dots, horizontal bars, legend. Nothing else.
- Figures are monospaced, tabular-nums, right-aligned. Everywhere, in every direction.
- Body >= 14px (13.5px in C, which is a deliberate density choice), labels >= 12px,
  body contrast >= 4.5:1. Measured against each direction's own background.
- Radius: 0 in all three. This product is ruled lines, not rounded cards.

## Direction A — Instrument

| Token | Value | Contrast on bg |
|---|---|---|
| `--bg` | `#0B0D14` | — |
| `--panel` | `#11141D` | — |
| `--rule` | `#1E2330` | — |
| `--ink` | `#EDEAE4` | 14.8:1 |
| `--ink-mid` | `#A8AEBD` | 7.6:1 |
| `--ink-low` | `#767D8E` | 4.6:1 (floor, labels only) |
| `--amber` | `#FFB454` | accent — the machine's voice |
| `--teal` / `--violet` / `--rose` | `#5AC8B0` / `#9B8CFF` / `#FF7A7A` | chart + semantic |

Type: JetBrains Mono (protagonist) + Hanken Grotesk (body).
Chart series order: amber, teal, violet, rose.

## Direction B — Broadsheet

| Token | Value | Contrast on bg |
|---|---|---|
| `--bg` | `#13100E` (warm espresso) | — |
| `--paper` | `#1B1714` | — |
| `--rule` | `#2E2722` | — |
| `--ink` | `#F5EDE6` | 15.1:1 |
| `--ink-mid` | `#B8ABA0` | 8.0:1 |
| `--ink-low` | `#857A70` | 4.6:1 (floor) |
| `--salmon` | `#FF9E7A` | accent — FT lineage |
| `--sage` / `--slate` / `--claret` | `#8FBF9F` / `#8FA9C4` / `#C9A227` | chart |
| error red | `#E3746E` | semantic only, never a chart series |

Type: Source Serif 4 (display + prose) + Source Sans 3 (UI) + IBM Plex Mono (figures).
Note: `--claret` was retuned from `#E3746E` to amber-gold `#C9A227` because at series
position 4 it was indistinguishable from `--salmon` at position 1. Red now means error
and nothing else.

## Direction C — Vault

| Token | Value | Contrast on bg |
|---|---|---|
| `--bg` | `#101215` | — |
| `--panel` | `#171A1F` | — |
| `--line` | `#23272E` | — |
| `--ink` | `#E8EBEE` | 14.2:1 |
| `--ink-mid` | `#A3AAB4` | 7.5:1 |
| `--ink-low` | `#737C87` | 4.6:1 (floor) |
| `--signal` | `#E4F04A` | accent — system state only |
| `--green` / `--blue` / `--violet` / `--red` | `#63D19E` / `#6FA8DC` / `#A98CE0` / `#F0736B` | chart + semantic |

Type: Archivo (UI) + Roboto Mono (figures, SQL, labels).

## Banned in every direction

Flat `#0D1117` + cyan/violet neon glow. Purple-blue AI gradients. Emoji icons.
Rounded card + coloured left border. Any chart effect Recharts cannot do.
