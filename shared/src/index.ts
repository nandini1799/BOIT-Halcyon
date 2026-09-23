/**
 * The contract between client and server.
 *
 * Vocabulary here is fixed by CONTEXT.md. In particular the four outcomes are
 * `answered`, `unanswerable`, `blocked` and `failed`. "Rejected" is a banking
 * term describing a declined onboarding application and never appears here.
 */

export type Brand<T, B extends string> = T & { readonly __brand: B };

export type AnswerId = Brand<string, 'AnswerId'>;
export type TemplateId = Brand<string, 'TemplateId'>;
export type TraceId = Brand<string, 'TraceId'>;

export const asAnswerId = (v: string): AnswerId => v as AnswerId;
export const asTemplateId = (v: string): TemplateId => v as TemplateId;
export const asTraceId = (v: string): TraceId => v as TraceId;

/** Compile-time exhaustiveness guard. A new union member breaks the build here. */
export function assertNever(value: never, context: string): never {
  throw new Error(`Unhandled ${context}: ${JSON.stringify(value)}`);
}

// ---------------------------------------------------------------------------
// The Guard
// ---------------------------------------------------------------------------

export const SAFETY_CHECK_IDS = [
  'single-statement',
  'read-only',
  'tables-allow-listed',
  'row-limit',
  'parameters-bound',
] as const;

export type SafetyCheckId = (typeof SAFETY_CHECK_IDS)[number];

export interface SafetyCheck {
  readonly id: SafetyCheckId;
  /** Short label, shown in the notes drawer. */
  readonly label: string;
  readonly verdict: 'pass' | 'fail';
  /** One line explaining the verdict. Shown whether it passed or failed. */
  readonly detail: string;
}

// ---------------------------------------------------------------------------
// The shape of an Answer
// ---------------------------------------------------------------------------

export type Form = 'kpi' | 'table' | 'bar' | 'line';

export type ColumnType = 'text' | 'number' | 'currency' | 'percent' | 'date';

export interface Column {
  readonly key: string;
  readonly label: string;
  readonly type: ColumnType;
}

export type CellValue = string | number | null;
export type Row = Readonly<Record<string, CellValue>>;

export interface Kpi {
  readonly label: string;
  readonly value: string;
  /** The small line beneath the figure, e.g. "+12.4% on FY2024". */
  readonly caption?: string;
}

/** How a chart should be drawn. Restricted to what Recharts reproduces. */
export interface ChartSpec {
  readonly kind: 'bar' | 'horizontal-bar' | 'line';
  readonly categoryKey: string;
  readonly seriesKeys: readonly string[];
  readonly caption: string;
  /** Printed beneath every chart. A chart without a source is an assertion. */
  readonly source: string;
}

export interface StageTiming {
  readonly stage: PipelineStage;
  readonly elapsedMs: number;
}

/**
 * How an Answer was produced. Not optional and not debug output — this is the
 * payload behind "Notes on this answer", and an Answer cannot exist without it.
 */
export interface Audit {
  /** Exactly the SQL that ran, with its parameters listed separately. */
  readonly sql: string;
  readonly parameters: readonly CellValue[];
  readonly tables: readonly string[];
  readonly checks: readonly SafetyCheck[];
  readonly planCost: number | null;
  readonly rowCount: number;
  readonly elapsedMs: number;
  readonly stageTimings: readonly StageTiming[];
  /**
   * What wrote the statement. Absent on answers filed before the generator was
   * recorded, and null when the catalogue was called without a provider.
   */
  readonly generator?: GeneratorTrace | null;
}

/** The provider call behind an Answer, as shown under "Notes on this answer". */
export interface GeneratorTrace {
  readonly provider: string;
  readonly model: string;
  readonly promptTokens: number;
  readonly completionTokens: number;
  /** Size of the schema context, which is built once and reused. */
  readonly contextTokens: number;
  readonly contextCached: boolean;
}

export interface Suggestion {
  readonly templateId: TemplateId;
  readonly question: string;
  readonly tables: readonly string[];
  readonly form: Form;
}

export interface Answer {
  readonly id: AnswerId;
  readonly question: string;
  readonly filedAt: string;
  readonly templateId: TemplateId;
  /** Uppercase kicker line: section, elapsed time, row count. */
  readonly kicker: string;
  /** The answer stated as a claim. */
  readonly headline: string;
  /** The answer in prose, with its figures. Markdown-bold is permitted. */
  readonly standfirst: string;
  readonly kpis: readonly Kpi[];
  readonly form: Form;
  readonly columns: readonly Column[];
  readonly rows: readonly Row[];
  readonly chart: ChartSpec | null;
  /** Why this Form was chosen. Shown in the evidence rail. */
  readonly formRationale: string;
  /** What was assumed to answer this. Shown in the evidence rail. */
  readonly assumptions: readonly string[];
  readonly related: readonly Suggestion[];
  readonly audit: Audit;
}

// ---------------------------------------------------------------------------
// The four outcomes
// ---------------------------------------------------------------------------

export type Outcome = 'answered' | 'unanswerable' | 'blocked' | 'failed';

export type AskResponse =
  | { readonly status: 'answered'; readonly answer: Answer }
  | {
      readonly status: 'unanswerable';
      readonly reason: string;
      readonly suggestions: readonly Suggestion[];
    }
  | {
      readonly status: 'blocked';
      readonly reason: string;
      /** The refused statement. Shown to the user — a silent refusal cannot be audited. */
      readonly sql: string;
      readonly checks: readonly SafetyCheck[];
    }
  | {
      readonly status: 'failed';
      readonly code: FailureCode;
      /** Sanitised. Never a stack trace, never a schema dump. */
      readonly message: string;
      readonly traceId: TraceId;
    };

/**
 * Why an ask failed.
 *
 * `network_error` is the one the client raises on its own behalf: the question
 * failed, and the reason is that the server was never reached. It belongs here
 * rather than in a parallel client-only type, because from the user's position
 * "the server is down" and "the query timed out" are the same kind of event.
 */
export type FailureCode =
  | 'statement_timeout'
  | 'execution_error'
  | 'internal_error'
  | 'network_error'
  | 'rate_limited';

// ---------------------------------------------------------------------------
// The pipeline, streamed over SSE
// ---------------------------------------------------------------------------

export const PIPELINE_STAGES = [
  'validate',
  'route',
  'generate',
  'guard',
  'execute',
  'choose-form',
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const STAGE_LABELS: Readonly<Record<PipelineStage, string>> = {
  validate: 'Validate input',
  route: 'Route to tables',
  generate: 'Generate SQL',
  guard: 'Safety checks',
  execute: 'Execute read-only',
  'choose-form': 'Choose output form',
};

/**
 * Emitted as each stage genuinely completes. Never simulated — see ADR-0007.
 */
export type AskStreamEvent =
  | {
      readonly type: 'stage';
      readonly stage: PipelineStage;
      readonly status: 'running' | 'done' | 'skipped';
      readonly elapsedMs: number;
      /** e.g. "onboarding_applications, branches" once routing has resolved. */
      readonly detail?: string;
    }
  | { readonly type: 'result'; readonly response: AskResponse };

// ---------------------------------------------------------------------------
// History — the audit log with a face. See ADR-0005.
// ---------------------------------------------------------------------------

export interface HistoryEntry {
  readonly id: AnswerId;
  readonly question: string;
  readonly askedAt: string;
  readonly outcome: Outcome;
  readonly tables: readonly string[];
  readonly rowCount: number | null;
  readonly elapsedMs: number;
}

export interface HistoryPage {
  readonly entries: readonly HistoryEntry[];
}

/** One filed Answer, restored unchanged. Re-opening never re-runs the query. */
export type HistoryDetail =
  | { readonly status: 'answered'; readonly answer: Answer }
  | { readonly status: 'unanswerable'; readonly question: string; readonly reason: string }
  | {
      readonly status: 'blocked';
      readonly question: string;
      readonly reason: string;
      readonly sql: string;
      readonly checks: readonly SafetyCheck[];
    }
  | {
      readonly status: 'failed';
      readonly question: string;
      readonly code: FailureCode;
      readonly message: string;
    };

// ---------------------------------------------------------------------------
// Schema catalogue, for the evidence rail. Row counts are always queried live.
// ---------------------------------------------------------------------------

export interface TableInfo {
  readonly name: string;
  readonly description: string;
  readonly rowCount: number;
}

export interface SchemaResponse {
  readonly tables: readonly TableInfo[];
  /** The starter questions offered on the empty state. */
  readonly starters: readonly Suggestion[];
  /** Probes that deliberately attempt something unsafe, so the Guard is demonstrable. */
  readonly guardProbes: readonly Suggestion[];
}

// ---------------------------------------------------------------------------
// Request
// ---------------------------------------------------------------------------

export interface AskRequest {
  readonly question: string;
}

export const MAX_QUESTION_LENGTH = 500;
