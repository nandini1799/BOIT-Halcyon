import { asTemplateId } from '@halcyon/shared';
import type { QuestionTemplate } from './types.js';

const id = asTemplateId;

/**
 * The twelve questions Halcyon can answer.
 *
 * Order is significant. Some questions legitimately satisfy more than one
 * template — "which branch rejects the most applications" is both a question
 * about branches and a question about applications — and where two templates
 * match equally well the earlier one wins. The list therefore runs from most
 * specific to most general.
 */
export const TEMPLATES: readonly QuestionTemplate[] = [
  {
    id: id('onboarding-by-month-segment'),
    name: 'onboarding-by-month-segment',
    figureTitle: 'Applications by month and segment',
    canonical: 'Show monthly onboarding applications by customer segment',
    form: 'bar',
    tables: ['onboarding_applications'],
    requires: [
      ['onboarding', 'application', 'applications', 'applied', 'signups', 'sign-ups'],
      ['month', 'monthly', 'by month', 'each month', 'per month', 'over the year'],
      ['segment', 'segments', 'customer type'],
    ],
    examples: [
      'How many applications did we take each month per segment?',
      'monthly signups by segment',
      'onboarding applications by month and segment',
    ],
    related: [id('compare-segments'), id('approval-rate-over-time'), id('applications-by-branch')],
  },
  {
    id: id('branch-rejection-rate'),
    name: 'branch-rejection-rate',
    figureTitle: 'Rejection rate by branch',
    measure: 'rejection_rate',
    canonical: 'Which branches have the highest rejection rate?',
    form: 'bar',
    tables: ['onboarding_applications', 'branches'],
    requires: [
      ['rejection', 'rejections', 'rejected', 'rejects', 'declined', 'declines', 'turned down'],
      ['branch', 'branches'],
    ],
    examples: [
      'which branch rejects the most applications',
      'rejection rate by branch',
      'show me declined applications by branch',
    ],
    related: [id('applications-by-branch'), id('approval-rate-over-time')],
  },
  {
    id: id('compare-segments'),
    name: 'compare-segments',
    figureTitle: 'Retail against SME, by month',
    canonical: 'Compare retail and SME onboarding volumes',
    form: 'bar',
    tables: ['onboarding_applications'],
    requires: [
      ['compare', 'compared', 'comparison', 'versus', 'vs', 'against', 'head to head'],
      ['retail'],
      ['sme', 'small business'],
    ],
    examples: ['retail vs sme', 'how does retail compare to sme', 'compare retail against sme onboarding'],
    related: [id('onboarding-by-month-segment'), id('customers-by-segment')],
  },
  {
    id: id('average-transaction-by-segment'),
    name: 'average-transaction-by-segment',
    figureTitle: 'Average transaction value by segment',
    measure: 'average_value_gbp',
    canonical: 'What is the average transaction value by segment?',
    form: 'bar',
    tables: ['transactions', 'customers'],
    requires: [
      ['average', 'avg', 'mean', 'typical'],
      ['transaction', 'transactions', 'spend', 'value'],
      ['segment', 'segments', 'customer type'],
    ],
    examples: ['average spend per segment', 'mean transaction value by segment', 'typical transaction value by segment'],
    related: [id('customers-by-segment'), id('transaction-value-trend')],
  },
  {
    id: id('customer-similarity'),
    name: 'customer-similarity',
    figureTitle: 'Customers sharing spending categories',
    canonical: 'Which customers have similar transaction patterns?',
    form: 'table',
    tables: ['transactions', 'customers'],
    requires: [
      ['similar', 'similarity', 'alike', 'comparable', 'same pattern'],
      ['customer', 'customers'],
    ],
    examples: ['find customers with similar spending', 'which customers behave alike', 'customers with comparable transaction patterns'],
    related: [id('top-customers-by-value'), id('average-transaction-by-segment')],
  },
  {
    id: id('customers-by-risk-band'),
    name: 'customers-by-risk-band',
    figureTitle: 'Customers by risk band',
    measure: 'customers',
    canonical: 'How are customers distributed across risk bands?',
    form: 'bar',
    tables: ['customers'],
    requires: [
      ['risk', 'risk band', 'risk bands'],
      ['customer', 'customers'],
    ],
    examples: ['customers by risk band', 'customer risk band breakdown', 'how many customers are high risk'],
    related: [id('customers-by-segment')],
  },
  {
    id: id('top-customers-by-value'),
    name: 'top-customers-by-value',
    figureTitle: 'Top customers by transaction value',
    measure: 'total_value_gbp',
    canonical: 'Show the top five customers by transaction value',
    form: 'table',
    tables: ['transactions', 'customers', 'branches'],
    requires: [
      ['top', 'highest', 'largest', 'biggest', 'most valuable'],
      ['customer', 'customers'],
    ],
    examples: ['who are our biggest customers', 'top customers by transaction value', 'largest customers by value'],
    related: [id('transaction-value-trend'), id('transactions-by-branch')],
  },
  {
    id: id('approval-rate-over-time'),
    name: 'approval-rate-over-time',
    figureTitle: 'Approval rate by month',
    measure: 'approval_rate',
    canonical: 'How has the approval rate changed over time?',
    form: 'line',
    tables: ['onboarding_applications'],
    requires: [
      ['approval', 'approvals', 'approved', 'approve'],
      ['over time', 'trend', 'by month', 'monthly', 'each month', 'over the year', 'changed'],
    ],
    examples: ['approval rate trend', 'monthly approval rate', 'has the approval rate changed'],
    related: [id('branch-rejection-rate'), id('onboarding-by-month-segment')],
  },
  {
    id: id('transaction-value-trend'),
    name: 'transaction-value-trend',
    figureTitle: 'Transaction value by month',
    measure: 'total_value_gbp',
    canonical: 'How has transaction value moved over the year?',
    form: 'line',
    tables: ['transactions'],
    requires: [
      ['transaction', 'transactions', 'spend', 'money'],
      ['over time', 'trend', 'by month', 'monthly', 'each month', 'over the year', 'moved'],
    ],
    examples: ['transaction value trend', 'monthly transaction value', 'how has spend moved over the year'],
    related: [id('top-customers-by-value'), id('transactions-by-branch')],
  },
  {
    id: id('transactions-by-branch'),
    name: 'transactions-by-branch',
    figureTitle: 'Transaction value by branch',
    measure: 'total_value_gbp',
    canonical: 'Which branches handle the most transaction value?',
    form: 'bar',
    tables: ['transactions', 'branches'],
    requires: [
      ['transaction', 'transactions', 'spend', 'value', 'money'],
      ['branch', 'branches'],
    ],
    examples: ['transaction value by branch', 'which branch moves the most money', 'busiest branches by value'],
    related: [id('applications-by-branch'), id('top-customers-by-value')],
  },
  {
    id: id('applications-by-branch'),
    name: 'applications-by-branch',
    figureTitle: 'Applications by branch',
    measure: 'applications',
    canonical: 'How many applications has each branch taken?',
    form: 'table',
    tables: ['onboarding_applications', 'branches'],
    requires: [
      ['application', 'applications', 'onboarding', 'applied'],
      ['branch', 'branches'],
    ],
    examples: ['applications by branch', 'application volume per branch', 'how many applications did each branch take'],
    related: [id('branch-rejection-rate'), id('onboarding-by-month-segment')],
  },
  {
    id: id('customers-by-segment'),
    name: 'customers-by-segment',
    figureTitle: 'Customers by segment',
    measure: 'customers',
    canonical: 'How many customers do we have in each segment?',
    form: 'bar',
    tables: ['customers'],
    requires: [
      ['how many', 'number of', 'count', 'distribution', 'breakdown'],
      ['customer', 'customers'],
      ['segment', 'segments', 'customer type'],
    ],
    examples: ['customer count by segment', 'breakdown of customers by segment', 'number of customers in each segment'],
    related: [id('customers-by-risk-band'), id('compare-segments')],
  },
];
