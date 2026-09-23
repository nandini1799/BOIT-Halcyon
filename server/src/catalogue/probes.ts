import { ADVERSARIAL_PROBES, type AdversarialProbe } from './adversarial.js';

const normalise = (question: string): string => question.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Probes are matched on the exact question the UI offers, not by routing.
 * Nobody stumbles into an unsafe statement by phrasing a real question oddly.
 *
 * This lives beside the catalogue rather than in the pipeline because the mock
 * provider resolves probes too: the unsafe statement has to come out of the
 * generator for the Guard to be seen refusing generated SQL.
 */
export function findProbe(question: string): AdversarialProbe | null {
  const asked = normalise(question);
  return ADVERSARIAL_PROBES.find((probe) => normalise(probe.question) === asked) ?? null;
}
