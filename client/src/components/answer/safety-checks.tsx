import type { SafetyCheck } from '@halcyon/shared';
import { Check, X } from 'lucide-react';

/**
 * The five checks, each with its verdict and the reason for it.
 *
 * Verdicts carry an icon as well as a colour: a red tick and a green tick are
 * the same shape, and roughly one man in twelve cannot tell them apart.
 */
export function SafetyChecks({ checks }: { checks: readonly SafetyCheck[] }): JSX.Element {
  return (
    <ul>
      {checks.map((check) => {
        const failed = check.verdict === 'fail';
        return (
          <li key={check.id} className="flex gap-2.5 border-b border-rule py-[7px] last:border-b-0">
            <span className="mt-0.5 shrink-0" aria-hidden>
              {failed ? (
                <X className="size-3 text-danger" strokeWidth={2.5} />
              ) : (
                <Check className="size-3 text-sage" strokeWidth={2.5} />
              )}
            </span>
            <span>
              <span className={`block text-[12.5px] ${failed ? 'text-danger' : 'text-ink-mid'}`}>
                {check.label}
                <span className="sr-only">{failed ? ' — failed' : ' — passed'}</span>
              </span>
              <span className="mt-[3px] block text-[11px] leading-[1.45] text-ink-low">
                {check.detail}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
