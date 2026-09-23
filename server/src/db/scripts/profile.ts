import pg from 'pg';
import { connectionUrls } from '../../lib/config.js';
import { ensureRunning } from '../embedded.js';
import { log } from './lib.js';

const { Client } = pg;

/**
 * Prints what is actually in the database.
 *
 * The seed is generated, so the only way to know it reads like a bank's data —
 * Retail dominant, SME growing fastest, branch rejection rates in a plausible
 * spread — is to ask it. Every figure the product shows is queried the same way.
 */
async function main(): Promise<void> {
  const cluster = await ensureRunning(log);
  const client = new Client({ connectionString: connectionUrls.readonly });

  try {
    await client.connect();

    const show = async (title: string, sql: string): Promise<void> => {
      const { rows } = await client.query(sql);
      log('');
      log(title);
      for (const row of rows) {
        const cells = Object.entries(row).map(([key, value]) => {
          const text =
            typeof value === 'number'
              ? value.toLocaleString(undefined, { maximumFractionDigits: 1 })
              : String(value);
          return `${key}=${text}`;
        });
        log(`  ${cells.join('  ')}`);
      }
    };

    await show(
      'FY2025 applications by segment',
      `SELECT segment,
              count(*)::int AS applications,
              round(100.0 * count(*) / sum(count(*)) OVER (), 1)::float8 AS share_pct
         FROM onboarding_applications
        WHERE submitted_at >= '2025-01-01' AND submitted_at < '2026-01-01'
        GROUP BY 1 ORDER BY 2 DESC`,
    );

    await show(
      'Growth, January to December 2025 (the SME-fastest claim)',
      `WITH m AS (
         SELECT segment, date_trunc('month', submitted_at) AS month, count(*)::float8 AS n
           FROM onboarding_applications
          WHERE submitted_at >= '2025-01-01' AND submitted_at < '2026-01-01'
          GROUP BY 1, 2
       )
       SELECT segment,
              max(n) FILTER (WHERE month = '2025-01-01')::int AS jan,
              max(n) FILTER (WHERE month = '2025-12-01')::int AS dec,
              round((100.0 * (max(n) FILTER (WHERE month = '2025-12-01')
                            / max(n) FILTER (WHERE month = '2025-01-01') - 1))::numeric, 1)::float8 AS growth_pct
         FROM m GROUP BY 1 ORDER BY 4 DESC`,
    );

    await show(
      'Branch rejection rates, top and bottom',
      `SELECT b.name AS branch,
              count(*)::int AS applications,
              count(*) FILTER (WHERE a.decision = 'rejected')::int AS rejected,
              round(100.0 * count(*) FILTER (WHERE a.decision = 'rejected') / count(*), 1)::float8 AS rate_pct
         FROM onboarding_applications a JOIN branches b ON b.id = a.branch_id
        GROUP BY 1 HAVING count(*) > 200
        ORDER BY 4 DESC LIMIT 3`,
    );

    await show(
      'Top five customers by transaction value',
      `SELECT c.name AS customer, c.segment, b.name AS branch,
              count(*)::int AS transactions,
              round(sum(t.amount_minor) / 100.0)::float8 AS total_gbp
         FROM transactions t
         JOIN customers c ON c.id = t.customer_id
         JOIN branches b ON b.id = c.branch_id
        GROUP BY 1, 2, 3 ORDER BY 5 DESC LIMIT 5`,
    );
  } finally {
    await client.end().catch(() => {});
    await cluster.stop();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`\nprofile failed: ${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
