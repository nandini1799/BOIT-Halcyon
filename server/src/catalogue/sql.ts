import type { CellValue } from '@halcyon/shared';
import type { QuestionTemplate, TemplateName } from './types.js';

export interface SqlPlan {
  readonly text: string;
  readonly parameters: readonly CellValue[];
}

/**
 * The SQL behind each question.
 *
 * Every value is bound, including the ones no user ever supplies — the `month`
 * argument to `date_trunc`, the output format for `to_char`, the financial year
 * boundaries. That is a consequence of the Guard forbidding string literals
 * outright (see the spec's deviations): the rule is only absolute if it has no
 * exceptions, and an absolute rule is one that cannot be reasoned around.
 * Numeric literals remain legal, so `GROUP BY 1` and `LIMIT 5` are untouched.
 */

const MONTH = 'month';
const MONTH_FORMAT = 'YYYY-MM';
const FY_START = '2025-01-01';
const FY_END = '2026-01-01';

const PLANS: Readonly<Record<TemplateName, SqlPlan>> = {
  'onboarding-by-month-segment': {
    text: `SELECT to_char(date_trunc(CAST($1 AS text), submitted_at), CAST($2 AS text)) AS month,
       segment::text AS segment,
       count(*)::int AS applications
  FROM onboarding_applications
 WHERE submitted_at >= CAST($3 AS timestamptz) AND submitted_at < CAST($4 AS timestamptz)
 GROUP BY 1, 2
 ORDER BY 1, 2`,
    parameters: [MONTH, MONTH_FORMAT, FY_START, FY_END],
  },

  'branch-rejection-rate': {
    text: `SELECT b.name AS branch,
       count(*)::int AS applications,
       sum(CASE WHEN a.decision::text = CAST($1 AS text) THEN 1 ELSE 0 END)::int AS rejected,
       round(100.0 * sum(CASE WHEN a.decision::text = CAST($1 AS text) THEN 1 ELSE 0 END) / count(*), 1)::float8 AS rejection_rate
  FROM onboarding_applications a
  JOIN branches b ON b.id = a.branch_id
 GROUP BY 1
HAVING count(*) >= 200
 ORDER BY 4 DESC`,
    parameters: ['rejected'],
  },

  'compare-segments': {
    text: `SELECT to_char(date_trunc(CAST($1 AS text), submitted_at), CAST($2 AS text)) AS month,
       segment::text AS segment,
       count(*)::int AS applications
  FROM onboarding_applications
 WHERE segment::text IN (CAST($3 AS text), CAST($4 AS text))
   AND submitted_at >= CAST($5 AS timestamptz) AND submitted_at < CAST($6 AS timestamptz)
 GROUP BY 1, 2
 ORDER BY 1, 2`,
    parameters: [MONTH, MONTH_FORMAT, 'retail', 'sme', FY_START, FY_END],
  },

  'average-transaction-by-segment': {
    text: `SELECT c.segment::text AS segment,
       round(avg(t.amount_minor) / 100.0, 2)::float8 AS average_value_gbp,
       count(*)::int AS transactions
  FROM transactions t
  JOIN customers c ON c.id = t.customer_id
 GROUP BY 1
 ORDER BY 2 DESC`,
    parameters: [],
  },

  // Deliberately expensive: every customer profile against every other. This is
  // the honest timeout — a real question whose cost the planner cannot avoid.
  'customer-similarity': {
    text: `WITH profile AS (
         SELECT t.customer_id, t.category, sum(t.amount_minor) AS total
           FROM transactions t
          GROUP BY 1, 2
       )
SELECT c1.name AS customer,
       c2.name AS similar_to,
       count(*)::int AS shared_categories
  FROM profile a
  JOIN profile b ON a.category = b.category AND a.customer_id < b.customer_id
  JOIN customers c1 ON c1.id = a.customer_id
  JOIN customers c2 ON c2.id = b.customer_id
 GROUP BY 1, 2
 ORDER BY 3 DESC`,
    parameters: [],
  },

  'customers-by-risk-band': {
    text: `SELECT risk_band::text AS risk_band,
       count(*)::int AS customers
  FROM customers
 GROUP BY 1
 ORDER BY 2 DESC`,
    parameters: [],
  },

  'top-customers-by-value': {
    text: `SELECT c.name AS customer,
       c.segment::text AS segment,
       b.name AS branch,
       count(*)::int AS transactions,
       round(sum(t.amount_minor) / 100.0, 2)::float8 AS total_value_gbp
  FROM transactions t
  JOIN customers c ON c.id = t.customer_id
  JOIN branches b ON b.id = c.branch_id
 GROUP BY 1, 2, 3
 ORDER BY 5 DESC
 LIMIT 5`,
    parameters: [],
  },

  'approval-rate-over-time': {
    text: `SELECT to_char(date_trunc(CAST($1 AS text), submitted_at), CAST($2 AS text)) AS month,
       round(100.0 * sum(CASE WHEN decision::text = CAST($3 AS text) THEN 1 ELSE 0 END) / count(*), 1)::float8 AS approval_rate,
       count(*)::int AS applications
  FROM onboarding_applications
 WHERE submitted_at >= CAST($4 AS timestamptz) AND submitted_at < CAST($5 AS timestamptz)
 GROUP BY 1
 ORDER BY 1`,
    parameters: [MONTH, MONTH_FORMAT, 'approved', FY_START, FY_END],
  },

  'transaction-value-trend': {
    text: `SELECT to_char(date_trunc(CAST($1 AS text), occurred_at), CAST($2 AS text)) AS month,
       round(sum(amount_minor) / 100.0, 2)::float8 AS total_value_gbp,
       count(*)::int AS transactions
  FROM transactions
 WHERE occurred_at >= CAST($3 AS timestamptz) AND occurred_at < CAST($4 AS timestamptz)
 GROUP BY 1
 ORDER BY 1`,
    parameters: [MONTH, MONTH_FORMAT, FY_START, FY_END],
  },

  'transactions-by-branch': {
    text: `SELECT b.name AS branch,
       round(sum(t.amount_minor) / 100.0, 2)::float8 AS total_value_gbp,
       count(*)::int AS transactions
  FROM transactions t
  JOIN branches b ON b.id = t.branch_id
 GROUP BY 1
 ORDER BY 2 DESC`,
    parameters: [],
  },

  'applications-by-branch': {
    text: `SELECT b.name AS branch,
       b.region AS region,
       count(*)::int AS applications
  FROM onboarding_applications a
  JOIN branches b ON b.id = a.branch_id
 GROUP BY 1, 2
 ORDER BY 3 DESC`,
    parameters: [],
  },

  'customers-by-segment': {
    text: `SELECT segment::text AS segment,
       count(*)::int AS customers
  FROM customers
 GROUP BY 1
 ORDER BY 2 DESC`,
    parameters: [],
  },
};

export function buildSql(template: QuestionTemplate): SqlPlan {
  return PLANS[template.name];
}
