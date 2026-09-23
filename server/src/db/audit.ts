import type { Answer, FailureCode, Outcome, SafetyCheck } from '@halcyon/shared';
import { audit } from './pools.js';

export interface AuditRecord {
  readonly id: string;
  readonly question: string;
  readonly outcome: Outcome;
  readonly templateId: string | null;
  readonly sqlText: string | null;
  readonly checks: readonly SafetyCheck[] | null;
  readonly tablesTouched: readonly string[] | null;
  readonly rowCount: number | null;
  readonly elapsedMs: number;
  readonly traceId: string;
  readonly answer: Answer | null;
  /** Present for unanswerable, blocked and failed; the user-facing explanation. */
  readonly reason: string | null;
  readonly failureCode: FailureCode | null;
}

/**
 * Writes one row for every question, whatever became of it.
 *
 * This table is both the audit trail and the history drawer — ADR-0005 — so a
 * refusal has to be recorded as carefully as an answer. A blocked question that
 * left no trace would be the one thing an auditor most wanted to see.
 *
 * Written by `halcyon_app`, which holds INSERT here and no privilege anywhere
 * else. A failure to record is logged and swallowed: losing the audit row is
 * bad, but failing the user's question because of it is worse.
 */
export async function recordAsk(record: AuditRecord): Promise<void> {
  try {
    await audit().query(
      `INSERT INTO query_log
         (id, question, outcome, template_id, sql_text, checks, tables_touched,
          row_count, elapsed_ms, trace_id, answer, reason, failure_code)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        record.id,
        record.question,
        record.outcome,
        record.templateId,
        record.sqlText,
        record.checks ? JSON.stringify(record.checks) : null,
        record.tablesTouched ? [...record.tablesTouched] : null,
        record.rowCount,
        record.elapsedMs,
        record.traceId,
        record.answer ? JSON.stringify(record.answer) : null,
        record.reason,
        record.failureCode,
      ],
    );
  } catch (error: unknown) {
    process.stderr.write(
      `audit write failed for trace ${record.traceId}: ${error instanceof Error ? error.message : String(error)}\n`,
    );
  }
}
