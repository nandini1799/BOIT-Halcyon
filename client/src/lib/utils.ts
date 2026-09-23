import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * tailwind-merge has to be taught this theme.
 *
 * Its conflict resolution is name-based, and both a size and a colour are
 * spelled `text-*`. Left to guess, it reads `cn('text-display', 'text-ink-mid')`
 * as two competing values for one property and drops the first — so the type
 * scale silently collapses to body size wherever a size and a colour meet.
 * Declaring both scales makes the two groups distinguishable.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        {
          text: [
            'micro',
            'label',
            'caption',
            'ui',
            'body',
            'prose',
            'ask',
            'headline',
            'display',
            'figure',
            'figure-lg',
          ],
        },
      ],
      'text-color': [
        {
          text: [
            'ink',
            'ink-mid',
            'ink-low',
            'salmon',
            'salmon-deep',
            'sage',
            'slate',
            'gold',
            'danger',
            'bg',
            'bg-deep',
            'paper',
            'paper-hi',
            'rule',
            'rule-hi',
          ],
        },
      ],
    },
  },
});

/** The shadcn class helper: compose conditionally, then resolve Tailwind conflicts. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
