import { Toaster as Sonner, toast } from 'sonner';

/**
 * Confirms that a copy affordance actually did something.
 *
 * The design's mock had inert copy buttons; here they work, and a silent
 * success is indistinguishable from a broken button. Styled through Sonner's
 * class hooks because it renders its own DOM: square, ruled, flat.
 */
export function Toaster(): JSX.Element {
  return (
    <Sonner
      position="bottom-right"
      duration={2400}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            'flex w-full items-center gap-3 border border-rule-hi bg-bg-deep px-4 py-3 ' +
            'font-mono text-label text-ink',
          description: 'text-ink-mid',
          actionButton: 'text-salmon',
        },
      }}
    />
  );
}

export { toast };
