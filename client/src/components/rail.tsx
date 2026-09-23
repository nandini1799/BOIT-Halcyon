import type { AskResponse, GeneratorTrace, SchemaResponse } from '@halcyon/shared';
import { ChevronRight } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const HEADING = 'px-3.5 py-2.5 font-mono text-micro uppercase tracking-[0.11em] text-ink-low';

function Card({ heading, children }: { heading: string; children: ReactNode }): JSX.Element {
  return (
    <section className="border border-rule bg-paper">
      <h2 className={`border-b border-rule ${HEADING}`}>{heading}</h2>
      <div className="px-3.5 py-[13px]">{children}</div>
    </section>
  );
}

/** A card whose contents are worth having but not worth the column height. */
function FoldedCard({ heading, children }: { heading: string; children: ReactNode }): JSX.Element {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible asChild open={open} onOpenChange={setOpen}>
      <section className="border border-rule bg-paper">
        <CollapsibleTrigger
          className={`flex w-full items-center gap-2 text-left transition-colors hover:text-ink-mid ${HEADING} ${open ? 'border-b border-rule' : ''}`}
        >
          <ChevronRight
            className={`size-3 text-salmon transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
            aria-hidden
          />
          {heading}
        </CollapsibleTrigger>
        <CollapsibleContent className="px-3.5 py-[13px]">{children}</CollapsibleContent>
      </section>
    </Collapsible>
  );
}

function Fact({ label, value }: { readonly label: string; readonly value: string }): JSX.Element {
  return (
    <li className="flex justify-between gap-3 border-b border-rule py-1 last:border-b-0">
      <span>{label}</span>
      <span className="truncate tabular-nums text-ink-mid">{value}</span>
    </li>
  );
}

/**
 * What produced the statement, and what it cost.
 *
 * The schema context is assembled once for the process, so its tokens are paid
 * for once rather than on every question. Printing the figure is how that claim
 * stays checkable rather than remaining a line in an ADR.
 */
function HowItWasWritten({ trace }: { trace: GeneratorTrace }): JSX.Element {
  return (
    <FoldedCard heading="How the query was written">
      <ul className="font-mono text-[11px] text-ink-low">
        <Fact label="Model" value={trace.model} />
        <Fact label="Provider" value={trace.provider} />
        <Fact
          label="Schema context"
          value={`${trace.contextTokens} tok${trace.contextCached ? ', cached' : ', built'}`}
        />
        <Fact
          label="Prompt / reply"
          value={`${trace.promptTokens} / ${trace.completionTokens} tok`}
        />
      </ul>
    </FoldedCard>
  );
}

interface RailProps {
  readonly schema: SchemaResponse | null;
  readonly response: AskResponse | null;
}

/**
 * The evidence rail. What was read, and why the answer looks the way it does.
 *
 * Row counts come from the schema endpoint, which queries them live, so the
 * rail cannot drift from the database it claims to describe.
 */
export function Rail({ schema, response }: RailProps): JSX.Element {
  const answered = response?.status === 'answered' ? response.answer : null;
  const touched = new Set(answered?.audit.tables ?? []);

  return (
    <aside
      aria-label="Evidence"
      className="flex flex-col gap-5 xl:sticky xl:top-[53px]"
    >
      <Card heading={answered ? 'Sources drawn on' : 'Tables available'}>
        <ul className="space-y-2.5">
          {(schema?.tables ?? []).map((table) => {
            const used = touched.has(table.name);
            return (
              <li key={table.name}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex cursor-help items-baseline justify-between gap-3 text-left">
                      <span
                        className={`font-mono text-[11.5px] ${used ? 'text-salmon' : 'text-ink-mid'}`}
                      >
                        {table.name}
                      </span>
                      <span className="shrink-0 font-mono text-micro tabular-nums text-ink-low">
                        {table.rowCount.toLocaleString('en-GB')}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="left">{table.description}</TooltipContent>
                </Tooltip>
              </li>
            );
          })}
        </ul>
        {answered && (
          <p className="mt-3 border-t border-rule pt-2.5 text-caption leading-snug text-ink-mid">
            Highlighted tables were read to produce this answer.
          </p>
        )}
      </Card>

      {answered && (
        <Card heading={`Why a ${answered.form === 'kpi' ? 'figure' : answered.form}`}>
          <p className="mb-[7px] font-serif text-[14px] font-semibold text-ink">
            {answered.chart?.kind.replace('-', ' ') ?? 'Tabulated'}
          </p>
          <p className="text-caption leading-[1.55] text-ink-mid">{answered.formRationale}</p>
        </Card>
      )}

      {answered?.audit.generator && <HowItWasWritten trace={answered.audit.generator} />}

      {answered && answered.assumptions.length > 0 && (
        <Card heading="What was assumed">
          <ul className="space-y-2">
            {answered.assumptions.map((assumption) => (
              <li key={assumption} className="text-caption leading-[1.55] text-ink-mid">
                {assumption}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {!answered && (
        <Card heading="What Halcyon can answer">
          <p className="mb-[11px] text-caption leading-[1.55] text-ink-mid">
            Counts, sums, rankings, rates and trends over four tables — customers, branches,
            onboarding applications and transactions.
          </p>
          <p className="text-caption leading-[1.55] text-ink-mid">
            It will not forecast, infer causes, or reach outside the schema. When a question needs
            data that is not there, it says so rather than approximating.
          </p>
        </Card>
      )}
    </aside>
  );
}
