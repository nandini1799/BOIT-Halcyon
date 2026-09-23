import { describe, expect, it } from 'vitest';
import { cn } from './utils.js';

/**
 * These guard a failure mode with no symptom.
 *
 * When tailwind-merge does not know the theme, a size and a colour that are
 * both spelled `text-*` look like one property to it and the size is dropped.
 * Nothing throws, nothing warns; the type scale just quietly collapses to body
 * size. It is only visible by looking, which is not a test.
 */
describe('cn', () => {
  it('keeps a font size and a text colour together', () => {
    expect(cn('text-display', 'text-ink-mid')).toBe('text-display text-ink-mid');
    expect(cn('text-headline', 'text-salmon')).toBe('text-headline text-salmon');
    expect(cn('text-micro', 'text-ink-low')).toBe('text-micro text-ink-low');
  });

  it('still resolves genuine conflicts, last one winning', () => {
    expect(cn('text-body', 'text-headline')).toBe('text-headline');
    expect(cn('text-ink', 'text-salmon')).toBe('text-salmon');
    expect(cn('bg-paper', 'bg-paper-hi')).toBe('bg-paper-hi');
  });

  it('composes conditionally, like clsx', () => {
    expect(cn('border', false && 'hidden', undefined, 'border-rule')).toBe('border border-rule');
  });
});
