import test from 'node:test';
import assert from 'node:assert/strict';
import { selectActiveAccounts, selectAccountsTotalBalance } from '../src/features/wallet/selectors/accountSelectors.ts';

test('archived or inactive accounts do not occupy slots or contribute to the current total', () => {
  const accounts = [
    {id:'active', balance:91000},
    {id:'archived', balance:21, is_archived:true, include_in_total:true},
    {id:'inactive', balance:100, is_active:false},
    {id:'excluded', balance:50, include_in_total:false},
  ];
  assert.deepEqual(selectActiveAccounts(accounts).map(a => a.id), ['active','excluded']);
  assert.equal(selectAccountsTotalBalance(accounts),91000);
});
