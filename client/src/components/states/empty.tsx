import type { Suggestion } from '@halcyon/shared';

interface EmptyProps {
  readonly starters: readonly Suggestion[];
  readonly probes: readonly Suggestion[];
  readonly onAsk: (question: string) => void;
}

export function Empty({ starters, probes, onAsk }: EmptyProps): JSX.Element {
  const probe = probes.find((candidate) => candidate.question.startsWith('Delete')) ?? probes[0];

  return (
    <div className="mx-auto max-w-sheet pt-3.5">
      <h1 className="mb-4 max-w-[18ch] font-serif text-display font-semibold leading-tight tracking-tighter text-ink">
        Ask a question. Get a filed answer.
      </h1>
      <p className="mb-9 max-w-measure font-serif text-prose leading-[1.6] text-ink-mid">
        Halcyon reads four tables of the bank's data. It writes the query, checks the query is safe,
        runs it, and files the result with the query attached so you can see how the number was
        reached.
      </p>

      <h2 className="hl-label mb-4 border-b border-rule pb-2">Today's desk</h2>
      <ul className="grid gap-x-[34px] md:grid-cols-2">
        {starters.map((suggestion, index) => (
          <li key={String(suggestion.templateId)}>
            <button
              type="button"
              onClick={() => onAsk(suggestion.question)}
              className="group w-full border-b border-rule py-[15px] text-left"
            >
              <span className="block font-mono text-micro tracking-wide text-salmon">
                0{index + 1}
              </span>
              <span className="my-1.5 block font-serif text-[17px] leading-snug text-ink transition-colors group-hover:text-salmon">
                {suggestion.question}
              </span>
              <span className="block font-mono text-micro text-ink-low">
                {suggestion.tables.join(' + ')} — {suggestion.form}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {/*
        One example rather than six. The refusal has to stay one click away: it
        is the product's central claim, and a claim nobody can trigger is a
        claim nobody can check.
      */}
      {probe && (
        <p className="mt-9 border-t border-rule pt-4 text-caption leading-[1.6] text-ink-mid">
          Anything that writes to the database is refused before it runs, and the refused statement
          is shown to you. Try{' '}
          <button
            type="button"
            onClick={() => onAsk(probe.question)}
            className="font-mono text-[11px] text-ink-low underline underline-offset-4 transition-colors hover:text-danger"
          >
            {probe.question}
          </button>
          .
        </p>
      )}
    </div>
  );
}
