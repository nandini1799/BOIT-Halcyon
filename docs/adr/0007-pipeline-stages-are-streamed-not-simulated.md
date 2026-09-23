---
status: accepted
---

# Pipeline stages are streamed, not simulated

`POST /api/ask` responds as a Server-Sent Events stream. Each of the six pipeline stages emits an event when it genuinely completes, carrying its own elapsed time; the final event carries the `AskResponse` envelope. The thinking state in the UI renders those events and nothing else.

The cheap alternative — a client-side animation stepping through six stage labels on a timer — was rejected because it would be the single dishonest element in a product whose entire argument is that it shows what actually happened rather than asserting it. A reviewer who throttles the network would find it immediately.

## Consequences

At demo seed scale most queries complete in a few hundred milliseconds, so the thinking state can flash past rather than displaying gracefully. That is the honest outcome, and the real per-stage timings persist in the Audit drawer afterwards, so the work stays inspectable even when it was too fast to watch.
