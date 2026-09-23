import type { AdversarialProbe } from '../catalogue/adversarial.js';
import { buildSql, type SqlPlan } from '../catalogue/sql.js';
import type { QuestionTemplate } from '../catalogue/types.js';
import { config } from '../lib/config.js';
import { generateSql, type LlmTrace } from '../llm/generator.js';

export type Routed =
  | { readonly kind: 'template'; readonly template: QuestionTemplate }
  | { readonly kind: 'probe'; readonly probe: AdversarialProbe };

export interface GenerationRequest {
  /** The question as asked. What a model would be given. */
  readonly question: string;
  /** What routing decided. What a generator that does not read questions needs. */
  readonly routed: Routed;
}

export type Generated =
  | { readonly ok: true; readonly plan: SqlPlan; readonly trace: LlmTrace | null }
  | { readonly ok: false; readonly reason: string; readonly trace: LlmTrace | null };

/**
 * How SQL gets made.
 *
 * Asynchronous and given the question rather than a pre-resolved template,
 * because that is what a generator which actually reads the question needs —
 * see ADR-0010. The earlier shape took only the routed template, which meant
 * the interface could not have accepted a model without being rewritten first.
 *
 * The Guard, the read-only role and the audit log all sit after this boundary
 * precisely because a generator cannot be trusted the way a template can.
 */
export interface SqlGenerator {
  readonly name: string;
  generate(request: GenerationRequest): Promise<Generated>;
}

/** The catalogue, with no provider in front of it. */
export const catalogueGenerator: SqlGenerator = {
  name: 'catalogue',
  generate({ routed }) {
    const plan =
      routed.kind === 'template'
        ? buildSql(routed.template)
        : { text: routed.probe.sql, parameters: routed.probe.parameters };

    return Promise.resolve({ ok: true, plan, trace: null });
  },
};

/**
 * The mock provider, given the question and the cached schema context.
 *
 * It resolves the question through the same catalogue, so the statement that
 * reaches the Guard is identical either way. What differs is everything around
 * it: the context, the message roles, the token accounting, and a reply that
 * arrives as untrusted JSON and has to be parsed before it can be believed.
 */
export const llmGenerator: SqlGenerator = {
  name: 'mock-llm',
  async generate({ question }) {
    const result = await generateSql(question);

    return result.ok
      ? { ok: true, plan: result.plan, trace: result.trace }
      : { ok: false, reason: result.reason, trace: result.trace };
  },
};

export function generatorFor(provider: typeof config.LLM_PROVIDER): SqlGenerator {
  switch (provider) {
    case 'mock':
      return llmGenerator;
    case 'catalogue':
      return catalogueGenerator;
    default: {
      const exhaustive: never = provider;
      throw new Error(`Unhandled generator: ${String(exhaustive)}`);
    }
  }
}

export const activeGenerator = (): SqlGenerator => generatorFor(config.LLM_PROVIDER);
