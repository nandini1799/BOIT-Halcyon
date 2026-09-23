import type { ReactNode } from 'react';

interface CorrectionProps {
  readonly tone: 'warn' | 'bad';
  readonly kicker: string;
  readonly asked: string;
  readonly title: string;
  readonly children: ReactNode;
}

/**
 * The frame shared by every outcome that is not an answer.
 *
 * It is called a correction because that is what a newspaper calls this: a
 * printed acknowledgement that something could not be stated. Salmon warns that
 * the question was outside the data; red means something was refused or failed.
 */
export function Correction({
  tone,
  kicker,
  asked,
  title,
  children,
}: CorrectionProps): JSX.Element {
  return (
    <div className="border border-rule-hi bg-paper">
      <div
        className={`flex items-center gap-2.5 border-b border-rule px-5 py-3 font-mono text-micro uppercase tracking-[0.12em] ${
          tone === 'bad' ? 'text-danger' : 'text-salmon'
        }`}
      >
        <span className="inline-block size-[7px] bg-current" aria-hidden />
        {kicker}
      </div>

      <div className="px-5 py-[18px]">
        <p className="mb-[13px] font-mono text-[11.5px] text-ink-low">Asked: “{asked}”</p>
        <h1 className="mb-2.5 max-w-[28ch] font-serif text-[22px] font-semibold leading-[1.28] text-ink">
          {title}
        </h1>
        {children}
      </div>
    </div>
  );
}

/** The suggested next questions beneath a correction. */
export function Alternatives({
  questions,
  onAsk,
}: {
  readonly questions: readonly string[];
  readonly onAsk: (question: string) => void;
}): JSX.Element | null {
  if (questions.length === 0) return null;

  return (
    <ul aria-label="Questions it can answer instead" className="mt-[18px] border-t border-rule pt-1">
      {questions.map((question) => (
        <li key={question}>
          <button
            type="button"
            onClick={() => onAsk(question)}
            className="flex w-full items-baseline gap-[11px] border-b border-rule py-[11px] text-left font-serif text-[15px] text-ink-mid transition-colors hover:text-salmon"
          >
            <span className="text-salmon" aria-hidden>
              →
            </span>
            {question}
          </button>
        </li>
      ))}
    </ul>
  );
}
