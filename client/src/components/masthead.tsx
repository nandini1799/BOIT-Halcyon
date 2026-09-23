import { Clock } from 'lucide-react';
import type { RefObject } from 'react';
import { Button } from '@/components/ui/button';

interface MastheadProps {
  readonly onOpenHistory: () => void;
  /** So the drawer can hand focus back to the control that opened it. */
  readonly historyButtonRef: RefObject<HTMLButtonElement>;
}

/**
 * The masthead. A 2px ink rule beneath it, as a printed masthead has.
 *
 * The connection and the role it holds are reported where they can be checked —
 * in the safety checks under every answer — rather than announced here, where
 * they would be a claim the reader has no way to test.
 */
export function Masthead({ onOpenHistory, historyButtonRef }: MastheadProps): JSX.Element {
  return (
    <header className="flex items-baseline gap-4 border-b-2 border-ink bg-bg-deep px-5 py-4 sm:gap-[18px] sm:px-10 sm:pb-[13px]">
      <span className="font-serif text-[26px] font-bold tracking-[-0.02em] text-ink">Halcyon</span>
      <span className="hidden font-mono text-micro uppercase tracking-[0.1em] text-ink-low sm:inline">
        Conversational data analyst
      </span>

      <div className="ml-auto flex items-center gap-3 font-mono text-micro text-ink-low sm:gap-5">
        <Button
          ref={historyButtonRef}
          variant="quiet"
          size="sm"
          onClick={onOpenHistory}
          aria-label="Open filed answers"
        >
          <Clock className="size-3" />
          Filed
        </Button>
      </div>
    </header>
  );
}
