import type { CellValue, ChartSpec, Column, Form, Row } from '@halcyon/shared';

export interface Presentation {
  readonly form: Form;
  readonly columns: readonly Column[];
  readonly rows: readonly Row[];
  readonly chart: ChartSpec | null;
  /** Shown in the evidence rail. A form chosen without a reason is a guess. */
  readonly rationale: string;
}

const isNumeric = (column: Column): boolean =>
  column.type === 'number' || column.type === 'currency' || column.type === 'percent';

const MAX_SERIES = 8;
const MAX_BARS = 32;
const LONG_LABEL = 11;

/**
 * Chooses how an answer should be drawn, from the shape of the result alone.
 *
 * The template says what it expects, but the data decides: a question that
 * usually returns a trend returns a single number when the range is one month,
 * and drawing a line through one point would be a lie about what was measured.
 */
export interface PresentationHints {
  /**
   * What the template expects. A preference, not an instruction: the data can
   * veto it, but where several forms are honest the template's choice wins.
   * Twelve months by four segments is legible either as lines or as grouped
   * bars, and the approved design asked for bars.
   */
  readonly preferred?: Form;
  /** The column to plot, where the result carries more than one number. */
  readonly measure?: string;
  /** The chart's heading. */
  readonly title: string;
}

export function choosePresentation(
  columns: readonly Column[],
  rows: readonly Row[],
  source: string,
  hints: PresentationHints,
): Presentation {
  const { preferred, title } = hints;
  const all = columns.filter(isNumeric);
  const chosen = hints.measure === undefined ? undefined : all.find((c) => c.key === hints.measure);
  // The declared measure leads; the rest stay available as further series.
  const numeric = chosen ? [chosen, ...all.filter((c) => c.key !== chosen.key)] : all;
  const [firstColumn] = columns;

  if (rows.length === 0) {
    return { form: 'table', columns, rows, chart: null, rationale: 'The query returned no rows, so there is nothing to draw.' };
  }

  if (rows.length === 1 && numeric.length === 1) {
    return {
      form: 'kpi',
      columns,
      rows,
      chart: null,
      rationale: 'One row with a single measure: a figure, not a chart.',
    };
  }

  const pivoted = pivot(columns, rows);
  if (pivoted) {
    const overTime = pivoted.category.type === 'date';
    // Grouped bars stay readable to roughly two years of monthly buckets.
    const barsWouldWork = pivoted.rows.length <= 24;
    const kind: 'line' | 'bar' =
      overTime && !(preferred === 'bar' && barsWouldWork) ? 'line' : 'bar';
    return {
      form: kind,
      columns: pivoted.columns,
      rows: pivoted.rows,
      chart: {
        kind,
        categoryKey: pivoted.category.key,
        seriesKeys: pivoted.seriesKeys,
        caption: title,
        source,
      },
      rationale: `One measure split by ${pivoted.seriesKeys.length} categories across ${pivoted.rows.length} ${overTime ? 'periods' : 'groups'}, drawn as ${kind === 'line' ? 'lines' : 'grouped bars'}.`,
    };
  }

  if (firstColumn && firstColumn.type === 'date' && numeric.length >= 1 && rows.length > 2) {
    // Lines share one axis, so they must share a unit. Drawing a count of
    // transactions beside their value in pounds pins the count to the zero line
    // and labels it in currency; only measures matching the lead are plotted,
    // and the rest stay in the table where their own units are printed.
    const lead = numeric[0];
    const plotted = lead ? numeric.filter((column) => column.type === lead.type) : [];
    const withheld = numeric.length - plotted.length;

    return {
      form: 'line',
      columns,
      rows,
      chart: {
        kind: 'line',
        categoryKey: firstColumn.key,
        seriesKeys: plotted.map((c) => c.key),
        caption: title,
        source,
      },
      rationale:
        withheld === 0
          ? 'The result is measured over time, so it is drawn as a line.'
          : `The result is measured over time, so it is drawn as a line. ${withheld} further ${withheld === 1 ? 'column is' : 'columns are'} measured in other units and would not share the axis honestly, so ${withheld === 1 ? 'it is' : 'they are'} left to the table.`,
    };
  }

  // A bar chart shows one measure against one label. Where the result carries
  // more than that — customer, segment, branch, count and value — charting it
  // would silently drop three of the five columns the question asked for.
  const chartableWidth = columns.length <= 3 || preferred === 'bar';

  if (
    firstColumn &&
    firstColumn.type === 'text' &&
    numeric.length >= 1 &&
    rows.length <= MAX_BARS &&
    chartableWidth &&
    preferred !== 'table'
  ) {
    const labels = rows.map((row) => String(row[firstColumn.key] ?? ''));
    const longLabels = labels.reduce((sum, l) => sum + l.length, 0) / labels.length > LONG_LABEL;

    return {
      form: 'bar',
      columns,
      rows,
      chart: {
        kind: longLabels ? 'horizontal-bar' : 'bar',
        categoryKey: firstColumn.key,
        seriesKeys: [numeric[0]?.key ?? ''],
        caption: title,
        source,
      },
      rationale: longLabels
        ? 'A small number of named categories with long labels, so the bars run horizontally and stay readable.'
        : 'A small number of categories compared on one measure, so it is drawn as bars.',
    };
  }

  return {
    form: 'table',
    columns,
    rows,
    chart: null,
    rationale:
      rows.length > MAX_BARS
        ? `${rows.length.toLocaleString()} rows is too many to chart honestly, so the figures are tabulated.`
        : 'The result has several dimensions that no single chart would represent faithfully, so it is tabulated.',
  };
}

interface Pivoted {
  readonly category: Column;
  readonly seriesKeys: readonly string[];
  readonly columns: readonly Column[];
  readonly rows: readonly Row[];
}

/**
 * Turns `(month, segment, applications)` into one row per month with a column
 * per segment. Charting libraries want the wide shape and SQL produces the long
 * one; doing it here means the client never reshapes data it did not compute.
 */
function pivot(columns: readonly Column[], rows: readonly Row[]): Pivoted | null {
  if (columns.length !== 3) return null;

  const [category, series, measure] = columns;
  if (!category || !series || !measure) return null;
  if (series.type !== 'text' || !isNumeric(measure)) return null;
  if (category.type !== 'date' && category.type !== 'text') return null;

  const seriesKeys = [...new Set(rows.map((row) => String(row[series.key] ?? '')))];
  if (seriesKeys.length < 2 || seriesKeys.length > MAX_SERIES) return null;

  const buckets = new Map<string, Record<string, CellValue>>();
  for (const row of rows) {
    const key = String(row[category.key] ?? '');
    const bucket = buckets.get(key) ?? { [category.key]: row[category.key] ?? null };
    bucket[String(row[series.key] ?? '')] = row[measure.key] ?? null;
    buckets.set(key, bucket);
  }

  // Every series present on every bucket, so a gap reads as zero rather than a break.
  const wide: Row[] = [...buckets.values()].map((bucket) => {
    const complete: Record<string, CellValue> = { ...bucket };
    for (const key of seriesKeys) complete[key] ??= 0;
    return complete;
  });

  return {
    category,
    seriesKeys,
    columns: [
      category,
      ...seriesKeys.map((key) => ({
        key,
        label: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        type: measure.type,
      })),
    ],
    rows: wide,
  };
}
