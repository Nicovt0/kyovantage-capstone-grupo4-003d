import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  calculateCommittedExpenses,
  calculateNetAvailability,
} from '../src/features/dashboard/services/availabilityCalculator.ts';

describe('availabilityCalculator - Service Unit Tests', () => {
  const refDate = new Date('2026-10-05T12:00:00Z');

  describe('calculateCommittedExpenses', () => {
    it('correctly sums pending expenses for the reference month', () => {
      const templates = [
        {
          id: '1',
          name: 'Arriendo',
          amount: 450000,
          expected_amount: 450000,
          type: 'expense',
          status: 'pending',
          due_date: '2026-10-10',
          frequency: 'monthly',
        },
        {
          id: '2',
          name: 'Internet',
          amount: 25000,
          expected_amount: 25000,
          type: 'expense',
          status: 'pending',
          due_date: '2026-10-20',
          frequency: 'monthly',
        },
      ];

      const result = calculateCommittedExpenses(templates, refDate);
      assert.equal(result, 475000);
    });

    it('excludes commitments with status paid to prevent double accounting', () => {
      const templates = [
        {
          id: '1',
          name: 'Gastos Comunes (Pagado)',
          amount: 60000,
          expected_amount: 60000,
          type: 'expense',
          status: 'paid',
          due_date: '2026-10-02',
          frequency: 'monthly',
        },
        {
          id: '2',
          name: 'Luz (Pendiente)',
          amount: 30000,
          expected_amount: 30000,
          type: 'expense',
          status: 'pending',
          due_date: '2026-10-15',
          frequency: 'monthly',
        },
      ];

      const result = calculateCommittedExpenses(templates, refDate);
      assert.equal(result, 30000);
    });

    it('excludes income templates from committed expenses', () => {
      const templates = [
        {
          id: '1',
          name: 'Sueldo',
          amount: 1200000,
          expected_amount: 1200000,
          type: 'income',
          status: 'pending',
          due_date: '2026-10-01',
          frequency: 'monthly',
        },
        {
          id: '2',
          name: 'Seguro',
          amount: 15000,
          expected_amount: 15000,
          type: 'expense',
          status: 'pending',
          due_date: '2026-10-12',
          frequency: 'monthly',
        },
      ];

      const result = calculateCommittedExpenses(templates, refDate);
      assert.equal(result, 15000);
    });

    it('filters out commitments outside the current reference month', () => {
      const templates = [
        {
          id: '1',
          name: 'Compromiso Noviembre',
          amount: 100000,
          expected_amount: 100000,
          type: 'expense',
          status: 'pending',
          due_date: '2026-11-05',
          frequency: 'monthly',
        },
        {
          id: '2',
          name: 'Compromiso Octubre',
          amount: 50000,
          expected_amount: 50000,
          type: 'expense',
          status: 'pending',
          due_date: '2026-10-15',
          frequency: 'monthly',
        },
      ];

      const result = calculateCommittedExpenses(templates, refDate);
      assert.equal(result, 50000);
    });

    it('handles empty inputs or inactive templates gracefully', () => {
      assert.equal(calculateCommittedExpenses([], refDate), 0);
      const inactiveTemplates = [
        {
          id: '1',
          name: 'Subscripción Inactiva',
          amount: 8000,
          type: 'expense',
          status: 'pending',
          due_date: '2026-10-15',
          is_active: false,
        },
      ];
      assert.equal(calculateCommittedExpenses(inactiveTemplates, refDate), 0);
    });
  });

  describe('calculateNetAvailability', () => {
    it('returns status "healthy" when net available buffer is >= 15%', () => {
      const result = calculateNetAvailability(1000000, 400000);
      assert.equal(result.netAvailable, 600000);
      assert.equal(result.committedTotal, 400000);
      assert.equal(result.status, 'healthy');
    });

    it('returns status "warning" when net available buffer is less than 15%', () => {
      const result = calculateNetAvailability(1000000, 880000);
      assert.equal(result.netAvailable, 120000);
      assert.equal(result.committedTotal, 880000);
      assert.equal(result.status, 'warning');
    });

    it('returns status "deficit" when committed expenses exceed total balance', () => {
      const result = calculateNetAvailability(500000, 650000);
      assert.equal(result.netAvailable, -150000);
      assert.equal(result.committedTotal, 650000);
      assert.equal(result.status, 'deficit');
    });

    it('handles zero balance scenarios correctly', () => {
      const zeroWithCommitment = calculateNetAvailability(0, 50000);
      assert.equal(zeroWithCommitment.netAvailable, -50000);
      assert.equal(zeroWithCommitment.status, 'deficit');

      const zeroNoCommitment = calculateNetAvailability(0, 0);
      assert.equal(zeroNoCommitment.netAvailable, 0);
      assert.equal(zeroNoCommitment.status, 'healthy');
    });
  });
});
