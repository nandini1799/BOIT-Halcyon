import type { Form, TemplateId } from '@halcyon/shared';
import type { DataTable } from '../db/schema.js';

/**
 * One answerable question.
 *
 * Matching is by synonym group rather than by whole-phrase similarity: each
 * group in `requires` is a set of ways of saying the same thing, and a question
 * matches only if it says something from every group. "Monthly onboarding by
 * segment" and "how many applications did we take each month per segment" both
 * satisfy the same three groups, while "how many customers per segment" does
 * not, because nothing in it means "monthly".
 *
 * This is deliberately explainable: the UI can name the terms it matched on,
 * which a similarity score could not.
 */
/**
 * Template names as a literal union rather than free strings, so the SQL and
 * narration maps are checked at compile time. Adding a template here breaks the
 * build until it has SQL and prose — which is the point.
 */
export const TEMPLATE_NAMES = [
  'onboarding-by-month-segment',
  'branch-rejection-rate',
  'compare-segments',
  'average-transaction-by-segment',
  'customer-similarity',
  'customers-by-risk-band',
  'top-customers-by-value',
  'approval-rate-over-time',
  'transaction-value-trend',
  'transactions-by-branch',
  'applications-by-branch',
  'customers-by-segment',
] as const;

export type TemplateName = (typeof TEMPLATE_NAMES)[number];

export interface QuestionTemplate {
  readonly id: TemplateId;
  readonly name: TemplateName;
  /** The chart's title. A question mark makes a poor figure heading. */
  readonly figureTitle: string;
  /**
   * Which column the chart should plot, where the result has several numbers.
   *
   * "Which branches have the highest rejection rate" returns applications,
   * rejections and a rate. Taking the first numeric column would draw a chart
   * of application volume beneath a headline about rates — every bar correctly
   * labelled, and the whole figure answering a different question.
   */
  readonly measure?: string;
  readonly canonical: string;
  readonly form: Form;
  readonly tables: readonly DataTable[];
  readonly requires: readonly (readonly string[])[];
  /** Phrasings that must resolve here. Exercised by the evaluation harness. */
  readonly examples: readonly string[];
  readonly related: readonly TemplateId[];
}
