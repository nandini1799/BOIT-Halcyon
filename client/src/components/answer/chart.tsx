import type { ChartSpec, Column, Row } from '@halcyon/shared';
import { useRef } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatCell, formatCompact } from '@/lib/format';

/** Series order is fixed. Danger red is absent by design: it means "error". */
export const SERIES = ['#FF9E7A', '#8FBF9F', '#8FA9C4', '#C9A227'] as const;

interface ChartProps {
  readonly spec: ChartSpec;
  readonly columns: readonly Column[];
  readonly rows: readonly Row[];
  readonly svgRef?: React.RefObject<HTMLDivElement>;
}

const AXIS = { fill: '#948880', fontFamily: "'IBM Plex Mono', monospace", fontSize: 10 };

/**
 * A line ends flush with the axis edge, so the final tick needs half its own
 * width of margin; at 14px the SVG clipped "Dec 2025" to "Dec 202".
 */
const LINE_MARGIN = { top: 8, right: 32, bottom: 4, left: 4 };

/**
 * Charts are drawn only in shapes Recharts reproduces exactly, and every bar
 * prints its own value — the accessibility rule is that nothing may be encoded
 * by colour alone, and a legend is not a substitute for a number.
 */
export function Chart({ spec, columns, rows, svgRef }: ChartProps): JSX.Element {
  const fallback = useRef<HTMLDivElement>(null);
  const container = svgRef ?? fallback;

  const categoryColumn = columns.find((column) => column.key === spec.categoryKey);
  const valueColumn = columns.find((column) => column.key === spec.seriesKeys[0]);
  const valueType = valueColumn?.type ?? 'number';

  const tickCategory = (value: unknown): string =>
    categoryColumn ? formatCell(value as never, categoryColumn, true) : String(value);
  const tickValue = (value: number): string => formatCompact(value, valueType);

  /**
   * Printed values keep the precision the ordering depends on. Three bars of
   * 23.0, 22.9 and 22.8 all labelled "23%" make the sort look arbitrary.
   */
  const labelValue = (value: number): string =>
    valueType === 'percent' ? `${value.toFixed(1)}%` : formatCompact(value, valueType);

  const tooltip = (
    <Tooltip
      cursor={{ fill: '#231D19' }}
      formatter={(value: number, name: string) => [labelValue(value), name]}
      labelFormatter={tickCategory}
    />
  );

  const horizontal = spec.kind === 'horizontal-bar';
  const height = horizontal ? Math.max(200, rows.length * 30 + 40) : 280;

  return (
    <div ref={container} className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {spec.kind === 'line' ? (
          <LineChart data={rows as Row[]} margin={LINE_MARGIN}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey={spec.categoryKey} tick={AXIS} tickFormatter={tickCategory} tickLine={false} />
            <YAxis tick={AXIS} tickFormatter={tickValue} tickLine={false} width={52} />
            {tooltip}
            {spec.seriesKeys.map((key, index) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={SERIES[index % SERIES.length]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 3 }}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        ) : horizontal ? (
          <BarChart
            data={rows as Row[]}
            layout="vertical"
            margin={{ top: 4, right: 58, bottom: 4, left: 4 }}
          >
            <CartesianGrid horizontal={false} />
            <XAxis type="number" tick={AXIS} tickFormatter={tickValue} tickLine={false} />
            <YAxis
              type="category"
              dataKey={spec.categoryKey}
              tick={AXIS}
              tickLine={false}
              width={132}
            />
            {tooltip}
            <Bar dataKey={spec.seriesKeys[0] ?? ''} isAnimationActive={false} barSize={14}>
              {rows.map((_, index) => (
                <Cell key={index} fill={SERIES[0]} />
              ))}
              <LabelList
                dataKey={spec.seriesKeys[0] ?? ''}
                position="right"
                formatter={labelValue}
                style={AXIS}
              />
            </Bar>
          </BarChart>
        ) : (
          <BarChart data={rows as Row[]} margin={{ top: 14, right: 14, bottom: 4, left: 4 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey={spec.categoryKey} tick={AXIS} tickFormatter={tickCategory} tickLine={false} />
            <YAxis tick={AXIS} tickFormatter={tickValue} tickLine={false} width={52} />
            {tooltip}
            {spec.seriesKeys.map((key, index) => (
              <Bar key={key} dataKey={key} fill={SERIES[index % SERIES.length]} isAnimationActive={false}>
                {spec.seriesKeys.length === 1 && (
                  <LabelList dataKey={key} position="top" formatter={labelValue} style={AXIS} />
                )}
              </Bar>
            ))}
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

/** The legend, printed beneath rather than inside, so it never overlaps a bar. */
export function ChartLegend({ keys }: { keys: readonly string[] }): JSX.Element | null {
  if (keys.length < 2) return null;

  return (
    <ul className="flex flex-wrap gap-4 px-1.5 pb-0.5 pt-2.5 text-caption text-ink-mid">
      {keys.map((key, index) => (
        <li key={key} className="flex items-center gap-[7px]">
          <span
            className="inline-block h-[3px] w-[11px]"
            style={{ background: SERIES[index % SERIES.length] }}
          />
          {key.replace(/_/g, ' ')}
        </li>
      ))}
    </ul>
  );
}
