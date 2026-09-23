import type { Column, Row } from '@halcyon/shared';
import { formatCell } from '@/lib/format';

interface DataTableProps {
  readonly columns: readonly Column[];
  readonly rows: readonly Row[];
  /** Beyond this, the table scrolls rather than running down the page forever. */
  readonly maxRows?: number;
}

const isNumeric = (column: Column): boolean =>
  column.type === 'number' || column.type === 'currency' || column.type === 'percent';

/**
 * A ruled table. Rows divide on a hairline; figures are tabular and right
 * aligned so columns of numbers can be compared by eye.
 */
export function DataTable({ columns, rows, maxRows = 100 }: DataTableProps): JSX.Element {
  const shown = rows.slice(0, maxRows);

  return (
    // Focusable so the overflow can be scrolled without a pointer.
    <div
      tabIndex={0}
      role="group"
      aria-label="Result table, scrollable"
      className="overflow-x-auto focus-visible:outline focus-visible:outline-2 focus-visible:outline-salmon"
    >
      <table className="w-full border-collapse text-[13.5px]">
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={`border-b border-rule-hi px-3 pb-2 font-mono text-micro font-medium uppercase tracking-wide text-ink-low ${
                  isNumeric(column) ? 'text-right' : 'text-left'
                }`}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((row, index) => (
            <tr key={index} className="border-b border-rule last:border-b-0 hover:bg-paper-hi">
              {columns.map((column, columnIndex) => (
                <td
                  key={column.key}
                  className={
                    isNumeric(column)
                      ? 'px-3 py-[9px] text-right font-mono tabular-nums text-ink'
                      : columnIndex === 0
                        ? 'px-3 py-[9px] font-serif text-[15px] font-semibold text-ink'
                        : 'px-3 py-[9px] text-ink-mid'
                  }
                >
                  {formatCell(row[column.key] ?? null, column)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {rows.length > shown.length && (
        <p className="px-3 pt-3 font-mono text-micro text-ink-low">
          Showing {shown.length.toLocaleString('en-GB')} of {rows.length.toLocaleString('en-GB')}{' '}
          rows. Copy as CSV for the rest.
        </p>
      )}
    </div>
  );
}
