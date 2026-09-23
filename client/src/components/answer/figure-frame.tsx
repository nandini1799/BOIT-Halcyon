import type { ReactNode } from 'react';

interface FigureFrameProps {
  readonly heading: string;
  readonly subheading: string;
  readonly source: string;
  readonly children: ReactNode;
  readonly flush?: boolean;
  /** Controls that belong to the figure, set against its caption. */
  readonly action?: ReactNode;
}

/**
 * The frame every chart and table sits in.
 *
 * The source line is part of the frame rather than something a caller may
 * remember to add, because a chart without a source is an assertion. There is
 * no way to render a figure here without one.
 */
export function FigureFrame({
  heading,
  subheading,
  source,
  children,
  flush = false,
  action,
}: FigureFrameProps): JSX.Element {
  return (
    <figure className="mb-6">
      <figcaption className="flex items-start justify-between gap-4">
        <div>
          <div className="font-serif text-[16px] font-semibold text-ink">{heading}</div>
          <div className="mb-3 font-mono text-micro text-ink-low">{subheading}</div>
        </div>
        {action !== undefined && <div className="shrink-0">{action}</div>}
      </figcaption>

      <div className={flush ? 'border border-rule bg-paper px-1 pb-2 pt-3.5' : 'border border-rule bg-paper px-3 pb-2 pt-4'}>
        {children}
        <div
          className={`mt-[9px] flex justify-between gap-4 font-mono text-micro text-ink-low ${flush ? 'mx-2.5' : ''}`}
        >
          <span>Source: {source}</span>
          <span>Halcyon</span>
        </div>
      </div>
    </figure>
  );
}
