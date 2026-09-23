/**
 * Questions that are understood and still declined.
 *
 * "That question is outside what this service can answer" is true of everything
 * that misses the catalogue, which makes it useless: it tells the user nothing
 * they did not already know from not getting an answer. These topics come up
 * constantly against banking data, and each deserves to be turned down for a
 * stated reason rather than a shrug.
 *
 * This is curated rather than inferred, for the same reason the Question
 * Catalogue is: a refusal that reasons about the schema would be guessing, and
 * a confident guess is the failure mode this whole product exists to avoid.
 * Anything not recognised here still falls back to the general refusal.
 */
export interface DeclinedTopic {
  readonly id: string;
  /** Every group must contribute at least one term for the topic to match. */
  readonly requires: readonly (readonly string[])[];
  readonly reason: string;
}

export const DECLINED_TOPICS: readonly DeclinedTopic[] = [
  {
    id: 'forecast',
    requires: [
      [
        'likely', 'predict', 'prediction', 'forecast', 'forecasting', 'will they',
        'going to', 'next quarter', 'next year', 'next month', 'future', 'expected to',
        'probability', 'risk of', 'propensity',
      ],
      ['default', 'defaults', 'churn', 'attrition', 'arrears', 'miss', 'fail', 'leave', 'close'],
    ],
    reason:
      'The question asks for a forecast. Halcyon reports what is recorded, and the schema holds no arrears, defaults, repayments or credit scores to learn from. The nearest field is customers.risk_band, a static classification set at onboarding — using it as a predictor of future default would be wrong, so it has not been used.',
  },
  {
    id: 'prediction-general',
    requires: [
      ['predict', 'forecast', 'projection', 'project', 'extrapolate', 'estimate future', 'next quarter', 'next year'],
      ['volume', 'volumes', 'growth', 'revenue', 'applications', 'transactions', 'customers', 'value'],
    ],
    reason:
      'The question asks what will happen. Halcyon reports what is recorded across four tables and does not extrapolate; a projection drawn from one year of seeded history would carry an authority it has not earned.',
  },
  {
    id: 'causation',
    requires: [
      ['why', 'cause', 'caused', 'causes', 'reason for', 'driving', 'driver', 'drivers', 'explain why', 'because of'],
      [''],
    ],
    reason:
      'The question asks why something happened. The four tables record what happened and when, not why. Any cause offered from them would be a correlation presented as an explanation, which is worse than no answer.',
  },
  {
    id: 'outside-the-bank',
    requires: [
      ['competitor', 'competitors', 'market share', 'industry', 'benchmark', 'peer', 'peers', 'rivals', 'national average'],
      [''],
    ],
    reason:
      "The question reaches outside the bank's own records. Halcyon reads four connected tables and holds nothing about other institutions, the wider market, or any external benchmark.",
  },
  {
    id: 'staff',
    requires: [
      ['employee', 'employees', 'staff', 'headcount', 'salary', 'salaries', 'payroll', 'manager', 'teller', 'colleague'],
      [''],
    ],
    reason:
      'There is no staff or HR data in the connected schema. It holds customers, branches, onboarding applications and transactions — branches are places, not the people who work in them.',
  },
];

const matchesGroup = (asked: string, group: readonly string[]): boolean =>
  group.some((term) => term === '' || asked.includes(term));

/**
 * The stated reason this question is being declined, if it is a topic we
 * recognise. Null means the general refusal applies.
 */
export function declinedReason(question: string): string | null {
  const asked = question.toLowerCase();

  return (
    DECLINED_TOPICS.find((topic) => topic.requires.every((group) => matchesGroup(asked, group)))
      ?.reason ?? null
  );
}
