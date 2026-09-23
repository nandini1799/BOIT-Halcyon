// node-sql-parser is CommonJS: Node's ESM loader cannot see its named exports,
// so the default import is destructured here rather than imported directly.
import sqlParser, { type Parser as SqlParser } from 'node-sql-parser';
import { SAFETY_CHECK_IDS, type SafetyCheck } from '@halcyon/shared';
import { DATA_TABLES } from '../db/schema.js';
import { config } from '../lib/config.js';

const { Parser } = sqlParser;

/**
 * The Guard. Every generated statement passes through here before it can reach
 * the database, and it fails closed: anything not positively understood to be
 * safe is refused.
 *
 * It works on the parsed AST, never on the text. A regular expression can be
 * defeated by a comment, a nested quote or unusual whitespace; a parser cannot,
 * because it is the same grammar the database will apply.
 */

export interface GuardResult {
  readonly ok: boolean;
  /** The statement considered. On refusal this is shown to the user verbatim. */
  readonly sql: string;
  readonly checks: readonly SafetyCheck[];
  /** Base tables the statement reads, for the audit block. Excludes CTE aliases. */
  readonly tables: readonly string[];
}

const DIALECT = { database: 'PostgreSQL' } as const;

const LABELS: Readonly<Record<SafetyCheck['id'], string>> = {
  'single-statement': 'One statement',
  'read-only': 'Read-only',
  'tables-allow-listed': 'Known tables only',
  'row-limit': 'Row limit',
  'parameters-bound': 'Values bound',
};

function verdict(id: SafetyCheck['id'], passed: boolean, detail: string): SafetyCheck {
  return { id, label: LABELS[id], verdict: passed ? 'pass' : 'fail', detail };
}

const ALLOWED_TABLES: ReadonlySet<string> = new Set(DATA_TABLES);

/**
 * `tableList` entries arrive as `type::database::table`. A statement may also
 * reference its own common table expressions, which are not tables at all and
 * must not be judged against the allow-list.
 */
function referencedTables(tableList: readonly string[]): { schema: string; table: string }[] {
  return tableList.map((entry) => {
    const parts = entry.split('::');
    return { schema: parts[1] ?? 'null', table: parts[2] ?? '' };
  });
}

function cteNames(statements: readonly { with?: unknown }[]): ReadonlySet<string> {
  const names = new Set<string>();
  for (const statement of statements) {
    const withClause = statement.with;
    if (!Array.isArray(withClause)) continue;
    for (const cte of withClause) {
      const name = (cte as { name?: { value?: string } } | null)?.name?.value;
      if (typeof name === 'string') names.add(name.toLowerCase());
    }
  }
  return names;
}

export function guard(sql: string, parameters: readonly unknown[] = []): GuardResult {
  const parser = new Parser();

  let parsed: ReturnType<SqlParser["parse"]>;
  try {
    parsed = parser.parse(sql, DIALECT);
  } catch (error: unknown) {
    // Fail closed. A statement we cannot parse is a statement we cannot judge,
    // and an unjudged statement never reaches the database.
    const because = error instanceof Error ? error.message.split('\n')[0] : 'unknown error';
    return {
      ok: false,
      sql,
      tables: [],
      checks: SAFETY_CHECK_IDS.map((id) =>
        verdict(id, false, `Not assessed — the statement could not be parsed: ${because}`),
      ),
    };
  }

  const { ast, tableList } = parsed;
  const statements = statementsOf(ast);

  const checks: SafetyCheck[] = [];

  checks.push(
    verdict(
      'single-statement',
      statements.length === 1,
      statements.length === 1
        ? 'A single statement was submitted.'
        : `${statements.length} statements were submitted; only one is permitted.`,
    ),
  );

  const writes = statements.filter((statement) => statement.type !== 'select');
  checks.push(
    verdict(
      'read-only',
      writes.length === 0,
      writes.length === 0
        ? 'The statement only reads.'
        : `A ${String(writes[0]?.type).toUpperCase()} statement cannot be executed; only SELECT is permitted.`,
    ),
  );

  const locals = cteNames(statements as { with?: unknown }[]);
  const referenced = referencedTables(tableList).filter(
    ({ table }) => !locals.has(table.toLowerCase()),
  );
  const offending = referenced.filter(({ schema, table }) => {
    const qualified = schema !== 'null' && schema !== 'public';
    return qualified || !ALLOWED_TABLES.has(table.toLowerCase());
  });
  const tables = [...new Set(referenced.map(({ table }) => table.toLowerCase()))].sort();

  checks.push(
    verdict(
      'tables-allow-listed',
      offending.length === 0,
      offending.length === 0
        ? 'Every table referenced is one of the four data tables.'
        : `${offending.map((o) => (o.schema === 'null' ? o.table : `${o.schema}.${o.table}`)).join(', ')} is not a table this service may read.`,
    ),
  );

  const { check: rowLimit, sql: bounded } = enforceRowLimit(parser, statements, sql);
  checks.push(rowLimit);

  checks.push(checkParametersBound(statements, parameters));

  const ok = checks.every((c) => c.verdict === 'pass');

  // On refusal, show what was submitted. Displaying the Guard's own rewrite
  // would misrepresent the thing being refused, and an audit trail that edits
  // the evidence is not an audit trail.
  return { ok, sql: ok ? bounded : sql, checks, tables };
}

/** Every object node in the tree, in no particular order. */
function* walk(node: unknown): Generator<Record<string, unknown>> {
  if (Array.isArray(node)) {
    for (const child of node) yield* walk(child);
    return;
  }
  if (node !== null && typeof node === 'object') {
    const object = node as Record<string, unknown>;
    yield object;
    for (const value of Object.values(object)) yield* walk(value);
  }
}

const STRING_NODES = new Set(['single_quote_string', 'string', 'double_quote_string']);

/**
 * A generated statement must carry no string literals at all: every value comes
 * from the question, and every value from the question arrives as `$1`. This is
 * a stronger rule than looking for injection patterns, because it does not
 * require anticipating what an attack looks like — concatenation simply cannot
 * be expressed. Numeric literals are permitted; `GROUP BY 1` carries no input.
 */
function checkParametersBound(
  statements: readonly unknown[],
  parameters: readonly unknown[],
): SafetyCheck {
  const literals: string[] = [];
  const placeholders = new Set<number>();

  for (const node of walk(statements)) {
    const type = node['type'];
    if (typeof type !== 'string') continue;

    if (STRING_NODES.has(type)) {
      literals.push(String(node['value']));
      continue;
    }

    // `$1` parses as a var node with a `$` prefix and a numeric name. Anything
    // else calling itself a var is not a bind parameter and is not counted.
    if (type === 'var' && node['prefix'] === '$' && typeof node['name'] === 'number') {
      placeholders.add(node['name']);
    }
  }

  if (literals.length > 0) {
    return verdict(
      'parameters-bound',
      false,
      `A value is written into the statement rather than bound to it: ${literals.map((l) => `'${l}'`).join(', ')}.`,
    );
  }

  if (placeholders.size !== parameters.length) {
    return verdict(
      'parameters-bound',
      false,
      `The statement has ${placeholders.size} placeholder(s) but ${parameters.length} parameter(s) were supplied.`,
    );
  }

  return verdict(
    'parameters-bound',
    true,
    placeholders.size === 0
      ? 'The statement contains no values to bind.'
      : `All ${placeholders.size} value(s) are bound, not concatenated.`,
  );
}

/** The parser returns a bare node for one statement and an array for several. */
const statementsOf = <T>(ast: T | T[]): T[] => (Array.isArray(ast) ? ast : [ast]);

interface LimitNode {
  seperator?: string;
  value?: { type: string; value: number }[];
}

/**
 * Every result set is bounded. A statement without a limit is given one, which
 * is a convenience; a statement demanding more than the cap is refused rather
 * than quietly truncated, because silently returning different data than the
 * statement asked for is precisely what the audit trail exists to prevent.
 */
function enforceRowLimit(
  parser: SqlParser,
  statements: readonly unknown[],
  original: string,
): { check: SafetyCheck; sql: string } {
  const cap = config.ROW_LIMIT;
  const [first] = statements as ({ limit?: LimitNode | null } | undefined)[];

  if (!first || statements.length !== 1) {
    return {
      check: verdict('row-limit', false, 'No single statement to bound.'),
      sql: original,
    };
  }

  const existing = first.limit?.value?.[0]?.value;

  if (typeof existing === 'number') {
    return existing > cap
      ? {
          check: verdict('row-limit', false, `A limit of ${existing.toLocaleString()} rows exceeds the ${cap.toLocaleString()} row cap.`),
          sql: original,
        }
      : {
          check: verdict('row-limit', true, `The statement returns at most ${existing.toLocaleString()} rows.`),
          sql: original,
        };
  }

  const check = verdict(
    'row-limit',
    true,
    `No limit was set, so a cap of ${cap.toLocaleString()} rows was applied.`,
  );

  /*
   * The bound is appended to the statement as written rather than reconstructed
   * from the tree. Both produce the same query, but `sqlify` returns the
   * parser's idea of the statement — one line, its own quoting, its own casing
   * — and the audit block would then be showing a paraphrase of the query under
   * the heading "as executed". Appending changes nothing but the last line.
   *
   * The result is re-parsed to confirm the bound landed as a limit. If it did
   * not, the reconstruction is used instead: an ugly statement that is
   * definitely bounded beats a readable one that might not be.
   */
  const appended = `${original.replace(/;\s*$/, '').trimEnd()}\n LIMIT ${cap}`;

  try {
    const [reparsed] = statementsOf(parser.parse(appended, DIALECT).ast) as (
      | { limit?: LimitNode | null }
      | undefined
    )[];
    if (reparsed?.limit?.value?.[0]?.value === cap) return { check, sql: appended };
  } catch {
    // Falls through to the reconstruction.
  }

  first.limit = { seperator: '', value: [{ type: 'number', value: cap }] };
  return {
    check,
    sql: parser.sqlify(statements[0] as Parameters<SqlParser["sqlify"]>[0], DIALECT),
  };
}
