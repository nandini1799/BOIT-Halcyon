---
status: accepted
amends: 0004
---

# The mock provider is shaped like a real one

ADR-0004 chose a Question Catalogue over a hosted model and put it behind a `SqlGenerator` interface, claiming that a future `LlmGenerator` would inherit every control without touching them. Reviewing that claim against the code, it did not hold.

The interface was `generate(routed: Routed): SqlPlan` — synchronous, and given a template that keyword routing had already selected. A generator that actually reads questions needs the question, needs the schema, and needs to be awaited. None of those were expressible. The seam was an assertion rather than a boundary, and the first real implementation would have had to rewrite it.

The brief also lists "any LLM provider or mocked AI implementation" as mandatory technology, and asks that AI-generated SQL not execute without validation or control. A catalogue that emits only safe statements cannot demonstrate that control: the refusal path was reachable only through hardcoded probe questions carrying hardcoded unsafe SQL, which is the product marking its own homework.

## Decision

Generation happens through a provider.

`LlmProvider` is the shape a hosted completion API has: messages in, content and a token count out. `mockProvider` implements it without a network. The schema context is built once from the Drizzle definitions, cached for the process, and sent as the system message; the question is the user message. The reply comes back as a string, is parsed as JSON, and is validated against a schema before anything believes it.

The mock's inference is the Question Catalogue. That is the substitution and the only part of the exchange that is not real — the context, the roles, the token accounting and the untrusted reply are all genuine. The statement that reaches the Guard is byte-identical to the one the catalogue produced before, which is why every existing test still passes unchanged.

`SqlGenerator` becomes `generate({ question, routed }): Promise<Generated>`, and there are two implementations — `llmGenerator` and `catalogueGenerator` — selected by `LLM_PROVIDER`. Two implementations is the only way to know the interface is load-bearing rather than decorative.

## Consequences

**The Guard now refuses generated SQL.** Adversarial probes resolve inside the provider, so `DELETE FROM customers` arrives from the generator and is refused on its contents. The demonstration is no longer the pipeline recognising a question it was told to refuse.

**Failure modes that only a model has are now handled.** A reply that is not JSON, is JSON of the wrong shape, or claims to be answerable while carrying no statement, all settle as Unanswerable with a sentence saying what arrived. They are normal outcomes of the boundary, not crashes.

**Context cost is a design property, not an accident.** The schema description is roughly 560 tokens. Assembled once, it is paid for once; assembled per question it would be paid for on every request. The rail reports the figure under "How the query was written" so the claim can be checked.

**Swapping in a hosted model is an implementation and a key.** `LlmProvider` is the only thing to write. The Guard, the read-only role, the audit log and the presentation layer are all downstream of the boundary and would not change — which is what ADR-0004 meant to say, and now what the code supports.

**The determinism argument from ADR-0004 still holds.** The default path has no network call and no API key, so the suite remains reproducible offline. What changed is that the deterministic generator now occupies a slot a real one could actually take.
