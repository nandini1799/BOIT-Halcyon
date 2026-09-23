import { ChartColumn, Table2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type FigureView = 'chart' | 'table';

interface ViewToggleProps {
  readonly view: FigureView;
  readonly onChange: (view: FigureView) => void;
  /** The region the pair controls, so the change is announced against it. */
  readonly controls: string;
}

const OPTIONS: readonly { view: FigureView; label: string; Icon: typeof ChartColumn }[] = [
  { view: 'chart', label: 'Show as chart', Icon: ChartColumn },
  { view: 'table', label: 'Show as table', Icon: Table2 },
];

/**
 * Chart or figures, one at a time.
 *
 * Two pressed-state buttons rather than tabs: there is one panel and two ways
 * of drawing it, which is what `aria-pressed` describes. The table is the only
 * place a grouped chart's numbers are readable, so the control carries text
 * labels for screen readers even though it shows icons.
 */
export function ViewToggle({ view, onChange, controls }: ViewToggleProps): JSX.Element {
  return (
    <div role="group" aria-label="Show this figure as" className="flex border border-rule">
      {OPTIONS.map(({ view: option, label, Icon }, index) => (
        <button
          key={option}
          type="button"
          aria-label={label}
          aria-pressed={view === option}
          aria-controls={controls}
          onClick={() => onChange(option)}
          className={cn(
            'p-[7px] transition-colors',
            index > 0 && 'border-l border-rule',
            view === option
              ? 'bg-salmon text-bg-deep'
              : 'text-ink-low hover:bg-paper-hi hover:text-ink-mid',
          )}
        >
          <Icon className="size-[15px]" aria-hidden />
        </button>
      ))}
    </div>
  );
}
