import { describe, expect, it } from 'vitest';
import type { Column, Row } from '@halcyon/shared';
import { choosePresentation } from './choose-form.js';

/**
 * Choosing the form is the last place a truthful query can still produce a
 * misleading picture, so these tests are written about what the reader ends up
 * seeing rather than about the branch that produced it.
 */

const month: Column = { key: 'month', label: 'Month', type: 'date' };
const value: Column = { key: 'total_value_gbp', label: 'Total value (GBP)', type: 'currency' };
const count: Column = { key: 'transactions', label: 'Transactions', type: 'number' };
const rate: Column = { key: 'approval_rate', label: 'Approval rate', type: 'percent' };
const branch: Column = { key: 'branch', label: 'Branch', type: 'text' };

const months = (n: number): Row[] =>
  Array.from({ length: n }, (_, i) => ({
    month: `2025-${String(i + 1).padStart(2, '0')}-01`,
    total_value_gbp: 150_000_000 + i,
    transactions: 21_000 + i,
    approval_rate: 0.6,
  }));

const hints = { title: 'Transaction value by month' };

describe('choosing how an answer is drawn', () => {
  describe('a line chart shares one axis, so its series must share a unit', () => {
    it('does not plot a count of transactions against their value in pounds', () => {
      const result = choosePresentation([month, value, count], months(12), 'transactions', {
        ...hints,
        preferred: 'line',
        measure: 'total_value_gbp',
      });

      expect(result.form).toBe('line');
      expect(result.chart?.seriesKeys).toEqual(['total_value_gbp']);
    });

    it('says in the rail that a column was left out, rather than dropping it silently', () => {
      const result = choosePresentation([month, value, count], months(12), 'transactions', {
        ...hints,
        preferred: 'line',
        measure: 'total_value_gbp',
      });

      expect(result.rationale).toMatch(/1 further column is measured in other units/);
    });

    it('still returns every column to the table, so nothing is hidden from the reader', () => {
      const result = choosePresentation([month, value, count], months(12), 'transactions', {
        ...hints,
        preferred: 'line',
        measure: 'total_value_gbp',
      });

      expect(result.columns.map((c) => c.key)).toEqual(['month', 'total_value_gbp', 'transactions']);
    });

    it('plots both series where the units genuinely match', () => {
      const fees: Column = { key: 'fees_gbp', label: 'Fees (GBP)', type: 'currency' };
      const result = choosePresentation([month, value, fees], months(12), 'transactions', {
        ...hints,
        preferred: 'line',
        measure: 'total_value_gbp',
      });

      expect(result.chart?.seriesKeys).toEqual(['total_value_gbp', 'fees_gbp']);
      expect(result.rationale).not.toMatch(/left to the table/);
    });

    it('plots the declared measure even when another column of the same unit comes first', () => {
      const result = choosePresentation([month, count, value], months(12), 'transactions', {
        ...hints,
        preferred: 'line',
        measure: 'total_value_gbp',
      });

      expect(result.chart?.seriesKeys).toEqual(['total_value_gbp']);
    });

    it('draws a single measure without complaint', () => {
      const result = choosePresentation([month, rate], months(12), 'onboarding_applications', {
        title: 'Approval rate by month',
        preferred: 'line',
        measure: 'approval_rate',
      });

      expect(result.chart?.seriesKeys).toEqual(['approval_rate']);
      expect(result.rationale).toBe('The result is measured over time, so it is drawn as a line.');
    });
  });

  describe('forms the data vetoes', () => {
    it('tabulates an empty result rather than drawing an empty chart', () => {
      const result = choosePresentation([month, value], [], 'transactions', hints);

      expect(result.form).toBe('table');
      expect(result.chart).toBeNull();
    });

    it('shows a single figure as a figure, not as a line through one point', () => {
      const result = choosePresentation([month, value], months(1), 'transactions', {
        ...hints,
        preferred: 'line',
      });

      expect(result.form).toBe('kpi');
      expect(result.chart).toBeNull();
    });
  });

  describe('bars', () => {
    it('compares named categories on the declared measure alone', () => {
      const rows: Row[] = [
        { branch: 'Leeds', total_value_gbp: 4, transactions: 1 },
        { branch: 'Hull', total_value_gbp: 3, transactions: 2 },
      ];
      const result = choosePresentation([branch, value, count], rows, 'transactions', {
        title: 'Transaction value by branch',
        preferred: 'bar',
        measure: 'total_value_gbp',
      });

      expect(result.form).toBe('bar');
      expect(result.chart?.seriesKeys).toEqual(['total_value_gbp']);
    });
  });
});
