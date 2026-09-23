---
status: accepted
---

# No LLM: a Question Catalogue behind the generator interface

The brief permits "any LLM provider or mocked AI implementation". We ship the mock only. A real generator would be the one part of the system no test could cover deterministically and — with no API key available — the one part nobody had ever seen run. Unverified code in the headline feature is worse than an honest deterministic one.

Question resolution is a **Question Catalogue**: canonical question patterns with synonym lists, each mapping to a parameterised SQL template plus the prose and Form it produces. A Question that matches nothing is Unanswerable and returns the nearest Templates as suggestions, rather than guessing.

The catalogue sits behind a `SqlGenerator` interface with a real LLM implementation deliberately left unwritten. The interface is not speculative generality: it is what makes the next point true.

## Consequences

**The Guard is independent of the generator.** The same Guard tests pass whether SQL arrived from a template or a model, which is the property the brief is actually testing when it says AI-generated SQL must not execute without control. A future `LlmGenerator` inherits every control without touching them.

**The capability surface is narrow, so the product advertises it.** Starter questions on the empty state, a "you could also ask" block in the evidence rail of every Answer, and nearest-match suggestions on Unanswerable. A narrow question space is only a failure if it is hidden.
