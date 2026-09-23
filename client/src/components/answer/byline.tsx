import type { Answer } from '@halcyon/shared';
import type { RefObject } from 'react';
import { copyText, downloadChartPng } from '@/lib/copy';
import { stripEmphasis, toCsv } from '@/lib/format';

interface BylineProps {
  readonly answer: Answer;
  readonly chartRef: RefObject<HTMLDivElement>;
}

/** The copy affordances, in a ruled row beneath the notes. All of them work. */
export function Byline({ answer, chartRef }: BylineProps): JSX.Element {
  const actions: { label: string; run: () => void | Promise<void> }[] = [
    {
      label: 'Copy answer',
      run: () =>
        copyText(
          `${answer.headline}\n\n${stripEmphasis(answer.standfirst)}\n\nSource: Halcyon — ${answer.audit.tables.join(', ')}`,
          'Answer',
        ),
    },
    {
      label: 'Copy data — CSV',
      run: () => copyText(toCsv(answer.columns, answer.rows), 'CSV'),
    },
    {
      label: 'Copy data — JSON',
      run: () => copyText(JSON.stringify(answer.rows, null, 2), 'JSON'),
    },
    { label: 'Copy SQL', run: () => copyText(answer.audit.sql, 'SQL') },
  ];

  if (answer.chart !== null) {
    actions.push({
      label: 'Download chart',
      run: () => {
        const svg = chartRef.current?.querySelector('svg');
        if (svg) void downloadChartPng(svg, `halcyon-${answer.templateId}.png`);
      },
    });
  }

  return (
    <div className="mt-1 flex flex-wrap border-t border-rule">
      {actions.map((action) => (
        <button
          key={action.label}
          type="button"
          onClick={() => void action.run()}
          className="flex-1 border-r border-rule px-2 py-[11px] font-mono text-micro text-ink-low transition-colors last:border-r-0 hover:bg-paper hover:text-salmon"
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}
