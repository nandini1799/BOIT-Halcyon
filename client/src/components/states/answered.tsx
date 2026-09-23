import type { Answer } from '@halcyon/shared';
import { useRef, useState } from 'react';
import { Byline } from '@/components/answer/byline';
import { Chart, ChartLegend } from '@/components/answer/chart';
import { DataTable } from '@/components/answer/data-table';
import { FigureFrame } from '@/components/answer/figure-frame';
import { Notes } from '@/components/answer/notes';
import { ViewToggle, type FigureView } from '@/components/answer/view-toggle';

interface AnsweredProps {
  readonly answer: Answer;
  readonly onAsk: (question: string) => void;
}

/** Markdown-bold, rendered as the emphasis it is. No other markup is honoured. */
function Standfirst({ text }: { text: string }): JSX.Element {
  return (
    <p className="hl-standfirst mb-6">
      {text.split(/(\*\*[^*]+\*\*)/).map((part, index) =>
        part.startsWith('**') && part.endsWith('**') ? (
          <b key={index}>{part.slice(2, -2)}</b>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </p>
  );
}

const FIGURE_ID = 'hl-figure-panel';

export function Answered({ answer, onAsk }: AnsweredProps): JSX.Element {
  const chartRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<FigureView>('chart');
  const sources = answer.audit.tables.join(', ');
  const rows = answer.rows.length.toLocaleString('en-GB');

  return (
    <article>
      <div className="mb-3 flex flex-wrap justify-between gap-x-6 gap-y-1 border-b border-rule pb-2.5 font-mono text-micro uppercase tracking-[0.14em] text-ink-low">
        <span className="text-salmon">{answer.kicker}</span>
        <span>{new Date(answer.filedAt).toLocaleTimeString('en-GB')}</span>
      </div>

      <h1 className="hl-headline mb-4 text-ink">{answer.headline}</h1>
      <Standfirst text={answer.standfirst} />

      {answer.kpis.length > 0 && (
        <div className="mb-6 flex flex-wrap border-y border-rule">
          {answer.kpis.map((kpi) => (
            <div
              key={kpi.label}
              className="flex-1 basis-40 border-r border-rule py-[15px] pl-5 pr-5 first:pl-0 last:border-r-0"
            >
              {/* A figure treatment on a word reads as shouting, not as data. */}
              <div
                className={
                  /^[£+\-\d]/.test(kpi.value)
                    ? 'hl-figure text-ink'
                    : 'font-serif text-[22px] font-semibold leading-tight tracking-tight text-ink'
                }
              >
                {kpi.value}
              </div>
              <div className="mt-2 font-mono text-micro uppercase tracking-wide text-ink-low">
                {kpi.label}
              </div>
              {kpi.caption !== undefined && (
                <div className="mt-1 text-caption text-ink-mid">{kpi.caption}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {answer.chart !== null && (
        <FigureFrame
          heading={answer.chart.caption}
          subheading={
            view === 'table'
              ? `${rows} rows as returned`
              : `${rows} rows${
                  answer.chart.seriesKeys.length > 1
                    ? ` · ${answer.chart.seriesKeys.length} series`
                    : ''
                }`
          }
          source={sources}
          flush={view === 'table'}
          action={<ViewToggle view={view} onChange={setView} controls={FIGURE_ID} />}
        >
          <div id={FIGURE_ID}>
            {view === 'chart' ? (
              <>
                <Chart
                  spec={answer.chart}
                  columns={answer.columns}
                  rows={answer.rows}
                  svgRef={chartRef}
                />
                <ChartLegend keys={answer.chart.seriesKeys} />
              </>
            ) : (
              <DataTable columns={answer.columns} rows={answer.rows} />
            )}
          </div>
        </FigureFrame>
      )}

      {answer.chart === null && answer.rows.length > 1 && (
        <FigureFrame
          heading="The figures behind this"
          subheading={`${rows} rows as returned`}
          source={sources}
          flush
        >
          <DataTable columns={answer.columns} rows={answer.rows} />
        </FigureFrame>
      )}

      <Notes audit={answer.audit} />
      <Byline answer={answer} chartRef={chartRef} />

      {answer.related.length > 0 && (
        <div className="mt-8">
          <h2 className="hl-label mb-1">Related questions</h2>
          <ul className="border-t border-rule">
            {answer.related.map((suggestion) => (
              <li key={String(suggestion.templateId)}>
                <button
                  type="button"
                  onClick={() => onAsk(suggestion.question)}
                  className="flex w-full items-baseline gap-[11px] border-b border-rule py-[11px] text-left font-serif text-[15px] text-ink-mid transition-colors last:border-b-0 hover:text-salmon"
                >
                  <span className="text-salmon" aria-hidden>
                    →
                  </span>
                  {suggestion.question}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}
