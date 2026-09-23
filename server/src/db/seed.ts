import pg from 'pg';
import { from as copyFrom } from 'pg-copy-streams';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { SEED_SCALES, config, connectionUrls } from '../lib/config.js';
import {
  BRANCHES,
  CHANNELS,
  FY_START,
  MONTHLY_SHAPE,
  REJECTION_REASONS,
  RISK_MIX,
  SEGMENT_MIX,
  SEGMENT_REJECTION_BIAS,
  TX_CATEGORIES,
  TX_SIZE_BY_SEGMENT,
  createRandom,
  customerName,
  weightedPick,
  type Random,
  type Segment,
} from './seed-data.js';

const { Client } = pg;

/** COPY text format: tabs, newlines and backslashes must be escaped; null is \N. */
function cell(value: string | number | null): string {
  if (value === null) return '\\N';
  if (typeof value === 'number') return String(value);
  return value.replace(/\\/g, '\\\\').replace(/\t/g, '\\t').replace(/\n/g, '\\n').replace(/\r/g, '\\r');
}

const line = (...values: (string | number | null)[]): string =>
  `${values.map(cell).join('\t')}\n`;

async function copyInto(
  client: pg.Client,
  table: string,
  columns: readonly string[],
  rows: Iterable<string>,
): Promise<void> {
  const target = client.query(
    copyFrom(`COPY ${table} (${columns.join(', ')}) FROM STDIN`),
  ) as unknown as NodeJS.WritableStream;
  await pipeline(Readable.from(rows), target);
}

interface CustomerRecord {
  readonly id: number;
  readonly segment: Segment;
  readonly branchId: number;
  /** Relative likelihood of being chosen for a transaction. */
  readonly activity: number;
}

function* branchRows(): Generator<string> {
  for (const [index, branch] of BRANCHES.entries()) {
    // Deterministic opening dates, spread across two decades.
    const opened = new Date(Date.UTC(2004 + (index % 20), index % 12, 1 + (index % 27)));
    yield line(index + 1, branch.code, branch.name, branch.city, branch.region, opened.toISOString());
  }
}

function buildCustomers(rng: Random, count: number): { rows: string[]; records: CustomerRecord[] } {
  const rows: string[] = [];
  const records: CustomerRecord[] = [];

  for (let id = 1; id <= count; id++) {
    const segment = weightedPick(rng, SEGMENT_MIX);
    const branchIndex = weightedPickBranch(rng);
    const branchId = branchIndex + 1;
    // Private banking is screened harder before it is ever offered.
    const riskBand =
      segment === 'private_banking'
        ? rng.pick(['low', 'low', 'medium'] as const)
        : weightedPick(rng, RISK_MIX);
    const onboardedOn = new Date(
      Date.UTC(2019 + rng.int(0, 6), rng.int(0, 11), rng.int(1, 28), rng.int(0, 23)),
    );
    const status = rng.chance(0.96) ? 'active' : 'dormant';

    rows.push(
      line(
        id,
        customerName(rng, segment),
        segment,
        branchId,
        riskBand,
        onboardedOn.toISOString(),
        status,
      ),
    );

    // A Pareto tail of very active corporates is what makes "top five customers
    // by transaction value" a ranking with daylight between the places, rather
    // than five near-identical rows.
    const heavy = (segment === 'corporate' || segment === 'private_banking') && rng.chance(0.04);
    const activity = heavy
      ? Math.min(4000, Math.ceil(40 * (rng.float() + 0.002) ** -0.8))
      : 1 + rng.skewed(0, 6);
    records.push({ id, segment, branchId, activity });
  }

  return { rows, records };
}

function weightedPickBranch(rng: Random): number {
  const total = BRANCHES.reduce((sum, b) => sum + b.weight, 0);
  let roll = rng.float() * total;
  for (let i = 0; i < BRANCHES.length; i++) {
    roll -= BRANCHES[i]?.weight ?? 0;
    if (roll <= 0) return i;
  }
  return BRANCHES.length - 1;
}

function buildApplications(rng: Random, count: number, customers: readonly CustomerRecord[]): string[] {
  // Index approved applicants by branch and segment so an approval can point at
  // a real customer rather than a random one.
  const byBranchSegment = new Map<string, number[]>();
  for (const c of customers) {
    const key = `${c.branchId}:${c.segment}`;
    const bucket = byBranchSegment.get(key);
    if (bucket) bucket.push(c.id);
    else byBranchSegment.set(key, [c.id]);
  }

  // Volume climbs through the year at a different rate per segment, so that
  // "SME is growing fastest" is a fact about the data rather than a caption.
  const monthPickers = new Map<Segment, (rng: Random) => number>();
  for (const [segment, shape] of Object.entries(MONTHLY_SHAPE) as [Segment, readonly number[]][]) {
    const cumulative: number[] = [];
    let total = 0;
    for (const weight of shape) {
      total += weight;
      cumulative.push(total);
    }
    monthPickers.set(segment, (rng) => {
      const roll = rng.float() * total;
      for (const [index, ceiling] of cumulative.entries()) {
        if (roll <= ceiling) return index;
      }
      return cumulative.length - 1;
    });
  }

  const rows: string[] = [];

  for (let id = 1; id <= count; id++) {
    const segment = weightedPick(rng, SEGMENT_MIX);

    const month = monthPickers.get(segment)?.(rng) ?? rng.int(0, 11);

    const branchIndex = weightedPickBranch(rng);
    const branch = BRANCHES[branchIndex];
    if (!branch) continue;
    const branchId = branchIndex + 1;

    const submittedAt = new Date(
      Date.UTC(2025, month, rng.int(1, 28), rng.int(8, 19), rng.int(0, 59)),
    );

    const rejectionChance = Math.min(
      0.95,
      branch.rejectionRate * SEGMENT_REJECTION_BIAS[segment],
    );

    const pending = submittedAt > new Date(Date.UTC(2025, 11, 20)) && rng.chance(0.18);
    const rejected = !pending && rng.chance(rejectionChance);
    const decision = pending ? 'pending' : rejected ? 'rejected' : 'approved';

    // SME decisions take longer than retail — the mock's avgDays claim.
    const turnaroundHours = segment === 'retail' ? rng.int(4, 96) : rng.int(24, 264);
    const decidedAt = pending
      ? null
      : new Date(submittedAt.getTime() + turnaroundHours * 3_600_000).toISOString();

    let customerId: number | null = null;
    if (decision === 'approved') {
      const bucket = byBranchSegment.get(`${branchId}:${segment}`);
      if (bucket && bucket.length > 0) {
        customerId = bucket[rng.int(0, bucket.length - 1)] ?? null;
      }
    }

    rows.push(
      line(
        id,
        customerId,
        branchId,
        segment,
        submittedAt.toISOString(),
        decidedAt,
        decision,
        rejected ? rng.pick(REJECTION_REASONS) : null,
        rng.pick(CHANNELS),
      ),
    );
  }

  return rows;
}

function* transactionRows(
  rng: Random,
  count: number,
  customers: readonly CustomerRecord[],
): Generator<string> {
  // Build a cumulative activity table once, so picking a weighted customer is a
  // binary search rather than a scan. At 2.9M rows this matters.
  const cumulative = new Float64Array(customers.length);
  let running = 0;
  for (let i = 0; i < customers.length; i++) {
    running += customers[i]?.activity ?? 1;
    cumulative[i] = running;
  }

  const pickCustomer = (): CustomerRecord => {
    const target = rng.float() * running;
    let low = 0;
    let high = customers.length - 1;
    while (low < high) {
      const mid = (low + high) >> 1;
      if ((cumulative[mid] ?? 0) < target) low = mid + 1;
      else high = mid;
    }
    const record = customers[low];
    if (!record) throw new Error('no customers to attach transactions to');
    return record;
  };

  const fyMs = Date.UTC(2025, 11, 31, 23, 59) - FY_START.getTime();

  for (let id = 1; id <= count; id++) {
    const customer = pickCustomer();
    const size = TX_SIZE_BY_SEGMENT[customer.segment];
    const occurredAt = new Date(FY_START.getTime() + Math.floor(rng.float() * fyMs));

    yield line(
      id,
      customer.id,
      customer.branchId,
      occurredAt.toISOString(),
      rng.skewed(size.min, size.max),
      'GBP',
      rng.chance(0.46) ? 'credit' : 'debit',
      rng.pick(TX_CATEGORIES),
    );
  }
}

export async function seed(log: (m: string) => void = () => {}): Promise<void> {
  const scale = SEED_SCALES[config.SEED_SCALE];
  const rng = createRandom(config.SEED_RNG);

  const client = new Client({ connectionString: connectionUrls.owner });
  await client.connect();

  try {
    log(`seeding at scale "${config.SEED_SCALE}" (rng seed "${config.SEED_RNG}")`);
    const started = Date.now();

    await client.query(
      'TRUNCATE transactions, onboarding_applications, customers, branches RESTART IDENTITY CASCADE',
    );

    await copyInto(client, 'branches', ['id', 'code', 'name', 'city', 'region', 'opened_on'], branchRows());
    log(`  branches                 ${BRANCHES.length.toLocaleString()}`);

    const { rows: customerRows, records } = buildCustomers(rng, scale.customers);
    await copyInto(
      client,
      'customers',
      ['id', 'name', 'segment', 'branch_id', 'risk_band', 'onboarded_on', 'status'],
      customerRows,
    );
    log(`  customers                ${scale.customers.toLocaleString()}`);

    await copyInto(
      client,
      'onboarding_applications',
      [
        'id',
        'customer_id',
        'branch_id',
        'segment',
        'submitted_at',
        'decided_at',
        'decision',
        'rejection_reason',
        'channel',
      ],
      buildApplications(rng, scale.applications, records),
    );
    log(`  onboarding_applications  ${scale.applications.toLocaleString()}`);

    await copyInto(
      client,
      'transactions',
      ['id', 'customer_id', 'branch_id', 'occurred_at', 'amount_minor', 'currency', 'direction', 'category'],
      transactionRows(rng, scale.transactions, records),
    );
    log(`  transactions             ${scale.transactions.toLocaleString()}`);

    // Without statistics the planner will not use the indexes, and the timeout
    // demo stops being about query cost and starts being about a cold database.
    await client.query('ANALYZE');

    log(`seeded in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  } finally {
    await client.end();
  }
}

/** Sanity figures, used by the seed script and by tests. */
export async function seedSummary(client: pg.Client): Promise<Record<string, number>> {
  const tables = ['branches', 'customers', 'onboarding_applications', 'transactions'] as const;
  const counts: Record<string, number> = {};
  for (const table of tables) {
    const { rows } = await client.query<{ count: string }>(`SELECT count(*)::text AS count FROM ${table}`);
    counts[table] = Number(rows[0]?.count ?? 0);
  }
  return counts;
}
