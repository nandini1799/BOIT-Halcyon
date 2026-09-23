import { forwardRef, type HTMLAttributes, type TdHTMLAttributes, type ThHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/**
 * A ruled table, in the printed-ledger sense.
 *
 * Rows divide on a hairline and never on a fill, so a long result reads as a
 * ledger rather than a zebra-striped grid. Numeric cells take `numeric`, which
 * makes them tabular and right-aligned — the design's strongest signature, and
 * the thing that makes columns of figures comparable at a glance.
 */
export const Table = forwardRef<HTMLTableElement, HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <div className="w-full overflow-x-auto">
      <table ref={ref} className={cn('w-full border-collapse text-ui', className)} {...props} />
    </div>
  ),
);
Table.displayName = 'Table';

export const TableHeader = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <thead ref={ref} className={cn('border-b border-rule-hi', className)} {...props} />
  ),
);
TableHeader.displayName = 'TableHeader';

export const TableBody = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => <tbody ref={ref} className={cn(className)} {...props} />,
);
TableBody.displayName = 'TableBody';

export const TableRow = forwardRef<HTMLTableRowElement, HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn('border-b border-rule transition-colors hover:bg-paper-hi', className)}
      {...props}
    />
  ),
);
TableRow.displayName = 'TableRow';

interface CellProps {
  /** Tabular figures, right-aligned. Every number in this product is both. */
  readonly numeric?: boolean;
}

export const TableHead = forwardRef<
  HTMLTableCellElement,
  ThHTMLAttributes<HTMLTableCellElement> & CellProps
>(({ className, numeric = false, ...props }, ref) => (
  <th
    ref={ref}
    scope="col"
    className={cn(
      'px-3 py-2 font-mono text-micro font-normal uppercase tracking-wider text-ink-low',
      numeric ? 'text-right' : 'text-left',
      className,
    )}
    {...props}
  />
));
TableHead.displayName = 'TableHead';

export const TableCell = forwardRef<
  HTMLTableCellElement,
  TdHTMLAttributes<HTMLTableCellElement> & CellProps
>(({ className, numeric = false, ...props }, ref) => (
  <td
    ref={ref}
    className={cn(
      'px-3 py-2 text-ink-mid',
      numeric ? 'text-right font-mono tabular-nums text-ink' : 'text-left',
      className,
    )}
    {...props}
  />
));
TableCell.displayName = 'TableCell';

export const TableCaption = forwardRef<
  HTMLTableCaptionElement,
  HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn('caption-bottom pt-3 text-left font-mono text-micro text-ink-low', className)}
    {...props}
  />
));
TableCaption.displayName = 'TableCaption';
