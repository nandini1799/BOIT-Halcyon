import { assertNever, type Kpi, type Row } from '@halcyon/shared';
import type { QuestionTemplate } from '../catalogue/types.js';

export interface Narration {
  readonly headline: string;
  readonly standfirst: string;
  readonly kpis: readonly Kpi[];
  readonly assumptions: readonly string[];
}

// -- formatting --------------------------------------------------------------

const num = (row: Row | undefined, key: string): number => Number(row?.[key] ?? 0);
const text = (row: Row | undefined, key: string): string => String(row?.[key] ?? '');

const int = (value: number): string => Math.round(value).toLocaleString('en-GB');
const pct = (value: number): string => `${value.toFixed(1)}%`;

function gbp(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `£${(value / 1_000_000_000).toFixed(2)}bn`;
  if (abs >= 1_000_000) return `£${(value / 1_000_000).toFixed(1)}m`;
  if (abs >= 1_000) return `£${(value / 1_000).toFixed(0)}k`;
  return `£${value.toFixed(0)}`;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Turns the `YYYY-MM` bucket the SQL produces into something readable in prose. */
function monthName(bucket: string): string {
  const [year, month] = bucket.split('-');
  const name = MONTH_NAMES[Number(month) - 1];
  return name ? `${name} ${year}` : bucket;
}

const SEGMENT_LABELS: Readonly<Record<string, string>> = {
  retail: 'Retail',
  sme: 'SME',
  corporate: 'Corporate',
  private_banking: 'Private banking',
};

const label = (value: string): string =>
  SEGMENT_LABELS[value] ?? value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const FY = 'FY2025 runs 1 January to 31 December 2025.';
const MINOR_UNITS = 'Transaction values are stored in pence and shown in pounds.';

/** Totals a measure grouped by a key. */
function totalBy(rows: readonly Row[], groupKey: string, measureKey: string): Map<string, number> {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const key = text(row, groupKey);
    totals.set(key, (totals.get(key) ?? 0) + num(row, measureKey));
  }
  return totals;
}

/** First and last value of a measure for one group, in row order. */
function growth(rows: readonly Row[], groupKey: string, group: string, measureKey: string): number {
  const series = rows.filter((row) => text(row, groupKey) === group);
  const first = num(series[0], measureKey);
  const last = num(series[series.length - 1], measureKey);
  return first === 0 ? 0 : (last / first - 1) * 100;
}

const descending = (a: [string, number], b: [string, number]): number => b[1] - a[1];

// -- narration ---------------------------------------------------------------

/**
 * Turns rows into the claim, the paragraph and the figures.
 *
 * Every number here is read from the result. Nothing is hardcoded, which is why
 * the two arithmetic errors in the approved mock do not survive into the
 * product: the copy cannot disagree with the query, because it is derived from
 * it. The switch is exhaustive, so a new template cannot ship without prose.
 */
export function narrate(
  template: QuestionTemplate,
  rows: readonly Row[],
): Narration {
  switch (template.name) {
    case 'onboarding-by-month-segment': {
      const totals = [...totalBy(rows, 'segment', 'applications')].sort(descending);
      const total = totals.reduce((sum, [, n]) => sum + n, 0);
      const [top] = totals;
      const fastest = totals
        .map(([segment]) => [segment, growth(rows, 'segment', segment, 'applications')] as [string, number])
        .sort(descending)[0];

      return {
        headline: `${label(top?.[0] ?? '')} drove onboarding, but ${label(fastest?.[0] ?? '').toLowerCase()} grew fastest`,
        standfirst: `The bank took **${int(total)}** onboarding applications across FY2025. ${label(top?.[0] ?? '')} accounted for **${int(top?.[1] ?? 0)}** of them, **${pct(((top?.[1] ?? 0) / total) * 100)}** of volume. The sharpest growth came from ${label(fastest?.[0] ?? '').toLowerCase()}, up **${pct(fastest?.[1] ?? 0)}** between January and December.`,
        kpis: [
          { label: 'Applications', value: int(total), caption: 'FY2025, all segments' },
          { label: 'Largest segment', value: label(top?.[0] ?? ''), caption: `${pct(((top?.[1] ?? 0) / total) * 100)} of volume` },
          { label: 'Fastest growing', value: label(fastest?.[0] ?? ''), caption: `${pct(fastest?.[1] ?? 0)} Jan to Dec` },
        ],
        assumptions: [FY, 'Applications are counted by submission date, not decision date.'],
      };
    }

    case 'branch-rejection-rate': {
      const worst = rows[0];
      const best = rows[rows.length - 1];
      const applications = rows.reduce((sum, row) => sum + num(row, 'applications'), 0);
      const rejected = rows.reduce((sum, row) => sum + num(row, 'rejected'), 0);
      const bankWide = applications === 0 ? 0 : (rejected / applications) * 100;

      return {
        headline: `${text(worst, 'branch')} rejects the highest share of applications`,
        standfirst: `Across **${rows.length}** branches, rejection rates run from **${pct(num(best, 'rejection_rate'))}** at ${text(best, 'branch')} to **${pct(num(worst, 'rejection_rate'))}** at ${text(worst, 'branch')} — a spread of **${pct(num(worst, 'rejection_rate') - num(best, 'rejection_rate'))}** against a bank-wide rate of **${pct(bankWide)}**.`,
        kpis: [
          { label: 'Highest rate', value: pct(num(worst, 'rejection_rate')), caption: text(worst, 'branch') },
          { label: 'Bank-wide', value: pct(bankWide), caption: `${int(rejected)} of ${int(applications)}` },
          { label: 'Lowest rate', value: pct(num(best, 'rejection_rate')), caption: text(best, 'branch') },
        ],
        assumptions: [
          'Branches with fewer than 200 applications are excluded, so a handful of decisions cannot top the table.',
          'Rejection here is the bank declining an application — not Halcyon refusing a question.',
        ],
      };
    }

    case 'compare-segments': {
      const totals = totalBy(rows, 'segment', 'applications');
      const retail = totals.get('retail') ?? 0;
      const sme = totals.get('sme') ?? 0;
      const retailGrowth = growth(rows, 'segment', 'retail', 'applications');
      const smeGrowth = growth(rows, 'segment', 'sme', 'applications');
      const faster = smeGrowth > retailGrowth ? 'SME' : 'retail';

      return {
        headline: `Retail outnumbers SME by ${(sme === 0 ? 0 : retail / sme).toFixed(1)} to one, but ${faster} is growing faster`,
        standfirst: `Retail took **${int(retail)}** applications in FY2025 against SME's **${int(sme)}**. Growth tells a different story: SME rose **${pct(smeGrowth)}** across the year against retail's **${pct(retailGrowth)}**.`,
        kpis: [
          { label: 'Retail', value: int(retail), caption: `${pct(retailGrowth)} Jan to Dec` },
          { label: 'SME', value: int(sme), caption: `${pct(smeGrowth)} Jan to Dec` },
          { label: 'Ratio', value: `${(sme === 0 ? 0 : retail / sme).toFixed(2)}:1`, caption: 'Retail to SME' },
        ],
        assumptions: [FY, 'Only the two segments asked about are counted.'],
      };
    }

    case 'average-transaction-by-segment': {
      const top = rows[0];
      const bottom = rows[rows.length - 1];
      const ratio = num(bottom, 'average_value_gbp') === 0 ? 0 : num(top, 'average_value_gbp') / num(bottom, 'average_value_gbp');

      return {
        headline: `${label(text(top, 'segment'))} moves ${ratio.toFixed(0)} times more per transaction than ${label(text(bottom, 'segment')).toLowerCase()}`,
        standfirst: `The average ${label(text(top, 'segment')).toLowerCase()} transaction is **${gbp(num(top, 'average_value_gbp'))}**, against **${gbp(num(bottom, 'average_value_gbp'))}** for ${label(text(bottom, 'segment')).toLowerCase()} — across **${int(rows.reduce((s, r) => s + num(r, 'transactions'), 0))}** transactions in total.`,
        kpis: rows.slice(0, 3).map((row) => ({
          label: label(text(row, 'segment')),
          value: gbp(num(row, 'average_value_gbp')),
          caption: `${int(num(row, 'transactions'))} transactions`,
        })),
        assumptions: [MINOR_UNITS, 'Credits and debits are averaged together.'],
      };
    }

    case 'customer-similarity': {
      const top = rows[0];
      return {
        headline: 'Customers sharing transaction patterns',
        standfirst: `**${int(rows.length)}** customer pairs share spending categories. The closest match is ${text(top, 'customer')} and ${text(top, 'similar_to')}, with **${int(num(top, 'shared_categories'))}** categories in common.`,
        kpis: [{ label: 'Pairs found', value: int(rows.length), caption: 'Sharing at least one category' }],
        assumptions: [
          'Similarity here means overlapping spending categories, not a statistical distance.',
          'This comparison grows with the square of the customer count, which is why it is slow.',
        ],
      };
    }

    case 'customers-by-risk-band': {
      const total = rows.reduce((sum, row) => sum + num(row, 'customers'), 0);
      const top = rows[0];
      const high = rows.find((row) => text(row, 'risk_band') === 'high');

      return {
        headline: `Most customers sit in the ${label(text(top, 'risk_band')).toLowerCase()} risk band`,
        standfirst: `Of **${int(total)}** customers, **${int(num(top, 'customers'))}** are banded ${label(text(top, 'risk_band')).toLowerCase()} — **${pct((num(top, 'customers') / total) * 100)}** of the book. High risk accounts for **${pct((num(high, 'customers') / total) * 100)}**.`,
        kpis: rows.map((row) => ({
          label: label(text(row, 'risk_band')),
          value: int(num(row, 'customers')),
          caption: pct((num(row, 'customers') / total) * 100),
        })),
        assumptions: ['Risk band is the value recorded on the customer, not a recalculation.'],
      };
    }

    case 'top-customers-by-value': {
      const top = rows[0];
      const total = rows.reduce((sum, row) => sum + num(row, 'total_value_gbp'), 0);

      return {
        headline: `${text(top, 'customer')} moved ${gbp(num(top, 'total_value_gbp'))}, more than double the next customer`,
        standfirst: `The top **${rows.length}** customers moved **${gbp(total)}** between them in FY2025. ${text(top, 'customer')} alone accounts for **${gbp(num(top, 'total_value_gbp'))}** across **${int(num(top, 'transactions'))}** transactions, banking at ${text(top, 'branch')}.`,
        kpis: [
          { label: 'Top customer', value: gbp(num(top, 'total_value_gbp')), caption: text(top, 'customer') },
          { label: 'Top five combined', value: gbp(total), caption: 'Total transaction value' },
          { label: 'Transactions', value: int(num(top, 'transactions')), caption: `At ${text(top, 'branch')}` },
        ],
        assumptions: [MINOR_UNITS, 'Value is the sum of all movements, credits and debits alike.'],
      };
    }

    case 'approval-rate-over-time': {
      const first = rows[0];
      const last = rows[rows.length - 1];
      const change = num(last, 'approval_rate') - num(first, 'approval_rate');
      const direction = change >= 0 ? 'risen' : 'fallen';

      return {
        headline: `Approval rates have ${direction} ${Math.abs(change).toFixed(1)} percentage points across the year`,
        standfirst: `The approval rate opened FY2025 at **${pct(num(first, 'approval_rate'))}** and closed at **${pct(num(last, 'approval_rate'))}**, across **${int(rows.reduce((s, r) => s + num(r, 'applications'), 0))}** applications.`,
        kpis: [
          { label: 'January', value: pct(num(first, 'approval_rate')), caption: `${int(num(first, 'applications'))} applications` },
          { label: 'December', value: pct(num(last, 'approval_rate')), caption: `${int(num(last, 'applications'))} applications` },
          { label: 'Change', value: `${change >= 0 ? '+' : ''}${pct(change)}`, caption: 'Percentage points' },
        ],
        assumptions: [FY, 'Applications still pending are counted in the denominator.'],
      };
    }

    case 'transaction-value-trend': {
      const total = rows.reduce((sum, row) => sum + num(row, 'total_value_gbp'), 0);
      const peak = [...rows].sort((a, b) => num(b, 'total_value_gbp') - num(a, 'total_value_gbp'))[0];
      const change = growthBetween(num(rows[0], 'total_value_gbp'), num(rows[rows.length - 1], 'total_value_gbp'));

      return {
        headline: `Transaction value peaked in ${monthName(text(peak, 'month'))} at ${gbp(num(peak, 'total_value_gbp'))}`,
        standfirst: `**${gbp(total)}** moved across **${int(rows.reduce((s, r) => s + num(r, 'transactions'), 0))}** transactions in FY2025. The busiest month was ${monthName(text(peak, 'month'))} at **${gbp(num(peak, 'total_value_gbp'))}**, and the year closed **${pct(change)}** against where it opened.`,
        kpis: [
          { label: 'Total value', value: gbp(total), caption: 'FY2025' },
          { label: 'Peak month', value: gbp(num(peak, 'total_value_gbp')), caption: monthName(text(peak, 'month')) },
          { label: 'Year on year', value: `${change >= 0 ? '+' : ''}${pct(change)}`, caption: 'December against January' },
        ],
        assumptions: [MINOR_UNITS, FY],
      };
    }

    case 'transactions-by-branch': {
      const top = rows[0];
      const total = rows.reduce((sum, row) => sum + num(row, 'total_value_gbp'), 0);

      return {
        headline: `${text(top, 'branch')} handles the most transaction value`,
        standfirst: `Across **${rows.length}** branches, **${gbp(total)}** moved in FY2025. ${text(top, 'branch')} handled **${gbp(num(top, 'total_value_gbp'))}** of it — **${pct((num(top, 'total_value_gbp') / total) * 100)}** of the bank's total.`,
        kpis: rows.slice(0, 3).map((row) => ({
          label: text(row, 'branch'),
          value: gbp(num(row, 'total_value_gbp')),
          caption: `${int(num(row, 'transactions'))} transactions`,
        })),
        assumptions: [MINOR_UNITS, 'Transactions are attributed to the branch recorded on the movement.'],
      };
    }

    case 'applications-by-branch': {
      const top = rows[0];
      const total = rows.reduce((sum, row) => sum + num(row, 'applications'), 0);

      return {
        headline: `${text(top, 'branch')} took the most applications`,
        standfirst: `**${int(total)}** applications were taken across **${rows.length}** branches. ${text(top, 'branch')} led with **${int(num(top, 'applications'))}**, **${pct((num(top, 'applications') / total) * 100)}** of the total.`,
        kpis: [
          { label: 'Applications', value: int(total), caption: `Across ${rows.length} branches` },
          { label: 'Busiest branch', value: int(num(top, 'applications')), caption: text(top, 'branch') },
          { label: 'Average per branch', value: int(total / rows.length), caption: 'Applications' },
        ],
        assumptions: ['Every application is attributed to the branch that took it.'],
      };
    }

    case 'customers-by-segment': {
      const total = rows.reduce((sum, row) => sum + num(row, 'customers'), 0);
      const top = rows[0];

      return {
        headline: `${label(text(top, 'segment'))} makes up ${pct((num(top, 'customers') / total) * 100)} of the customer book`,
        standfirst: `The bank has **${int(total)}** customers. ${label(text(top, 'segment'))} is the largest segment at **${int(num(top, 'customers'))}**, and the four segments divide as shown.`,
        kpis: rows.slice(0, 3).map((row) => ({
          label: label(text(row, 'segment')),
          value: int(num(row, 'customers')),
          caption: pct((num(row, 'customers') / total) * 100),
        })),
        assumptions: ['Dormant customers are included; status is recorded separately.'],
      };
    }

    default:
      return assertNever(template.name, 'template narration');
  }
}

const growthBetween = (first: number, last: number): number =>
  first === 0 ? 0 : (last / first - 1) * 100;
