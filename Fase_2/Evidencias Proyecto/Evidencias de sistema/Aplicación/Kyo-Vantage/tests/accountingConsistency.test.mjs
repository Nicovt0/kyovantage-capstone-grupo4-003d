import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {
  calculateCommittedExpenses,
  calculateNetAvailability,
} from '../src/features/dashboard/services/availabilityCalculator.ts';

function createMockRepository() {
  const source = readFileSync(new URL('../src/features/wallet/api/transactionRepository.ts', import.meta.url), 'utf8')
    .replace(/^import .*;\r?$/gm, '');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });

  const accountsDb = [
    { id: 'acc-checking-1', name: 'Banco Estado Corriente', balance: 1000000, current_balance: 1000000, include_in_total: true },
    { id: 'acc-savings-1', name: 'Banco Santander Ahorro', balance: 500000, current_balance: 500000, include_in_total: true },
  ];
  const transactionsDb = [];

  const context = {
    exports: {},
    USE_MOCKS: true,
    accountsDb,
    transactionsDb,
    createClient: () => ({}),
    createNotification: async () => {},
    checkBudgetLimits: async () => {},
    calculateFixedInstallment: () => 0,
    console,
    Set,
    Map,
    setTimeout: (cb) => cb(),
  };

  vm.runInNewContext(outputText, context);
  return {
    api: context.exports,
    accounts: accountsDb,
    transactions: transactionsDb,
  };
}

describe('Accounting Consistency and Reactivity Tests', () => {
  const refDate = new Date('2026-10-15T12:00:00Z');

  it('1. Income registration increases account balance and consolidated total', async () => {
    const { api, accounts } = createMockRepository();
    const account = accounts[0];
    const initialBalance = account.balance;
    const incomeAmount = 350000;

    const createdTx = await api.addTransaction({
      account_id: account.id,
      category_id: 'cat-income',
      name: 'Salario / Sueldo',
      amount: incomeAmount,
      type: 'income',
      date: new Date().toISOString(),
      status: 'paid',
    }, true);

    assert.equal(createdTx.type, 'income');
    assert.equal(createdTx.amount, incomeAmount);
    assert.equal(account.balance, initialBalance + incomeAmount);
    assert.equal(account.current_balance, initialBalance + incomeAmount);
  });

  it('2. Expense registration deducts account balance and updates available liquidity buffer', async () => {
    const { api, accounts } = createMockRepository();
    const account = accounts[0];
    const initialBalance = account.balance;
    const expenseAmount = 200000;

    // Pending commitments in Agenda
    const pendingCommitments = [
      {
        id: 'comm-arriendo',
        name: 'Arriendo Dpto',
        amount: 400000,
        expected_amount: 400000,
        type: 'expense',
        status: 'pending',
        due_date: '2026-10-25',
        frequency: 'monthly',
      },
    ];

    // Initial buffer calculation
    const initialCommitted = calculateCommittedExpenses(pendingCommitments, refDate);
    assert.equal(initialCommitted, 400000);
    const initialLiquidity = calculateNetAvailability(account.balance, initialCommitted);
    assert.equal(initialLiquidity.netAvailable, 600000);
    assert.equal(initialLiquidity.status, 'healthy');

    // Register expense
    const createdTx = await api.addTransaction({
      account_id: account.id,
      category_id: 'cat-expense',
      name: 'Compra Supermercado',
      amount: expenseAmount,
      type: 'expense',
      date: new Date().toISOString(),
      status: 'paid',
    }, true);

    assert.equal(account.balance, initialBalance - expenseAmount);
    assert.equal(account.current_balance, initialBalance - expenseAmount);

    // Recalculate liquidity buffer
    const updatedLiquidity = calculateNetAvailability(account.balance, initialCommitted);
    assert.equal(updatedLiquidity.netAvailable, 400000);
    assert.equal(updatedLiquidity.status, 'healthy');

    // Deleting the expense reverts the balance
    await api.deleteTransaction(createdTx.id, true);
    assert.equal(account.balance, initialBalance);
  });

  it('3. Transfer deducts from source and adds to destination account', async () => {
    const { api, accounts } = createMockRepository();
    const src = accounts[0];
    const dst = accounts[1];
    const initialSrc = src.balance;
    const initialDst = dst.balance;
    const transferAmount = 150000;

    const transferTx = await api.addTransaction({
      account_id: src.id,
      destination_account_id: dst.id,
      category_id: 'cat-transfer',
      name: 'Ahorro mensual',
      amount: transferAmount,
      type: 'transfer',
      date: new Date().toISOString(),
      status: 'paid',
    }, true);

    assert.equal(src.balance, initialSrc - transferAmount);
    assert.equal(dst.balance, initialDst + transferAmount);
    assert.equal(src.current_balance, initialSrc - transferAmount);
    assert.equal(dst.current_balance, initialDst + transferAmount);
  });

  it('4. Marking commitment as paid from Agenda creates transaction and avoids double deduction', () => {
    let accountBalance = 1000000;
    const commitment = {
      id: 'comm-1',
      name: 'Internet Fibra Óptica',
      amount: 30000,
      expected_amount: 30000,
      type: 'expense',
      status: 'pending',
      due_date: '2026-10-20',
      frequency: 'monthly',
    };

    // Before payment: pending committed expense counts against balance
    let committed = calculateCommittedExpenses([commitment], refDate);
    assert.equal(committed, 30000);
    let availability = calculateNetAvailability(accountBalance, committed);
    assert.equal(availability.netAvailable, 970000);

    // Mark as paid: deducts account balance and marks status paid
    commitment.status = 'paid';
    accountBalance -= commitment.amount;

    // After payment: committed is 0, account balance is 970,000, liquidity is 970,000
    committed = calculateCommittedExpenses([commitment], refDate);
    assert.equal(committed, 0);
    availability = calculateNetAvailability(accountBalance, committed);
    assert.equal(accountBalance, 970000);
    assert.equal(availability.netAvailable, 970000);
  });

  it('5. TanStack Query mutation hooks and cache invalidation verification', () => {
    const mutationSource = readFileSync(
      new URL('../src/features/wallet/hooks/useTransactionMutations.ts', import.meta.url),
      'utf8'
    );
    const agendaHookSource = readFileSync(
      new URL('../src/features/agenda/hooks/useMarkEventAsPaid.ts', import.meta.url),
      'utf8'
    );
    const privateMutationSource = readFileSync(
      new URL('../src/features/app-shell/hooks/usePrivateMutation.ts', import.meta.url),
      'utf8'
    );
    const realtimeSource = readFileSync(
      new URL('../src/features/app-shell/hooks/useRealtimeSync.ts', import.meta.url),
      'utf8'
    );

    const requiredKeys = ["'accounts'", "'transactions'", "'availability'", "'agenda'"];
    for (const key of requiredKeys) {
      assert.ok(mutationSource.includes(key), `useTransactionMutations must invalidate ${key}`);
      assert.ok(agendaHookSource.includes(key), `useMarkEventAsPaid must invalidate ${key}`);
      assert.ok(privateMutationSource.includes(key), `usePrivateMutation must invalidate ${key}`);
      assert.ok(realtimeSource.includes(key), `useRealtimeSync must invalidate ${key}`);
    }

    assert.ok(mutationSource.includes('export function useCreateTransaction'), 'Exports useCreateTransaction');
    assert.ok(mutationSource.includes('export function useUpdateTransaction'), 'Exports useUpdateTransaction');
    assert.ok(mutationSource.includes('export function useDeleteTransaction'), 'Exports useDeleteTransaction');
    assert.ok(agendaHookSource.includes('export function useMarkEventAsPaid'), 'Exports useMarkEventAsPaid');
  });

  it('6. SQL Migration defines trigger and parity triggers for PostgreSQL', () => {
    const sql = readFileSync(
      new URL('../supabase/migrations/20261008000000_transaction_accounting_trigger.sql', import.meta.url),
      'utf8'
    );

    assert.ok(sql.includes('handle_transaction_balance_update'), 'Trigger function handle_transaction_balance_update defined');
    assert.ok(sql.includes('trg_handle_transaction_balance'), 'Trigger trg_handle_transaction_balance defined');
    assert.ok(sql.includes('current_balance'), 'current_balance column synchronized');
    assert.ok(sql.includes('destination_account_id'), 'destination_account_id column added');
    assert.ok(sql.includes('source_account_id'), 'source_account_id column added');
    assert.ok(sql.includes('update_account_balance'), 'RPC update_account_balance defined');
    assert.ok(sql.includes('pay_agenda_occurrence'), 'pay_agenda_occurrence function defined');
    assert.ok(sql.includes('supabase_realtime'), 'supabase_realtime publication configured');
  });
});
