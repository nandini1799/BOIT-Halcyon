import { TEMPLATES } from './templates.js';
import type { QuestionTemplate } from './types.js';

export type RouteResult =
  | { readonly matched: true; readonly template: QuestionTemplate; readonly score: number }
  | { readonly matched: false; readonly suggestions: readonly QuestionTemplate[] };

/** Lower-cased, punctuation stripped, whitespace collapsed, padded for word-boundary tests. */
function normalise(question: string): string {
  return ` ${question.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim()} `;
}

interface Scored {
  readonly template: QuestionTemplate;
  /** How many of the required synonym groups the question satisfies. */
  readonly satisfied: number;
  readonly total: number;
  /** Longer phrase matches count for more, so the most specific template wins. */
  readonly score: number;
}

function scoreAgainst(template: QuestionTemplate, question: string): Scored {
  let satisfied = 0;
  let score = 0;

  for (const group of template.requires) {
    const hit = group.find((term) => question.includes(` ${term} `));
    if (hit !== undefined) {
      satisfied++;
      score += hit.split(' ').length;
    }
  }

  return { template, satisfied, total: template.requires.length, score };
}

const MAX_SUGGESTIONS = 3;

export function route(question: string): RouteResult {
  const normalised = normalise(question);
  const scored = TEMPLATES.map((template) => scoreAgainst(template, normalised));

  const complete = scored
    .filter((s) => s.satisfied === s.total)
    .sort((a, b) => b.score - a.score || b.total - a.total);

  const best = complete[0];
  if (best) return { matched: true, template: best.template, score: best.score };

  // Nothing answerable. Offer the closest things we can do, so the dead end is
  // a signpost rather than a refusal.
  const suggestions = scored
    .filter((s) => s.satisfied > 0)
    .sort((a, b) => b.satisfied / b.total - a.satisfied / a.total || b.score - a.score)
    .slice(0, MAX_SUGGESTIONS)
    .map((s) => s.template);

  return { matched: false, suggestions };
}
