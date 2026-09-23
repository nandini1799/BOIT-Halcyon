import type { SafetyCheck, Suggestion } from '@halcyon/shared';
import { SafetyChecks } from '@/components/answer/safety-checks';
import { SqlBlock } from '@/components/answer/sql-block';
import { Alternatives, Correction } from '@/components/states/correction';

const prose = 'max-w-[58ch] font-serif text-[15.5px] leading-[1.62] text-ink-mid';

export function Unanswerable({
  question,
  reason,
  suggestions,
  onAsk,
}: {
  readonly question: string;
  readonly reason: string;
  readonly suggestions: readonly Suggestion[];
  readonly onAsk: (question: string) => void;
}): JSX.Element {
  return (
    <Correction
      tone="warn"
      kicker="Cannot be answered from this data"
      asked={question}
      // Not "there is nothing in the schema": sometimes there is something
      // close, and the reason explains why leaning on it would be wrong.
      title="This cannot be answered from the connected data."
    >
      {/* The server states the whole reason; adding boilerplate would dilute it. */}
      <p className={prose}>{reason}</p>
      <Alternatives questions={suggestions.map((s) => s.question)} onAsk={onAsk} />
    </Correction>
  );
}

export function Blocked({
  question,
  reason,
  sql,
  checks,
  onAsk,
  suggestions,
}: {
  readonly question: string;
  readonly reason: string;
  readonly sql: string;
  readonly checks: readonly SafetyCheck[];
  readonly onAsk: (question: string) => void;
  readonly suggestions: readonly Suggestion[];
}): JSX.Element {
  const failed = checks.filter((check) => check.verdict === 'fail');

  return (
    <Correction
      tone="bad"
      kicker="Blocked before execution"
      asked={question}
      title="This statement was refused. It never reached the database."
    >
      <p className={prose}>
        {reason} The statement below was rejected by the validator before execution, and the
        connection's role holds no grant that would have allowed it in any case — two independent
        controls, both of which held.
      </p>

      <div className="mt-[17px]">
        <SqlBlock
          sql={sql}
          heading="Refused statement — never executed"
          meta={`${failed.length} of ${checks.length} checks failed`}
          refused
        />
        <div className="border border-t-0 border-rule bg-bg-deep px-[13px] py-2">
          <SafetyChecks checks={checks} />
        </div>
      </div>

      <Alternatives questions={suggestions.slice(0, 3).map((s) => s.question)} onAsk={onAsk} />
    </Correction>
  );
}

export function Failed({
  question,
  code,
  message,
  traceId,
  onAsk,
  suggestions,
}: {
  readonly question: string;
  readonly code: string;
  readonly message: string;
  readonly traceId: string;
  readonly onAsk: (question: string) => void;
  readonly suggestions: readonly Suggestion[];
}): JSX.Element {
  const timedOut = code === 'statement_timeout';
  const throttled = code === 'rate_limited';

  return (
    <Correction
      tone="bad"
      kicker={timedOut ? 'Query timed out' : throttled ? 'Not asked' : 'Could not be completed'}
      asked={question}
      title={
        timedOut
          ? 'The query was valid, but too heavy to finish.'
          : throttled
            ? 'This one was not sent. Too many questions at once.'
            : 'Something went wrong running this.'
      }
    >
      <p className={prose}>
        {message}{' '}
        {timedOut &&
          'It passed all five safety checks and began executing, then hit the five-second statement timeout. Nothing was left running, and no partial result is shown — a partial answer to a question about totals is worse than no answer.'}
      </p>

      <dl className="mt-[17px] border border-rule bg-bg-deep px-3.5 py-3 font-mono text-[11.5px] leading-[1.8] text-ink-low">
        <div className="flex gap-3">
          <dt className="w-24 text-ink-mid">error</dt>
          <dd>{timedOut ? '57014 — statement_timeout' : code}</dd>
        </div>
        <div className="flex gap-3">
          <dt className="w-24 text-ink-mid">stage</dt>
          <dd>
            {timedOut
              ? 'execute — 5 of 6 completed'
              : throttled
                ? 'refused before the pipeline started'
                : 'execute'}
          </dd>
        </div>
        <div className="flex gap-3">
          <dt className="w-24 text-ink-mid">trace</dt>
          <dd>{traceId}</dd>
        </div>
      </dl>

      <Alternatives questions={suggestions.slice(0, 3).map((s) => s.question)} onAsk={onAsk} />
    </Correction>
  );
}
