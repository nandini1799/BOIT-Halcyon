import { describe, expect, it } from 'vitest';
import { declinedReason } from './declined.js';
import { route } from './router.js';
import { TEMPLATES } from './templates.js';

describe('declined topics', () => {
  it.each([
    ['Which customers are likely to default next quarter?', /risk_band/],
    ['Predict transaction volume for next year', /does not extrapolate/],
    ['Why did applications fall in March?', /correlation presented as an explanation/],
    ['How do we compare to competitors on onboarding?', /outside the bank/],
    ['How many staff work at each branch?', /no staff or HR data/],
  ])('gives %s a stated reason', (question, expected) => {
    expect(declinedReason(question)).toMatch(expected);
  });

  it('falls back to the general refusal for anything unrecognised', () => {
    expect(declinedReason('what is the weather in Leeds')).toBeNull();
  });

  /*
   * The real hazard of matching on keywords. These topics are only consulted
   * once routing has failed, but a term like "fail" or "close" appearing in a
   * question the catalogue *can* answer must never stop it being answered.
   */
  it.each(TEMPLATES.flatMap((template) => [template.canonical, ...template.examples]))(
    'does not intercept an answerable question: %s',
    (question) => {
      expect(route(question).matched).toBe(true);
    },
  );

  it('declines a forecast only when it is asking about an event, not a past count', () => {
    // "Default" alone is a word; a forecast needs the forward-looking half too.
    expect(declinedReason('how many customers defaulted')).toBeNull();
    expect(declinedReason('which customers are likely to default')).not.toBeNull();
  });
});
