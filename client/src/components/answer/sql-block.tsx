import type { CellValue } from '@halcyon/shared';

interface SqlBlockProps {
  readonly sql: string;
  readonly parameters?: readonly CellValue[];
  readonly heading: string;
  readonly meta?: string;
  /** A refused statement is printed in a lower ink, and never as if it ran. */
  readonly refused?: boolean;
}

const KEYWORDS =
  /\b(SELECT|FROM|WHERE|GROUP BY|ORDER BY|HAVING|JOIN|LEFT JOIN|INNER JOIN|ON|AND|OR|AS|LIMIT|WITH|CASE|WHEN|THEN|ELSE|END|CAST|COUNT|SUM|AVG|ROUND|DESC|ASC|NOT|IN|IS|NULL|DISTINCT|BETWEEN|DELETE|DROP|INSERT|UPDATE|TRUNCATE|UNION)\b/g;

/**
 * The statement, highlighted enough to read and not so much that it decorates.
 *
 * Write verbs are coloured as errors even inside a refused statement, because
 * the point of showing a refusal is that the dangerous part is obvious.
 */
function highlight(sql: string): JSX.Element[] {
  const parts = sql.split(KEYWORDS);
  return parts.map((part, index) => {
    if (index % 2 === 1) {
      const danger = /^(DELETE|DROP|INSERT|UPDATE|TRUNCATE)$/i.test(part);
      return (
        <span key={index} className={danger ? 'text-danger' : 'text-slate'}>
          {part}
        </span>
      );
    }
    return (
      <span key={index}>
        {part.split(/(\$\d+)/).map((segment, segmentIndex) =>
          /^\$\d+$/.test(segment) ? (
            <span key={segmentIndex} className="text-salmon">
              {segment}
            </span>
          ) : (
            segment
          ),
        )}
      </span>
    );
  });
}

export function SqlBlock({
  sql,
  parameters,
  heading,
  meta,
  refused = false,
}: SqlBlockProps): JSX.Element {
  return (
    <div className="min-w-0 border border-rule bg-bg-deep">
      <div className="flex justify-between gap-3 border-b border-rule px-[13px] py-2 font-mono text-micro uppercase tracking-wide text-ink-low">
        <span>{heading}</span>
        {meta !== undefined && <span className="shrink-0 normal-case">{meta}</span>}
      </div>

      <pre
        className={`whitespace-pre-wrap break-words px-[13px] py-3 font-mono text-[11.5px] leading-[1.7] ${
          refused ? 'text-ink-low' : 'text-ink-mid'
        }`}
      >
        <code>{highlight(sql)}</code>
      </pre>

      {parameters !== undefined && parameters.length > 0 && (
        <div className="border-t border-rule px-[13px] py-2.5 font-mono text-[11px] text-ink-low">
          <span className="uppercase tracking-wide">Bound values</span>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
            {parameters.map((parameter, index) => (
              <span key={index}>
                <span className="text-salmon">${index + 1}</span>{' '}
                <span className="text-ink-mid">{JSON.stringify(parameter)}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
