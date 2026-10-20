import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

function repository() {
  const source = readFileSync(new URL('../src/features/wallet/api/transactionRepository.ts', import.meta.url), 'utf8')
    .replace(/^import .*;\r?$/gm, '');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  let writes = 0;
  const rows = [{ id: 'agenda-tx', amount: 1000 }, { id: 'other-tx', amount: 20 }, {id:'goal-tx',amount:30},{id:'goal-destination',amount:30},{id:'billing-tx',amount:40}];
  const client = {
    from(table) {
      return {
        select() { return this; },
        eq() { return this; },
        maybeSingle: async () => ({ data: { transaction_id: 'agenda-tx' }, error: null }),
        or: async () => ({data:table==='agenda_occurrence_payments' ? [{transaction_id:'agenda-tx',receipt_type:'agenda'},{transaction_id:'goal-tx',destination_transaction_id:'goal-destination',receipt_type:'agenda'},{transaction_id:'billing-tx',receipt_type:'billing'}] : [],error:null}),
        in: async () => ({ data: [{ transaction_id: 'agenda-tx' }], error: null }),
        order() { return this; },
        range: async () => ({ data: rows, error: null, count:rows.length }),
        then(resolve) { return Promise.resolve({data:rows,error:null}).then(resolve); },
        update() { writes++; throw new Error(`Unexpected write to ${table}`); },
        delete() { writes++; throw new Error(`Unexpected deletion from ${table}`); },
      };
    },
    rpc() { writes++; throw new Error('Unexpected accounting RPC'); },
  };
  const exports = {};
  vm.runInNewContext(outputText, { exports, USE_MOCKS: false, createClient: () => client, console, Set });
  return { api: exports, writes: () => writes };
}

test('confirmed Agenda movements cannot be edited, reopened or deleted before changing balances', async () => {
  const { api, writes } = repository();
  await assert.rejects(api.updateTransaction('agenda-tx', { amount: 2000 }), /reversión contable/);
  await assert.rejects(api.updateTransactionStatus('agenda-tx', 'pending'), /reversión contable/);
  await assert.rejects(api.deleteTransaction('agenda-tx'), /reversión contable/);
  assert.equal(writes(), 0);
});

test('normalized posted transactions count as paid and Agenda payments remain protected', async () => {
  const { api } = repository();
  for (const rows of [await api.getTransactions(), await api.getTransactionsByAccount('account')]) {
    assert.equal(rows[0].status, 'paid');
    assert.equal(rows[0].agenda_payment, true);
    assert.equal(rows[1].status, 'paid');
    assert.equal(rows[1].agenda_payment, undefined);
    assert.equal(rows[2].agenda_payment,true);
    assert.equal(rows[3].agenda_payment,true);
    assert.equal(rows[4].billing_payment,true);
  }
});
