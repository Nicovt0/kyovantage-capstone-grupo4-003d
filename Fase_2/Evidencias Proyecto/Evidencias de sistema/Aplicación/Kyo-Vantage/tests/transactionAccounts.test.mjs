import test from 'node:test';
import assert from 'node:assert/strict';
import { selectTransactionAccounts } from '../src/features/wallet/selectors/accountSelectors.ts';

const accounts = ['efectivo', 'ahorro', 'vista', 'corriente', 'inversion'].map(type => ({ id: type, type }));
test('expenses offer current and sight accounts, in that order', () => {
  assert.deepEqual(selectTransactionAccounts(accounts, 'expense').map(account => account.id), ['corriente', 'vista']);
});
test('income offers sight, savings and current accounts, in that order', () => {
  assert.deepEqual(selectTransactionAccounts(accounts, 'income').map(account => account.id), ['vista', 'ahorro', 'corriente']);
});
test('transfers retain all active account types, including cash and investments', () => {
  assert.equal(selectTransactionAccounts(accounts, 'transfer').length, 5);
});
test('database aliases work and inactive or archived accounts remain excluded', () => {
  const rows = [{ id: 'a', type: 'checking' }, { id: 'b', type: 'sight' }, { id: 'c', type: 'savings' }, { id: 'd', type: 'vista', is_archived: true }, { id: 'e', type: 'corriente', is_active: false }];
  assert.deepEqual(selectTransactionAccounts(rows, 'income').map(account => account.id), ['b', 'c', 'a']);
  assert.equal(selectTransactionAccounts(rows, 'transfer').length, 3);
});
