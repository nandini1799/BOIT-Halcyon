import { z } from 'zod';
import type { CellValue } from '@halcyon/shared';
import type { SqlPlan } from '../catalogue/sql.js';
import { config } from '../lib/config.js';
import { mockProvider, type LlmProvider, type Message } from './provider.js';
import { isSchemaContextCached, schemaContext } from './schema-context.js';

/**
 * What the generate stage records about the call it made. Shown under "Notes on
 * this answer": a generator the reader cannot inspect is one they must take on
 * trust, which is the opposite of what this product argues for.
 */
export interface LlmTrace {
  readonly provider: string;
  readonly model: string;
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly contextTokens: number;
  /** Whether the schema context was served from cache rather than rebuilt. */
  readonly contextCached: boolean;
}

export type GenerationResult =
  | { readonly ok: true; readonly plan: SqlPlan; readonly trace: LlmTrace }
  | { readonly ok: false; readonly reason: string; readonly trace: LlmTrace };

/**
 * The reply, as a shape rather than a promise.
 *
 * Everything past this point treats the statement as hostile anyway — that is
 * what the Guard is — but a reply that is not even the right shape should fail
 * here, with a sentence explaining what arrived, rather than reaching the
 * parser as `undefined`.
 */
const completionSchema = z.discriminatedUnion('answerable', [
  z.object({
    answerable: z.literal(true),
    sql: z.string().min(1),
    parameters: z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])),
  }),
  z.object({
    answerable: z.literal(false),
    reason: z.string().min(1),
  }),
]);

const TEMPERATURE = 0;

/**
 * Asks the provider for a statement.
 *
 * The schema context is the system message and the question is the user
 * message, so the context is assembled once per process rather than once per
 * question. At roughly 560 tokens that is the difference between paying for the
 * schema on every request and paying for it never.
 */
export async function generateSql(question: string, provider: LlmProvider = mockProvider): Promise<GenerationResult> {
  const cachedBefore = isSchemaContextCached();
  const context = schemaContext();

  const messages: readonly Message[] = [
    { role: 'system', content: context.text },
    { role: 'user', content: question },
  ];

  const completion = await provider.complete({
    model: config.LLM_MODEL,
    messages,
    temperature: TEMPERATURE,
  });

  const trace: LlmTrace = {
    provider: provider.name,
    model: completion.model,
    promptTokens: completion.usage.promptTokens,
    completionTokens: completion.usage.completionTokens,
    contextTokens: context.tokensApprox,
    contextCached: cachedBefore,
  };

  let parsed: unknown;
  try {
    parsed = JSON.parse(completion.content);
  } catch {
    return { ok: false, reason: 'The generator returned something that was not JSON.', trace };
  }

  const validated = completionSchema.safeParse(parsed);
  if (!validated.success) {
    return { ok: false, reason: 'The generator returned JSON of an unexpected shape.', trace };
  }

  if (!validated.data.answerable) {
    return { ok: false, reason: validated.data.reason, trace };
  }

  return {
    ok: true,
    plan: {
      text: validated.data.sql,
      parameters: validated.data.parameters as readonly CellValue[],
    },
    trace,
  };
}
