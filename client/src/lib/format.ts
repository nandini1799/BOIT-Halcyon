import type { CellValue, Column, Row } from '@halcyon/shared';

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** `2025-03` reads as `Mar 2025`; anything else is left alone. */
export function formatMonth(value: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return value;
  const [, year, month] = match;
  return `${MONTHS[Number(month) - 1] ?? month} ${year}`;
}

export function formatCurrency(value: number, compact = true): string {
  const abs = Math.abs(value);
  if (!compact) return `£${value.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`;
  if (abs >= 1_000_000_000) return `£${(value / 1_000_000_000).toFixed(2)}bn`;
  if (abs >= 1_000_000) return `£${(value / 1_000_000).toFixed(1)}m`;
  if (abs >= 1_000) return `£${(value / 1_000).toFixed(0)}k`;
  return `£${value.toFixed(0)}`;
}

/**
 * Renders a cell the way its column says it should read.
 *
 * Currency is compact in charts and exact in tables: an axis label of
 * £171,590,204 is unreadable, and a table cell of £172m has thrown away the
 * precision the table exists to show.
 */
export function formatCell(value: CellValue, column: Column, compact = false): string {
  if (value === null) return '—';

  switch (column.type) {
    case 'currency':
      return formatCurrency(Number(value), compact);
    case 'percent':
      return `${Number(value).toFixed(1)}%`;
    case 'number':
      return Number(value).toLocaleString('en-GB', { maximumFractionDigits: 2 });
    case 'date':
      return formatMonth(String(value));
    case 'text':
      return String(value);
    default: {
      const never: never = column.type;
      return String(never);
    }
  }
}

/** Compact axis and label formatting, where space is the binding constraint. */
export function formatCompact(value: number, type: Column['type']): string {
  if (type === 'currency') return formatCurrency(value, true);
  if (type === 'percent') return `${value.toFixed(0)}%`;
  if (Math.abs(value) >= 10_000) return `${(value / 1000).toFixed(0)}k`;
  return value.toLocaleString('en-GB', { maximumFractionDigits: 1 });
}

export const toCsv = (columns: readonly Column[], rows: readonly Row[]): string => {
  const escape = (value: CellValue): string => {
    const text = value === null ? '' : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  return [
    columns.map((column) => escape(column.label)).join(','),
    ...rows.map((row) => columns.map((column) => escape(row[column.key] ?? null)).join(',')),
  ].join('\n');
};

/** Markdown-bold only. The standfirst is prose from the server, not HTML. */
export const stripEmphasis = (markdown: string): string => markdown.replace(/\*\*/g, '');
