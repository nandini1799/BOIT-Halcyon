import {
  MAX_QUESTION_LENGTH,
  asAnswerId,
  asTraceId,
  type Answer,
  type AskResponse,
  type AskStreamEvent,
  type PipelineStage,
  type StageTiming,
  type Suggestion,
} from '@halcyon/shared';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { declinedReason } from '../catalogue/declined.js';
import { findProbe } from '../catalogue/probes.js';
import { route } from '../catalogue/router.js';
import type { QuestionTemplate } from '../catalogue/types.js';
import { TEMPLATES } from '../catalogue/templates.js';
import { recordAsk } from '../db/audit.js';
import { choosePresentation } from './choose-form.js';
import { executeReadOnly } from './execute.js';
import { activeGenerator, type Routed } from './generate.js';
import { guard } from './guard.js';
import { narrate } from './narrate.js';

const questionSchema = z
  .string()
  .trim()
  .min(1, 'A question is needed before anything can be answered.')
  .max(MAX_QUESTION_LENGTH, `Questions are limited to ${MAX_QUESTION_LENGTH} characters.`);

const suggestionOf = (template: QuestionTemplate): Suggestion => ({
  templateId: template.id,
  question: template.canonical,
  tables: template.tables,
  form: template.form,
});

/**
 * The six stages, run in order, each emitting when it genuinely completes.
 *
 * Nothing here is simulated — ADR-0007. If the execute stage takes four seconds
 * the client waits four seconds for that event, because the alternative is an
 * interface that tells a reassuring story about work that is not happening,
 * inside a product whose entire argument is that it shows its working.
 */
export async function* ask(rawQuestion: string): AsyncGenerator<AskStreamEvent> {
  const traceId = asTraceId(randomUUID());
  const answerId = asAnswerId(randomUUID());
  const startedAt = Date.now();
  const timings: StageTiming[] = [];

  let stageStarted = Date.now();
  const begin = (stage: PipelineStage): AskStreamEvent => {
    stageStarted = Date.now();
    return { type: 'stage', stage, status: 'running', elapsedMs: 0 };
  };
  const finish = (stage: PipelineStage, detail?: string): AskStreamEvent => {
    const elapsedMs = Date.now() - stageStarted;
    timings.push({ stage, elapsedMs });
    return detail === undefined
      ? { type: 'stage', stage, status: 'done', elapsedMs }
      : { type: 'stage', stage, status: 'done', elapsedMs, detail };
  };
  const skip = (stage: PipelineStage, detail: string): AskStreamEvent => {
    timings.push({ stage, elapsedMs: 0 });
    return { type: 'stage', stage, status: 'skipped', elapsedMs: 0, detail };
  };

  const settle = async (response: AskResponse, extra: Parameters<typeof recordAsk>[0]): Promise<AskStreamEvent> => {
    await recordAsk(extra);
    return { type: 'result', response };
  };

  // -- 1. validate ---------------------------------------------------------
  yield begin('validate');
  const parsed = questionSchema.safeParse(rawQuestion);
  if (!parsed.success) {
    const reason = parsed.error.issues[0]?.message ?? 'That question could not be read.';
    yield skip('validate', reason);
    for (const stage of ['route', 'generate', 'guard', 'execute', 'choose-form'] as const) {
      yield skip(stage, 'Not reached.');
    }
    yield await settle(
      { status: 'unanswerable', reason, suggestions: TEMPLATES.slice(0, 3).map(suggestionOf) },
      {
        id: answerId, question: rawQuestion, outcome: 'unanswerable', templateId: null,
        sqlText: null, checks: null, tablesTouched: null, rowCount: null,
        elapsedMs: Date.now() - startedAt, traceId, answer: null, reason, failureCode: null,
      },
    );
    return;
  }
  const question = parsed.data;
  yield finish('validate', `${question.length} characters`);

  // -- 2. route ------------------------------------------------------------
  yield begin('route');
  const probe = findProbe(question);
  const routing = probe ? null : route(question);
  const routed: Routed | null = probe
    ? { kind: 'probe', probe }
    : routing?.matched
      ? { kind: 'template', template: routing.template }
      : null;

  if (!routed) {
    const nearest = routing && !routing.matched ? routing.suggestions.map(suggestionOf) : [];
    const reason =
      declinedReason(question) ??
      'That question does not match anything in the catalogue. Halcyon answers from four tables — customers, branches, onboarding applications and transactions — and will not approximate an answer from data it does not hold.';

    yield skip('route', 'No template matched.');
    for (const stage of ['generate', 'guard', 'execute', 'choose-form'] as const) {
      yield skip(stage, 'Not reached.');
    }
    yield await settle(
      { status: 'unanswerable', reason, suggestions: nearest.length > 0 ? nearest : TEMPLATES.slice(0, 3).map(suggestionOf) },
      {
        id: answerId, question, outcome: 'unanswerable', templateId: null,
        sqlText: null, checks: null, tablesTouched: null, rowCount: null,
        elapsedMs: Date.now() - startedAt, traceId, answer: null, reason, failureCode: null,
      },
    );
    return;
  }

  const routedTables = routed.kind === 'template' ? routed.template.tables.join(', ') : 'unverified';
  yield finish('route', routedTables);

  // -- 3. generate ---------------------------------------------------------
  yield begin('generate');
  const generator = activeGenerator();
  const generated = await generator.generate({ question, routed });

  // The generator declining, or replying with something that is not a statement
  // at all, is a normal outcome rather than a crash: it is the case the whole
  // boundary exists to contain.
  if (!generated.ok) {
    yield finish('generate', generated.reason);
    for (const stage of ['guard', 'execute', 'choose-form'] as const) {
      yield skip(stage, 'Not reached — nothing was generated.');
    }
    yield await settle(
      { status: 'unanswerable', reason: generated.reason, suggestions: TEMPLATES.slice(0, 3).map(suggestionOf) },
      {
        id: answerId, question, outcome: 'unanswerable',
        templateId: routed.kind === 'probe' ? String(routed.probe.id) : String(routed.template.id),
        sqlText: null, checks: null, tablesTouched: null, rowCount: null,
        elapsedMs: Date.now() - startedAt, traceId, answer: null,
        reason: generated.reason, failureCode: null,
      },
    );
    return;
  }

  const plan = generated.plan;
  const trace = generated.trace;
  const cost =
    trace === null
      ? `${plan.text.split('\n').length} lines, ${plan.parameters.length} bound value(s)`
      : `${trace.model} · ${trace.promptTokens + trace.completionTokens} tokens`;
  yield finish('generate', cost);

  // -- 4. guard ------------------------------------------------------------
  yield begin('guard');
  const verdict = guard(plan.text, plan.parameters);
  const failed = verdict.checks.filter((c) => c.verdict === 'fail');
  yield finish('guard', `${verdict.checks.length - failed.length} of ${verdict.checks.length} checks passed`);

  if (!verdict.ok) {
    const reason =
      routed.kind === 'probe'
        ? routed.probe.explanation
        : failed[0]?.detail ?? 'The statement did not pass the safety checks.';

    for (const stage of ['execute', 'choose-form'] as const) {
      yield skip(stage, 'Not reached — the statement was refused.');
    }
    yield await settle(
      { status: 'blocked', reason, sql: verdict.sql, checks: verdict.checks },
      {
        id: answerId, question, outcome: 'blocked',
        templateId: routed.kind === 'probe' ? String(routed.probe.id) : String(routed.template.id),
        sqlText: verdict.sql, checks: verdict.checks, tablesTouched: verdict.tables,
        rowCount: null, elapsedMs: Date.now() - startedAt, traceId, answer: null, reason, failureCode: null,
      },
    );
    return;
  }

  // A probe that passed the Guard would be a serious defect, not a valid answer.
  if (routed.kind === 'probe') {
    throw new Error(`Adversarial probe ${String(routed.probe.id)} passed the Guard.`);
  }
  const template = routed.template;

  // -- 5. execute ----------------------------------------------------------
  yield begin('execute');
  const executed = await executeReadOnly(verdict.sql, plan.parameters);

  if (!executed.ok) {
    yield finish('execute', executed.message);
    yield skip('choose-form', 'Not reached — the query did not complete.');
    yield await settle(
      { status: 'failed', code: executed.code, message: executed.message, traceId },
      {
        id: answerId, question, outcome: 'failed', templateId: String(template.id),
        sqlText: verdict.sql, checks: verdict.checks, tablesTouched: verdict.tables,
        rowCount: null, elapsedMs: Date.now() - startedAt, traceId, answer: null,
        reason: executed.message, failureCode: executed.code,
      },
    );
    return;
  }
  yield finish('execute', `${executed.rowCount.toLocaleString()} rows in ${executed.elapsedMs}ms`);

  // -- 6. choose form ------------------------------------------------------
  yield begin('choose-form');
  const source = `Halcyon — ${template.tables.join(', ')}`;
  const presentation = choosePresentation(executed.columns, executed.rows, source, {
    preferred: template.form,
    title: template.figureTitle,
    ...(template.measure === undefined ? {} : { measure: template.measure }),
  });
  const narration = narrate(template, executed.rows);
  yield finish('choose-form', presentation.form);

  const elapsedMs = Date.now() - startedAt;

  const answer: Answer = {
    id: answerId,
    question,
    filedAt: new Date().toISOString(),
    templateId: template.id,
    kicker: `${template.tables[0]?.replace(/_/g, ' ') ?? 'analysis'} · ${elapsedMs}ms · ${executed.rowCount.toLocaleString()} rows`.toUpperCase(),
    headline: narration.headline,
    standfirst: narration.standfirst,
    kpis: narration.kpis,
    form: presentation.form,
    columns: presentation.columns,
    rows: presentation.rows,
    chart: presentation.chart,
    formRationale: presentation.rationale,
    assumptions: narration.assumptions,
    related: template.related
      .map((id) => TEMPLATES.find((t) => t.id === id))
      .filter((t): t is QuestionTemplate => t !== undefined)
      .map(suggestionOf),
    audit: {
      sql: verdict.sql,
      parameters: plan.parameters,
      tables: verdict.tables,
      checks: verdict.checks,
      planCost: executed.planCost,
      rowCount: executed.rowCount,
      elapsedMs,
      stageTimings: timings,
      generator: trace,
    },
  };

  yield await settle(
    { status: 'answered', answer },
    {
      id: answerId, question, outcome: 'answered', templateId: String(template.id),
      sqlText: verdict.sql, checks: verdict.checks, tablesTouched: verdict.tables,
      rowCount: executed.rowCount, elapsedMs, traceId, answer, reason: null, failureCode: null,
    },
  );
}
