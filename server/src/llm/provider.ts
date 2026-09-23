import { buildSql } from '../catalogue/sql.js';
import { route } from '../catalogue/router.js';
import { findProbe } from '../catalogue/probes.js';

/**
 * The provider contract.
 *
 * Deliberately the shape a hosted completion API has — messages in, content and
 * a token count out — so that swapping the mock for a real provider is an
 * implementation of this interface and a key in the environment, not a change
 * to anything that calls it.
 */

export type Role = 'system' | 'user' | 'assistant';

export interface Message {
  readonly role: Role;
  readonly content: string;
}

export interface CompletionRequest {
  readonly model: string;
  readonly messages: readonly Message[];
  readonly temperature: number;
}

export interface Usage {
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly totalTokens: number;
}

export interface CompletionResponse {
  readonly model: string;
  /** The raw reply. Untrusted: the caller parses and validates it. */
  readonly content: string;
  readonly usage: Usage;
  readonly finishReason: 'stop' | 'length' | 'refusal';
}

export interface LlmProvider {
  readonly name: string;
  complete(request: CompletionRequest): Promise<CompletionResponse>;
}

const CHARS_PER_TOKEN = 4;
const approxTokens = (text: string): number => Math.ceil(text.length / CHARS_PER_TOKEN);

const lastUserMessage = (messages: readonly Message[]): string => {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message?.role === 'user') return message.content;
  }
  return '';
};

/**
 * Resolves a question the way the model is pretending to.
 *
 * The catalogue does the thinking. That is the whole substitution: everything
 * around it — the schema context, the message roles, the token accounting, the
 * untrusted JSON reply — is the real shape of talking to a model, and only the
 * inference in the middle is deterministic. See ADR-0010.
 *
 * Probes are answered with the unsafe SQL they carry, because a generator that
 * can only produce safe statements cannot demonstrate a Guard.
 */
function infer(question: string): string {
  const probe = findProbe(question);
  if (probe) {
    return JSON.stringify({ answerable: true, sql: probe.sql, parameters: probe.parameters });
  }

  const routing = route(question);
  if (!routing.matched) {
    return JSON.stringify({
      answerable: false,
      reason: 'The schema does not hold what this question asks for.',
    });
  }

  const plan = buildSql(routing.template);
  return JSON.stringify({ answerable: true, sql: plan.text, parameters: plan.parameters });
}

export const MOCK_MODEL = 'halcyon-sql-mock-1';

/**
 * A provider that answers from the Question Catalogue instead of a network.
 *
 * Genuinely async so the call site is written the way it would be against a
 * real endpoint, but it does not pretend to take time it is not taking — the
 * stage reports what it actually cost, per ADR-0007.
 */
export const mockProvider: LlmProvider = {
  name: 'mock',
  async complete(request) {
    const prompt = request.messages.map((m) => m.content).join('\n');
    const content = infer(lastUserMessage(request.messages));

    return {
      model: request.model,
      content,
      usage: {
        promptTokens: approxTokens(prompt),
        completionTokens: approxTokens(content),
        totalTokens: approxTokens(prompt) + approxTokens(content),
      },
      finishReason: 'stop',
    };
  },
};
