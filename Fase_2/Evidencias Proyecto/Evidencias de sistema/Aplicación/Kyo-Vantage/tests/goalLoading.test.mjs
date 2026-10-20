import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(relative, globals) {
  const source = readFileSync(new URL(relative, import.meta.url), 'utf8').replace(/^import .*;\r?$/gm, '');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(output, { exports, ...globals });
  return exports;
}

test('failed goal reads reject instead of reporting an empty successful list', async () => {
  const { getGoals } = load('../src/features/goals/api/goalRepository.ts', {
    USE_MOCKS: false,
    createClient: () => ({ from: () => ({ select: async () => ({ data: null, error: { message: 'permission denied for table goals' } }) }) }),
  });
  await assert.rejects(getGoals(), /No se pudieron cargar tus metas.*permission denied/);
});

test('successful goal reads preserve saved numeric amounts and an actually empty result', async () => {
  let rows = [{ id: 'saved', name: 'Viaje', target_amount: '100000', current_amount: '10000', contribution_type: 'fixed', contribution_amount: '10000' }];
  const { getGoals } = load('../src/features/goals/api/goalRepository.ts', {
    USE_MOCKS: false,
    createClient: () => ({ from: () => ({ select: async () => ({ data: rows, error: null }) }) }),
  });
  const goals = await getGoals();
  assert.equal(goals[0].id, 'saved');
  assert.equal(goals[0].current_amount, 10000);
  rows = [];
  assert.equal((await getGoals()).length, 0);
});

test('goal queries wait for session hydration and use the recovered user key', () => {
  let userId = '';
  const { useGoals } = load('../src/features/goals/hooks/useGoals.ts', {
    USE_MOCKS: false,
    useAuth: () => ({ auth: { id: userId } }),
    useQuery: options => options,
    goalQueryKeys: { all: id => ['private', id, 'goals'] },
  });
  assert.equal(useGoals().enabled, false);
  userId = 'owner';
  assert.equal(useGoals().enabled, true);
  assert.equal(useGoals().queryKey[1], 'owner');
});
