import { asTraceId, type AskResponse, type HistoryEntry, type Outcome } from '@halcyon/shared';
import { useEffect, useState, type RefObject } from 'react';
import { getHistory, getHistoryDetail } from '@/api/client';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

interface HistoryDrawerProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onRestore: (question: string, response: AskResponse) => void;
  /** Bumped after every question so the list reflects what just happened. */
  readonly revision: number;
  readonly returnFocusTo: RefObject<HTMLButtonElement>;
}

const OUTCOME_STYLE: Readonly<Record<Outcome, string>> = {
  answered: 'text-sage',
  unanswerable: 'text-salmon',
  blocked: 'text-danger',
  failed: 'text-danger',
};

/**
 * The audit log, with a face. See ADR-0005.
 *
 * Re-opening an entry restores what was filed; it never re-runs the query. An
 * answer is a record of what was true when it was asked, and quietly refreshing
 * it would turn the audit trail into a description of the present.
 */
export function HistoryDrawer({
  open,
  onOpenChange,
  onRestore,
  revision,
  returnFocusTo,
}: HistoryDrawerProps): JSX.Element {
  const [entries, setEntries] = useState<readonly HistoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    const controller = new AbortController();
    getHistory(controller.signal)
      .then((page) => setEntries(page.entries))
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'History could not be loaded.');
        }
      });

    return () => controller.abort();
  }, [open, revision]);

  const restore = async (entry: HistoryEntry): Promise<void> => {
    const detail = await getHistoryDetail(String(entry.id));

    const response: AskResponse =
      detail.status === 'answered'
        ? { status: 'answered', answer: detail.answer }
        : detail.status === 'unanswerable'
          ? { status: 'unanswerable', reason: detail.reason, suggestions: [] }
          : detail.status === 'blocked'
            ? {
                status: 'blocked',
                reason: detail.reason,
                sql: detail.sql,
                checks: detail.checks,
              }
              : {
                status: 'failed',
                code: detail.code,
                message: detail.message,
                traceId: asTraceId(String(entry.id)),
              };

    onRestore(entry.question, response);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="overflow-y-auto"
        /*
         * The drawer is opened by a button that is not a Radix trigger, so
         * Radix has nothing to hand focus back to and it lands on the document.
         * A keyboard user who pressed Escape would have to tab from the top of
         * the page again.
         */
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocusTo.current?.focus();
        }}
      >
        <SheetHeader>
          <SheetTitle>Filed answers</SheetTitle>
          <SheetDescription className="mt-1.5">
            Every question, whatever became of it. Re-opening one restores it unchanged.
          </SheetDescription>
        </SheetHeader>

        {error !== null && <p className="px-6 py-5 text-caption text-danger">{error}</p>}

        {error === null && entries.length === 0 && (
          <p className="px-6 py-5 text-caption text-ink-low">Nothing filed yet.</p>
        )}

        <ul>
          {entries.map((entry) => (
            <li key={String(entry.id)}>
              <button
                type="button"
                onClick={() => void restore(entry)}
                className="w-full border-b border-rule px-6 py-3.5 text-left transition-colors hover:bg-paper"
              >
                <div className="flex items-baseline justify-between gap-3 font-mono text-micro uppercase tracking-wide">
                  <span className={OUTCOME_STYLE[entry.outcome]}>{entry.outcome}</span>
                  <span className="shrink-0 tabular-nums text-ink-low">
                    {new Date(entry.askedAt).toLocaleTimeString('en-GB')}
                  </span>
                </div>
                <p className="mt-1.5 font-serif text-[15px] leading-snug text-ink-mid">
                  {entry.question}
                </p>
                <p className="mt-1 font-mono text-micro text-ink-low">
                  {entry.elapsedMs} ms
                  {entry.rowCount !== null && ` · ${entry.rowCount.toLocaleString('en-GB')} rows`}
                  {entry.tables.length > 0 && ` · ${entry.tables.join(', ')}`}
                </p>
              </button>
            </li>
          ))}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
