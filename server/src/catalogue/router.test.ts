import { describe, expect, it } from 'vitest';
import { route } from './router.js';

describe('the router', () => {
  it('routes a canonical question to its template', () => {
    const result = route('Show monthly onboarding applications by customer segment');

    expect(result.matched).toBe(true);
    expect(result.matched && result.template.id).toBe('onboarding-by-month-segment');
  });

  it('does not answer a question it only half understands', () => {
    // Mentions onboarding and segment, but asks for a forecast, which we cannot do.
    expect(route('forecast onboarding applications by segment next quarter').matched).toBe(false);
  });

  it('offers the nearest templates when nothing matches, ranked by relevance', () => {
    const result = route('forecast next quarter onboarding applications');

    expect(result.matched).toBe(false);
    if (result.matched) return;

    expect(result.suggestions.length).toBeGreaterThan(0);
    // An onboarding question should suggest onboarding work, not transactions.
    expect(result.suggestions[0]?.tables).toContain('onboarding_applications');
  });
});
