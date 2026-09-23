import { STAGE_LABELS, type Answer } from '@halcyon/shared';
import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { SafetyChecks } from '@/components/answer/safety-checks';
import { SqlBlock } from '@/components/answer/sql-block';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface NotesProps {
  readonly audit: Answer['audit'];
}

/**
 * "Notes on this answer" — the audit block.
 *
 * Collapsed by default, because most readers want the answer. Present always,
 * because the ones who want the query must never have to ask for it, and an
 * answer whose working is unavailable is just an assertion with a chart.
 */
export function Notes({ audit }: NotesProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const passed = audit.checks.filter((check) => check.verdict === 'pass').length;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-2 border-t-2 border-ink">
      <CollapsibleTrigger className="flex w-full items-center gap-[11px] py-[13px] font-mono text-[11px] uppercase tracking-wide text-ink-mid transition-colors hover:text-salmon">
        <ChevronRight
          className={`size-3 text-salmon transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
          aria-hidden
        />
        <span>Notes on this answer</span>
        <span className="ml-auto flex items-center gap-[7px] text-micro normal-case text-ink-low">
          <span className="inline-block size-[6px] bg-sage" aria-hidden />
          Validated — read-only
        </span>
      </CollapsibleTrigger>

      <CollapsibleContent className="pb-5">
        <div className="grid items-start gap-5 lg:grid-cols-[1fr_250px]">
          <SqlBlock
            sql={audit.sql}
            parameters={audit.parameters}
            heading="Query as executed"
            {...(audit.planCost !== null ? { meta: `cost ${audit.planCost.toFixed(1)}` } : {})}
          />

          <div>
            <h3 className="mb-1 font-mono text-micro uppercase tracking-wide text-ink-low">
              Safety checks — {passed} of {audit.checks.length}
            </h3>
            <SafetyChecks checks={audit.checks} />

            <h3 className="mb-1 mt-5 font-mono text-micro uppercase tracking-wide text-ink-low">
              Stage timings
            </h3>
            <ul className="font-mono text-[11px] text-ink-low">
              {audit.stageTimings.map((timing) => (
                <li
                  key={timing.stage}
                  className="flex justify-between border-b border-rule py-1 last:border-b-0"
                >
                  <span>{STAGE_LABELS[timing.stage]}</span>
                  <span className="tabular-nums text-ink-mid">{timing.elapsedMs} ms</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
