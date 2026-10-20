import test from 'node:test';
import assert from 'node:assert/strict';
import { createAccountingAction } from '../src/features/accounting/model/accountingRequest.ts';

test('an unchanged failed submission keeps its request id; a successful new submission gets a new id', async () => {
  const submit = createAccountingAction();
  const keys = [];
  await assert.rejects(submit({ amount: 10 }, async id => { keys.push(id); throw new Error('Connection lost after commit'); }));
  await submit({ amount: 10 }, async id => { keys.push(id); return true; });
  await submit({ amount: 10 }, async id => { keys.push(id); return true; });
  assert.equal(keys[0], keys[1]);
  assert.notEqual(keys[1], keys[2]);
});

test('correcting a failed form generates a fresh key rather than reusing it with different data', async () => {
  const submit = createAccountingAction();
  const keys = [];
  await assert.rejects(submit({ amount: 10 }, async id => { keys.push(id); throw new Error('Invalid account'); }));
  await submit({ amount: 20 }, async id => { keys.push(id); });
  assert.notEqual(keys[0], keys[1]);
});
