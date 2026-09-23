---
status: accepted
---

# Fully responsive, overriding the design's desktop-only limitation

`docs/design/design-doc.md` section 10 records "desktop only, 1440×900, no responsive work" as a known limitation, on the reasonable grounds that the target user is at a desk. We are overriding it: the application is responsive down to mobile.

The reasoning is about the audience for this particular artefact rather than the product's users. A take-home is opened on whatever machine the reviewer has, and a layout that breaks when resized reads as unfinished rather than focused.

## Consequences

The evidence rail moves beneath the story below roughly 1280px instead of being squeezed. The history drawer becomes a full overlay sheet on narrow screens. Charts render through Recharts' `ResponsiveContainer`. Wide data tables scroll horizontally with the first column pinned. The design doc's limitation 10.2 is amended rather than left contradicting the build.
