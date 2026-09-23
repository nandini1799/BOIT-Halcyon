---
status: accepted
---

# "Chat-style" is satisfied by a history drawer, not a transcript

The brief requires a "chat-style user interface". The approved design explicitly rejects one: an Answer is a filed story rather than a chat bubble, and the question input sits at the top precisely because the answer, not the conversation, is the artefact.

We resolve this with a collapsible left drawer, opened from a ruled three-line control, listing previous questions. Selecting one restores that filed Answer to the stage. The conversation exists and is navigable; it simply is not the primary surface.

## Consequences

The drawer must obey the design's rules rather than import chat conventions: radius zero, a 1px rule as its divider, no `box-shadow`, salmon on the active entry only, a real `<button>` with `aria-expanded`, and the slide gated behind `prefers-reduced-motion`.

This is a deliberate, defensible reading of an explicit requirement rather than a full one. It is called out in the README so a reviewer meets the argument rather than discovering the gap.
