import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getBudgetPeriodDates, calculateBudgetStats } from '../src/utils/budgetEngine.ts';
process.env.TZ = 'America/Santiago';
test('weekly period crossing a month ends on its own Sunday', () => {
  const { start, end } = getBudgetPeriodDates('weekly', new Date(2026, 9, 4, 12));
  assert.equal(start.getMonth(), 8); assert.equal(start.getDate(), 28);
  assert.equal(end.getMonth(), 9); assert.equal(end.getDate(), 4);
});
test('date-only expenses keep Monday in the local week and exclude the next week', () => {
  const budget = { category_id: 'transport', period: 'weekly', limit_amount: 20000, alert_threshold: 80 };
  const transactions = ['2026-09-28', '2026-10-04', '2026-10-05'].map(date => ({ category_id: 'transport', type: 'expense', date, amount: 100 }));
  assert.equal(calculateBudgetStats([budget], transactions, [], new Date(2026, 9, 4, 12))[0].spent, 200);
});
