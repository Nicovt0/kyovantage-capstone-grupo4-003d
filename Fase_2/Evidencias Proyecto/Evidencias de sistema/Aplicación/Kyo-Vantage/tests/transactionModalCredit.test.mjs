import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as jsxRuntime from 'react/jsx-runtime';
import { selectTransactionAccounts } from '../src/features/wallet/selectors/accountSelectors.ts';

function form(overrides = {}) {
  const states = ['expense', 'card:credit', '', 'food', 'Compra', '50000', '', '3', '2026-01-01', '', false];
  for (const [index, value] of Object.entries(overrides)) states[Number(index)] = value;
  const calls = []; let error = ''; let index = 0;
  const icon = () => null;
  const source = readFileSync(new URL('../src/features/wallet/components/transaction/TransactionModal.tsx', import.meta.url), 'utf8').replace(/^import .*;\r?$/gm, '');
  const output = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  const accounts = [{ id: 'cash', name: 'Cuenta', type: 'vista', balance: 100000 }];
  vm.runInNewContext(output, {
    exports, require: () => jsxRuntime,
    useState: initial => { const current = index++; return [current < states.length ? states[current] : initial, value => { if (current === 9) error = value; }]; },
    useAccounts: () => ({ data: accounts }), useCategories: () => ({ data: [{ id: 'food', name: 'Comida', type: 'expense' }] }),
    useCreditCards: () => ({ data: [{ id: 'credit', name: 'Visa', total_limit: 100000, current_debt: 10000 }] }),
    selectActiveAccounts: rows => rows,
    selectTransactionAccounts,
    usePrivateMutation: () => ({ runMutation: operation => operation() }),
    useAccountingAction: () => (payload, action) => action('same-request'),
    addCreditCardPurchase: async (payload, requestId) => calls.push({ kind: 'purchase', payload, requestId }),
    addTransaction: async payload => calls.push({ kind: 'transaction', payload }),
    AppModal: icon, Button: icon, TransactionSelect: icon, CategorySelect: icon,
    ArrowRightLeft: icon, ArrowUpRight: icon, ArrowDownLeft: icon, NotebookPen: icon, Landmark: icon, Wallet: icon, CreditCard: icon, Tag: icon, LucideIcons: {},
  });
  const tree = exports.TransactionModal({ isOpen: true, onClose: () => calls.push({ kind: 'closed' }) });
  function find(node) {
    if (!node || typeof node !== 'object') return null;
    if (node.type === 'form') return node;
    for (const child of [node.props?.children].flat(Infinity)) { const result = find(child); if (result) return result; }
    return null;
  }
  return { submit: () => find(tree).props.onSubmit({ preventDefault() {} }), calls, getError: () => error };
}

test('the modal routes a 50k credit purchase to the existing ledger, with three installments and retry id', async () => {
  const view = form(); await view.submit();
  assert.deepEqual(view.calls.map(call => call.kind), ['purchase', 'closed']);
  const { payload, requestId } = view.calls[0];
  assert.equal(payload.credit_card_id, 'credit');
  assert.equal(payload.amount_total, 50000);
  assert.equal(payload.installment_total, 3);
  assert.equal(payload.amount_per_installment, 16666);
  assert.equal(requestId, 'same-request');
});

test('account expenses keep using the transaction flow instead of creating a credit purchase', async () => {
  const view = form({ 1: 'cash' }); await view.submit();
  assert.deepEqual(view.calls.map(call => call.kind), ['transaction', 'closed']);
  assert.equal(view.calls[0].payload.account_id, 'cash');
});

test('credit selection rejects insufficient limit, invalid installments and non-expense operations before saving', async () => {
  for (const overrides of [{ 5: '95000' }, { 7: '0' }, { 7: '2.5' }, { 7: '100' }, { 0: 'income' }, { 0: 'transfer' }]) {
    const view = form(overrides); await view.submit();
    assert.equal(view.calls.length, 0);
    assert.ok(view.getError());
  }
});
