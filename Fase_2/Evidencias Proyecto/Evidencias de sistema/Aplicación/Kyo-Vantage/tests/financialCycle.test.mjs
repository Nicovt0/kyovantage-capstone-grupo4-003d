import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { financialCycleForMonth, getFinancialCycle, isInFinancialCycle, cycleDays } from '../src/utils/financialCycle.ts';
import { calculateBudgetStats, getBudgetPeriodDates } from '../src/utils/budgetEngine.ts';
import { calculateCommittedExpenses } from '../src/features/dashboard/services/availabilityCalculator.ts';
import { getOccurrencesInDateRange } from '../src/modules/agenda/services/eventRepository.ts';

function load(path, globals) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8').replace(/^import .*;\r?$/gm, '');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(output, { exports, ...globals });
  return exports;
}
const local = (year, month, day) => new Date(year, month - 1, day, 12);

test('cutoff 2 includes Nov 2 and Dec 1, excludes Nov 1 and Dec 2', () => {
  const cycle = getFinancialCycle(local(2026, 11, 20), 2);
  assert.equal(cycle.start.getDate(), 2);
  assert.equal(cycle.start.getMonth(), 10);
  for (const [date, expected] of [['2026-11-01', false], ['2026-11-02', true], ['2026-12-01', true], ['2026-12-02', false]]) assert.equal(isInFinancialCycle(date, cycle), expected);
  assert.equal(getFinancialCycle(local(2026, 11, 1), 2).start.getMonth(), 9);
});

test('all cutoffs remain consecutive without gaps/overlap across leap years and December', () => {
  for (const year of [2024, 2026, 2027]) for (let month = 0; month < 12; month++) for (let day = 1; day <= 31; day++) {
    const cycle = financialCycleForMonth(year, month, day);
    const next = financialCycleForMonth(year, month + 1, day);
    assert.equal(cycle.nextStart.getTime(), next.start.getTime());
    assert.equal(cycle.end.getTime() + 1, next.start.getTime());
    assert.equal(isInFinancialCycle(next.start, cycle), false);
    assert.ok(cycleDays(cycle).length >= 28 && cycleDays(cycle).length <= 31);
  }
  assert.equal(financialCycleForMonth(2024, 1, 31).start.getDate(), 29);
  assert.equal(financialCycleForMonth(2026, 1, 31).start.getDate(), 28);
});

test('monthly budgets, rollover and liquidity share the financial period', () => {
  const budget = { id: 'b', category_id: 'food', period: 'monthly', start_date: '2026-10-02', recurrent: true, rollover: true, limit_amount: 100, alert_threshold: 80 };
  const tx = (id, date, amount) => ({ id, category_id: 'food', type: 'expense', date, amount });
  const rows = [tx('old', '2026-10-10', 40), tx('prior', '2026-11-01', 10), tx('now', '2026-11-02', 20), tx('end', '2026-12-01', 30), tx('next', '2026-12-02', 999)];
  const [stats] = calculateBudgetStats([budget], rows, [], local(2026, 11, 20), 2);
  assert.equal(stats.spent, 50);
  assert.equal(stats.current_limit, 150);
  const events = rows.map(row => ({ ...row, due_date: row.date, status: 'pending', frequency: 'once' }));
  assert.equal(calculateCommittedExpenses(events, local(2026, 11, 20), 2), 50);
  assert.equal(getBudgetPeriodDates('monthly', local(2026, 11, 1), 2).start.getMonth(), 9);
  assert.equal(getBudgetPeriodDates('monthly', local(2026, 11, 20)).start.getDate(), 1);
});

test('clamped February cycles retain both actual recurring occurrences when necessary', () => {
  const cycle = financialCycleForMonth(2026, 1, 31);
  const dates = getOccurrencesInDateRange({ frequency: 'monthly', payment_day: 30 }, cycle.start, cycle.end);
  assert.equal(dates.length, 2);
  assert.equal(dates[0].getDate(), 28);
  assert.equal(dates[0].getMonth(), 1);
  assert.equal(dates[1].getDate(), 30);
  assert.equal(dates[1].getMonth(), 2);
});

test('financial settings persist only the existing owner profile fields, including zero income', async () => {
  let payload;
  const filters = [];
  const query = { select() { return this; }, eq(key, value) { filters.push([key, value]); return this; }, update(value) { payload = value; return this; }, single: async () => ({ data: payload || { financial_cycle_start_day: 2, monthly_estimated_income: '500000' }, error: null }) };
  const api = load('../src/features/settings/api/financialSettingsRepository.ts', { USE_MOCKS: false, createClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: 'owner' } } }) }, from: table => { assert.equal(table, 'profiles'); return query; } }) });
  assert.equal((await api.getFinancialSettings()).monthly_estimated_income, 500000);
  await api.saveFinancialSettings({ financial_cycle_start_day: 31, monthly_estimated_income: 0, role: 'admin' });
  assert.equal(Object.keys(payload).sort().join(','), 'financial_cycle_start_day,monthly_estimated_income');
  assert.equal(payload.monthly_estimated_income, 0);
  assert.ok(filters.every(([key, value]) => key === 'id' && value === 'owner'));
  for (const day of [0, 32, 1.5]) await assert.rejects(api.saveFinancialSettings({ financial_cycle_start_day: day, monthly_estimated_income: 0 }), /entre 1 y 31/);
  for (const income of [-1, NaN, Infinity, 1.5]) await assert.rejects(api.saveFinancialSettings({ financial_cycle_start_day: 1, monthly_estimated_income: income }), /monto mensual/);
});

test('failed profile loads do not pretend the user uses calendar months', async () => {
  const api = load('../src/features/settings/api/financialSettingsRepository.ts', { USE_MOCKS: false, createClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: 'owner' } } }) }, from: () => ({ select() { return this; }, eq() { return this; }, single: async () => ({ data: null, error: { message: 'permission denied' } }) }) }) });
  await assert.rejects(api.getFinancialSettings(), /permission denied/);
});

test('saving preferences updates the owner cache and invalidates dependent periods', async () => {
  let changed;
  let predicate;
  const api = load('../src/features/settings/hooks/useFinancialSettings.ts', { useAuth: () => ({ auth: { id: 'owner' } }), useQueryClient: () => ({ setQueryData: (key, value) => { changed = [key, value]; }, invalidateQueries: async options => { predicate = options.predicate; } }), useMutation: options => options, saveFinancialSettings: () => {} });
  await api.useSaveFinancialSettings().onSuccess({ financial_cycle_start_day: 2, monthly_estimated_income: 100 });
  assert.equal(changed[0].join('/'), 'private/owner/financial-settings');
  assert.equal(predicate({ queryKey: ['private', 'owner', 'financial-settings'] }), false);
  for (const key of [['private', 'owner', 'budget'], ['agenda', 'templates'], ['wallet'], ['availability']]) assert.equal(predicate({ queryKey: key }), true);
  assert.equal(predicate({ queryKey: ['private', 'other', 'budget'] }), false);
});
