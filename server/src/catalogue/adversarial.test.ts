import { SAFETY_CHECK_IDS } from '@halcyon/shared';
import { describe, expect, it } from 'vitest';
import { guard } from '../pipeline/guard.js';
import { ADVERSARIAL_PROBES } from './adversarial.js';

const cases = ADVERSARIAL_PROBES.map((probe) => [String(probe.id), probe] as const);

/**
 * The probes exist so the Guard has something real to refuse, and so the
 * blocked state in the UI is reachable by asking rather than by contrivance.
 *
 * If any probe ever passes the Guard, this suite fails and the build stops.
 * That is the point: the strongest claim the product makes is checked on every
 * run rather than demonstrated once in a screenshot.
 */
describe('the adversarial probes', () => {
  it.each(cases)('%s is refused', (_id, probe) => {
    const result = guard(probe.sql, probe.parameters);

    expect(result.ok).toBe(false);
  });

  it.each(cases)('%s is refused by the check it targets', (_id, probe) => {
    const result = guard(probe.sql, probe.parameters);

    expect(result.checks.find((c) => c.id === probe.fails)?.verdict).toBe('fail');
  });

  it('exercises every safety check, so none of the five is merely asserted', () => {
    expect([...new Set(ADVERSARIAL_PROBES.map((p) => p.fails))].sort()).toEqual(
      [...SAFETY_CHECK_IDS].sort(),
    );
  });
});
