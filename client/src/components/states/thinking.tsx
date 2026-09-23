import { STAGE_LABELS } from '@halcyon/shared';
import { useEffect, useState } from 'react';
import type { StageView } from '@/hooks/use-ask';

interface ThinkingProps {
  readonly question: string;
  readonly stages: readonly StageView[];
}

/**
 * The pipeline, as it runs.
 *
 * Every dot here is driven by an event the server actually sent. Nothing is on
 * a timer and nothing is predicted — see ADR-0007. It is the one screen that
 * would be trivial to fake and the one screen where faking it would undermine
 * the entire argument of the product.
 */
export function Thinking({ question, stages }: ThinkingProps): JSX.Element {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Date.now() - started), 100);
    return () => clearInterval(timer);
  }, []);

  return (
    <article>
      <div className="mb-3 flex justify-between gap-4 border-b border-rule pb-2.5 font-mono text-micro uppercase tracking-[0.14em] text-ink-low">
        <span className="text-salmon">Filing</span>
        <span className="tabular-nums">{elapsed.toLocaleString('en-GB')} ms elapsed</span>
      </div>

      <h1 className="hl-headline mb-7 text-ink-mid">{question}</h1>

      <ol className="ml-1 border-l-2 border-rule pl-[22px]">
        {stages.map((stage) => {
          const running = stage.status === 'running';
          const done = stage.status === 'done';
          const skipped = stage.status === 'skipped';

          return (
            <li
              key={stage.stage}
              className={`relative pb-[22px] ${stage.status === 'idle' ? 'opacity-40' : ''}`}
            >
              <span
                aria-hidden
                className={`absolute -left-[27px] top-[5px] size-2 rounded-full border-2 ${
                  done
                    ? 'border-sage bg-sage'
                    : running
                      ? 'border-salmon bg-salmon'
                      : skipped
                        ? 'border-rule-hi bg-rule-hi'
                        : 'border-rule-hi bg-bg'
                }`}
              />
              <div className="flex items-baseline justify-between gap-4">
                <span
                  className={`font-serif text-[16.5px] font-semibold ${
                    running ? 'text-ink' : 'text-ink-mid'
                  }`}
                >
                  {STAGE_LABELS[stage.stage]}
                  {running && (
                    <span className="ml-1 animate-pulse text-salmon" aria-hidden>
                      …
                    </span>
                  )}
                </span>
                {(done || skipped) && (
                  <span className="shrink-0 font-mono text-micro tabular-nums text-ink-low">
                    {stage.elapsedMs} ms
                  </span>
                )}
              </div>
              {stage.detail !== undefined && (
                <div className="mt-[3px] font-mono text-[11px] text-ink-low">{stage.detail}</div>
              )}
              <span className="sr-only">
                {done ? 'complete' : running ? 'in progress' : skipped ? 'skipped' : 'waiting'}
              </span>
            </li>
          );
        })}
      </ol>
    </article>
  );
}
