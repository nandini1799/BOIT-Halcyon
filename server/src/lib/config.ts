import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';
import { resolve } from 'node:path';

loadDotenv({ path: resolve(process.cwd(), '../.env'), quiet: true });
loadDotenv({ path: resolve(process.cwd(), '.env'), quiet: true });

const intFromEnv = (fallback: number) =>
  z.coerce.number().int().positive().default(fallback);

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  DATABASE_MODE: z.enum(['embedded', 'external']).default('embedded'),
  PGDATA_DIR: z.string().default('.pgdata'),
  POSTGRES_HOST: z.string().default('localhost'),
  POSTGRES_PORT: intFromEnv(55432),
  POSTGRES_DB: z.string().default('halcyon'),
  POSTGRES_USER: z.string().default('halcyon_owner'),
  POSTGRES_PASSWORD: z.string().default('halcyon_owner_dev'),

  HALCYON_RO_USER: z.string().default('halcyon_ro'),
  HALCYON_RO_PASSWORD: z.string().default('halcyon_ro_dev'),
  HALCYON_APP_USER: z.string().default('halcyon_app'),
  HALCYON_APP_PASSWORD: z.string().default('halcyon_app_dev'),

  DATABASE_URL_OWNER: z.string().url().optional(),

  PORT: intFromEnv(4000),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),

  /**
   * Which generator writes the SQL. `mock` runs the Question Catalogue behind
   * the provider interface; `catalogue` skips the provider entirely. A hosted
   * provider is added here and nowhere else — see ADR-0010.
   */
  LLM_PROVIDER: z.enum(['mock', 'catalogue']).default('mock'),
  LLM_MODEL: z.string().default('halcyon-sql-mock-1'),

  MAX_QUESTION_LENGTH: intFromEnv(500),
  ROW_LIMIT: intFromEnv(1000),
  STATEMENT_TIMEOUT_MS: intFromEnv(5000),

  RATE_LIMIT_WINDOW_MS: intFromEnv(60_000),
  /** Questions per minute. Ample for a person; a bound on a runaway script. */
  RATE_LIMIT_MAX: intFromEnv(60),

  SEED_SCALE: z.enum(['demo', 'full', 'test']).default('demo'),
  SEED_RNG: z.string().default('halcyon-2026'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  ${i.path.join('.')}: ${i.message}`)
    .join('\n');
  throw new Error(`Invalid environment.\n${issues}\n\nCopy .env.example to .env and try again.`);
}

export const config = parsed.data;

/**
 * Connection strings for the three roles.
 *
 * `owner` migrates and seeds. `readonly` executes every generated query. `app`
 * writes the audit log. The server never crosses them — see ADR-0005.
 */
function url(user: string, password: string): string {
  const { POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DB } = config;
  const auth = `${encodeURIComponent(user)}:${encodeURIComponent(password)}`;
  return `postgres://${auth}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}`;
}

export const connectionUrls = {
  owner: config.DATABASE_URL_OWNER ?? url(config.POSTGRES_USER, config.POSTGRES_PASSWORD),
  readonly: url(config.HALCYON_RO_USER, config.HALCYON_RO_PASSWORD),
  app: url(config.HALCYON_APP_USER, config.HALCYON_APP_PASSWORD),
} as const;

/** Rows generated per scale. Only `transactions` varies meaningfully. */
export const SEED_SCALES = {
  test: { branches: 8, customers: 400, applications: 300, transactions: 5_000 },
  demo: { branches: 32, customers: 48_000, applications: 32_000, transactions: 250_000 },
  full: { branches: 32, customers: 48_201, applications: 31_886, transactions: 2_914_330 },
} as const satisfies Record<
  typeof config.SEED_SCALE,
  { branches: number; customers: number; applications: number; transactions: number }
>;
