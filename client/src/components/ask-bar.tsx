import { MAX_QUESTION_LENGTH } from '@halcyon/shared';
import { useEffect, useRef, useState, type FormEvent } from 'react';

interface AskBarProps {
  readonly onAsk: (question: string) => void;
  readonly busy: boolean;
  /** Set when a suggestion or a filed answer puts a question in the bar. */
  readonly value: string;
  readonly onValueChange: (value: string) => void;
}

/**
 * The question input. Serif, 20px, underlined rather than boxed.
 *
 * The underline turns salmon on focus because salmon means "the system is
 * speaking" and a focused input is the one place the user is speaking back.
 */
export function AskBar({ onAsk, busy, value, onValueChange }: AskBarProps): JSX.Element {
  const input = useRef<HTMLInputElement>(null);
  const [tooLong, setTooLong] = useState(false);

  useEffect(() => {
    input.current?.focus();
  }, []);

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    const question = value.trim();
    if (question.length === 0 || busy) return;
    if (question.length > MAX_QUESTION_LENGTH) {
      setTooLong(true);
      return;
    }
    setTooLong(false);
    onAsk(question);
  };

  return (
    <div className="border-b border-rule bg-paper px-5 py-[15px] sm:px-10">
      <form onSubmit={submit} className="mx-auto max-w-sheet">
        <div className="flex items-center gap-3 border-b-2 border-rule-hi pb-[9px] focus-within:border-salmon sm:gap-[14px]">
          <input
            ref={input}
            type="text"
            value={value}
            onChange={(event) => {
              onValueChange(event.target.value);
              if (tooLong) setTooLong(false);
            }}
            disabled={busy}
            aria-label="Ask a question"
            aria-invalid={tooLong}
            placeholder="Ask about customers, branches, onboarding or transactions..."
            className="min-w-0 flex-1 bg-transparent font-serif text-ask text-ink outline-none placeholder:text-ink-low disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={busy || value.trim().length === 0}
            className="shrink-0 bg-salmon px-3.5 py-[7px] font-mono text-micro uppercase tracking-wide text-bg-deep transition-colors hover:bg-salmon-deep hover:text-ink disabled:opacity-40 sm:px-[14px]"
          >
            {busy ? 'Filing' : 'Ask'}
          </button>
        </div>

        <div className="mx-auto mt-[9px] font-mono text-micro text-ink-low">
          <span>
            {tooLong
              ? `That question is longer than ${MAX_QUESTION_LENGTH} characters.`
              : 'Every answer is filed with the query that produced it.'}
          </span>
        </div>
      </form>
    </div>
  );
}
