/**
 * Fixtures and the deterministic random source for the seed.
 *
 * Everything below is invented. The institution, its branches, its customers
 * and every figure are fictional, and the UI says so.
 *
 * The shape follows the approved mock: a UK bank reporting in GBP, Retail
 * dominant by volume and SME growing fastest. The six branches named in the
 * mock's rejection table appear here with comparable rates, so the seeded data
 * reads the way the design intended without any figure being hardcoded.
 */

export interface BranchFixture {
  readonly code: string;
  readonly name: string;
  readonly city: string;
  readonly region: string;
  /** Roughly the share of applications this branch declines. */
  readonly rejectionRate: number;
  /** Relative share of application volume. */
  readonly weight: number;
}

export const BRANCHES: readonly BranchFixture[] = [
  // The six that appear in the approved mock, with comparable rates.
  { code: 'DAL', name: 'Dalston Junction', city: 'London', region: 'London', rejectionRate: 0.24, weight: 1.2 },
  { code: 'LEI', name: 'Leith', city: 'Edinburgh', region: 'Scotland', rejectionRate: 0.203, weight: 0.9 },
  { code: 'BRQ', name: 'Bristol Quay', city: 'Bristol', region: 'South West', rejectionRate: 0.157, weight: 1.5 },
  { code: 'HAR', name: 'Harrogate', city: 'Harrogate', region: 'North East', rejectionRate: 0.132, weight: 1.0 },
  { code: 'CNW', name: 'Canary Wharf', city: 'London', region: 'London', rejectionRate: 0.109, weight: 2.4 },
  { code: 'MAY', name: 'Mayfair', city: 'London', region: 'London', rejectionRate: 0.085, weight: 0.6 },
  // The rest of the estate.
  { code: 'SHO', name: 'Shoreditch', city: 'London', region: 'London', rejectionRate: 0.196, weight: 1.1 },
  { code: 'CRY', name: 'Croydon', city: 'London', region: 'London', rejectionRate: 0.218, weight: 1.0 },
  { code: 'RDG', name: 'Reading Central', city: 'Reading', region: 'South East', rejectionRate: 0.141, weight: 1.1 },
  { code: 'BRI', name: 'Brighton Lanes', city: 'Brighton', region: 'South East', rejectionRate: 0.168, weight: 0.9 },
  { code: 'OXF', name: 'Oxford Cornmarket', city: 'Oxford', region: 'South East', rejectionRate: 0.117, weight: 0.8 },
  { code: 'CAM', name: 'Cambridge Parkside', city: 'Cambridge', region: 'East', rejectionRate: 0.104, weight: 0.8 },
  { code: 'NOR', name: 'Norwich Riverside', city: 'Norwich', region: 'East', rejectionRate: 0.173, weight: 0.7 },
  { code: 'IPS', name: 'Ipswich Waterfront', city: 'Ipswich', region: 'East', rejectionRate: 0.187, weight: 0.6 },
  { code: 'BIR', name: 'Birmingham Colmore', city: 'Birmingham', region: 'West Midlands', rejectionRate: 0.162, weight: 1.6 },
  { code: 'COV', name: 'Coventry Ringway', city: 'Coventry', region: 'West Midlands', rejectionRate: 0.201, weight: 0.8 },
  { code: 'NOT', name: 'Nottingham Lace Market', city: 'Nottingham', region: 'East Midlands', rejectionRate: 0.178, weight: 0.9 },
  { code: 'LEC', name: 'Leicester Highcross', city: 'Leicester', region: 'East Midlands', rejectionRate: 0.192, weight: 0.8 },
  { code: 'MAN', name: 'Manchester Spinningfields', city: 'Manchester', region: 'North West', rejectionRate: 0.128, weight: 1.8 },
  { code: 'LIV', name: 'Liverpool Albert Dock', city: 'Liverpool', region: 'North West', rejectionRate: 0.184, weight: 1.1 },
  { code: 'PRE', name: 'Preston Fishergate', city: 'Preston', region: 'North West', rejectionRate: 0.211, weight: 0.6 },
  { code: 'LDS', name: 'Leeds Wellington', city: 'Leeds', region: 'North East', rejectionRate: 0.149, weight: 1.4 },
  { code: 'SHE', name: 'Sheffield Kelham', city: 'Sheffield', region: 'North East', rejectionRate: 0.171, weight: 1.0 },
  { code: 'NEW', name: 'Newcastle Quayside', city: 'Newcastle', region: 'North East', rejectionRate: 0.158, weight: 1.0 },
  { code: 'YOR', name: 'York Micklegate', city: 'York', region: 'North East', rejectionRate: 0.122, weight: 0.7 },
  { code: 'GLA', name: 'Glasgow Buchanan', city: 'Glasgow', region: 'Scotland', rejectionRate: 0.166, weight: 1.3 },
  { code: 'ABD', name: 'Aberdeen Union', city: 'Aberdeen', region: 'Scotland', rejectionRate: 0.139, weight: 0.7 },
  { code: 'CDF', name: 'Cardiff Bay', city: 'Cardiff', region: 'Wales', rejectionRate: 0.174, weight: 1.0 },
  { code: 'SWA', name: 'Swansea Maritime', city: 'Swansea', region: 'Wales', rejectionRate: 0.207, weight: 0.5 },
  { code: 'BEL', name: 'Belfast Titanic', city: 'Belfast', region: 'Northern Ireland', rejectionRate: 0.181, weight: 0.8 },
  { code: 'PLY', name: 'Plymouth Barbican', city: 'Plymouth', region: 'South West', rejectionRate: 0.195, weight: 0.6 },
  { code: 'EXE', name: 'Exeter Cathedral', city: 'Exeter', region: 'South West', rejectionRate: 0.146, weight: 0.6 },
];

export const SEGMENTS = ['retail', 'sme', 'corporate', 'private_banking'] as const;
export type Segment = (typeof SEGMENTS)[number];

/** Share of application volume, following the mock's FY2025 mix. */
export const SEGMENT_MIX: Readonly<Record<Segment, number>> = {
  retail: 0.702,
  sme: 0.211,
  corporate: 0.061,
  private_banking: 0.026,
};

/**
 * Month-by-month growth multipliers for FY2025, per segment. Retail grows about
 * 64% across the year and SME about 81%, so SME is visibly the fastest-growing
 * segment — the claim the `compare` state is built around.
 */
export const MONTHLY_SHAPE: Readonly<Record<Segment, readonly number[]>> = {
  retail: [1.0, 1.06, 1.22, 1.16, 1.27, 1.36, 1.42, 1.32, 1.46, 1.56, 1.5, 1.64],
  sme: [1.0, 1.11, 1.22, 1.18, 1.29, 1.42, 1.45, 1.38, 1.58, 1.68, 1.62, 1.81],
  corporate: [1.0, 0.85, 1.21, 1.12, 1.32, 1.38, 1.53, 1.29, 1.71, 1.79, 1.68, 1.94],
  private_banking: [1.0, 1.25, 1.17, 1.5, 1.42, 1.75, 1.58, 1.92, 1.83, 2.17, 2.0, 2.42],
};

/** Approval is easier for retail than SME, per the mock's head-to-head. */
export const SEGMENT_REJECTION_BIAS: Readonly<Record<Segment, number>> = {
  retail: 0.92,
  sme: 1.28,
  corporate: 1.05,
  private_banking: 0.71,
};

export const RISK_BANDS = ['low', 'medium', 'high'] as const;

/**
 * Most customers of a retail bank are low risk. A uniform split would be a
 * tell-tale sign of generated data, and would make "how are customers
 * distributed across risk bands" a question with a boring, implausible answer.
 */
export const RISK_MIX: Readonly<Record<(typeof RISK_BANDS)[number], number>> = {
  low: 0.62,
  medium: 0.28,
  high: 0.1,
};

export const REJECTION_REASONS = [
  'Identity verification failed',
  'Adverse credit history',
  'Incomplete documentation',
  'Sanctions screening hit',
  'Source of funds unclear',
  'Duplicate application',
  'Affordability threshold not met',
] as const;

export const CHANNELS = ['branch', 'online', 'mobile', 'broker', 'telephone'] as const;

export const TX_CATEGORIES = [
  'card_payment',
  'direct_debit',
  'standing_order',
  'faster_payment',
  'bacs_credit',
  'chaps',
  'atm_withdrawal',
  'fx_settlement',
] as const;

/** Typical transaction size in pence, by segment. Corporates move more money. */
export const TX_SIZE_BY_SEGMENT: Readonly<Record<Segment, { min: number; max: number }>> = {
  retail: { min: 150, max: 90_000 },
  sme: { min: 2_000, max: 1_200_000 },
  corporate: { min: 25_000, max: 9_500_000 },
  private_banking: { min: 10_000, max: 6_000_000 },
};

const COMPANY_FIRST = [
  'Ardent', 'Pellworth', 'Quayside', 'Ravensmoor', 'Thorne', 'Halewood', 'Brackenfell',
  'Stonecroft', 'Marlowe', 'Fenwick', 'Aldgate', 'Corvine', 'Duxbury', 'Elmsworth',
  'Garrowby', 'Hollingworth', 'Inglewood', 'Jarrow', 'Kelmscott', 'Lambourne',
  'Mereside', 'Northgate', 'Orrell', 'Pentland', 'Rookwood', 'Silverdale',
  'Tarnbrook', 'Underhill', 'Vantage', 'Westerling', 'Yarrowfield', 'Ashcombe',
] as const;

const COMPANY_SECOND = [
  'Logistics', 'Holdings', 'Freight', 'Estates', 'Partners', 'Trading', 'Industries',
  'Capital', 'Systems', 'Foods', 'Engineering', 'Textiles', 'Chemicals', 'Property',
  'Marine', 'Aggregates', 'Pharmaceuticals', 'Energy', 'Print', 'Joinery',
] as const;

const COMPANY_SUFFIX = ['Ltd', 'plc', 'LLP', '& Co', 'Group'] as const;

const PERSON_FIRST = [
  'Alice', 'Bernard', 'Catriona', 'Devan', 'Eleanor', 'Farouk', 'Gwen', 'Hamish',
  'Imogen', 'Jonah', 'Kirsty', 'Lorcan', 'Maeve', 'Niall', 'Orla', 'Piers',
  'Rhiannon', 'Sorley', 'Tamsin', 'Ualtar', 'Verity', 'Wynn', 'Xanthe', 'Yusuf',
] as const;

const PERSON_LAST = [
  'Abernethy', 'Blyth', 'Cadwallader', 'Duthie', 'Ellery', 'Fotheringham', 'Gault',
  'Haddon', 'Ingleby', 'Jephcott', 'Kirkbride', 'Lonsdale', 'Mainwaring', 'Naismith',
  'Ormerod', 'Pargeter', 'Quennell', 'Rutherglen', 'Standish', 'Trelawney',
  'Uttley', 'Vellacott', 'Wetherby', 'Yarlett',
] as const;

/** Deterministic string hash, used to seed the generator. */
function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

/**
 * A small, fast, seedable PRNG. `Math.random` is not seedable, and the seed has
 * to produce identical data on every machine for the tests to mean anything.
 */
export function createRandom(seed: string): Random {
  const next = xmur3(seed);
  let a = next();

  const float = (): number => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    float,
    int: (min, max) => min + Math.floor(float() * (max - min + 1)),
    pick: <T>(items: readonly T[]): T => {
      const value = items[Math.floor(float() * items.length)];
      if (value === undefined) throw new Error('pick() called with an empty list');
      return value;
    },
    /** Skewed towards the low end, which is how transaction values actually sit. */
    skewed: (min, max) => min + Math.floor((max - min) * float() ** 3),
    chance: (probability) => float() < probability,
  };
}

export interface Random {
  float(): number;
  int(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  skewed(min: number, max: number): number;
  chance(probability: number): boolean;
}

export function companyName(rng: Random): string {
  return `${rng.pick(COMPANY_FIRST)} ${rng.pick(COMPANY_SECOND)} ${rng.pick(COMPANY_SUFFIX)}`;
}

export function personName(rng: Random): string {
  return `${rng.pick(PERSON_FIRST)} ${rng.pick(PERSON_LAST)}`;
}

export function customerName(rng: Random, segment: Segment): string {
  return segment === 'retail' ? personName(rng) : companyName(rng);
}

/** Picks a key from a weighted distribution. */
export function weightedPick<K extends string>(rng: Random, weights: Readonly<Record<K, number>>): K {
  const entries = Object.entries(weights) as [K, number][];
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = rng.float() * total;
  for (const [key, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return key;
  }
  const last = entries.at(-1);
  if (!last) throw new Error('weightedPick() called with no weights');
  return last[0];
}

export const FY_START = new Date(Date.UTC(2025, 0, 1));
export const FY_END = new Date(Date.UTC(2025, 11, 31, 23, 59, 59));
