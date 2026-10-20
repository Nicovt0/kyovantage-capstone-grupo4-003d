import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getBudgetTrafficLight } from '../src/utils/budgetTrafficLight.ts';

describe('budget visual bands', () => {
  it('keeps exact boundaries, including exactly 100% as warning', () => {
    for (const [spent, status] of [[0, 'green'], [79.99, 'green'], [80, 'yellow'], [99, 'yellow'], [100, 'yellow'], [100.01, 'red']]) {
      assert.equal(getBudgetTrafficLight(spent, 100).status, status);
    }
  });
  it('preserves early notification preferences without moving visual bands', () => {
    const early = getBudgetTrafficLight(50, 100, 50);
    assert.equal(early.status, 'green');
    assert.equal(early.earlyAlertReached, true);
    const disabled = getBudgetTrafficLight(100, 100, 0);
    assert.equal(disabled.status, 'yellow');
    assert.equal(disabled.earlyAlertReached, false);
    assert.equal(getBudgetTrafficLight(101, 100, 0).status, 'red');
  });
  it('handles empty, invalid and negative inputs', () => {
    assert.equal(getBudgetTrafficLight(0, 0).percentage, 0);
    assert.equal(getBudgetTrafficLight(1, 0).status, 'red');
    assert.equal(getBudgetTrafficLight(Number.NaN, 100).percentage, 0);
    assert.equal(getBudgetTrafficLight(-5, 100).status, 'green');
  });
});
