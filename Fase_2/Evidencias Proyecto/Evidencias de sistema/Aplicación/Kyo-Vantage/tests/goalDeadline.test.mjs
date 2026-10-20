import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getGoalDaysRemaining, formatGoalDeadline } from '../src/features/goals/model/goalDeadline.ts';

process.env.TZ = 'America/Santiago';
describe('goal calendar deadlines', () => {
  it('keeps today active through the evening and expires yesterday', () => {
    const evening = new Date(2026, 9, 4, 23, 59);
    assert.equal(getGoalDaysRemaining('2026-10-04', evening), 0);
    assert.equal(formatGoalDeadline(0), 'Vence hoy');
    assert.equal(getGoalDaysRemaining('2026-10-03', evening), -1);
    assert.equal(formatGoalDeadline(-1), 'Vencida');
    assert.equal(getGoalDaysRemaining('2026-10-05T00:00:00Z', evening), 1);
  });
  it('counts calendar days across Chile daylight saving changes', () => {
    assert.equal(getGoalDaysRemaining('2026-09-07', new Date(2026, 8, 5, 12)), 2);
    assert.equal(getGoalDaysRemaining('2026-04-06', new Date(2026, 3, 4, 12)), 2);
  });
  it('updates when the next day is supplied and rejects invalid dates', () => {
    assert.equal(getGoalDaysRemaining('2026-10-05', new Date(2026, 9, 4)), 1);
    assert.equal(getGoalDaysRemaining('2026-10-05', new Date(2026, 9, 5)), 0);
    for (const value of ['', 'invalid', '2026-02-30']) assert.equal(getGoalDaysRemaining(value), null);
    assert.equal(formatGoalDeadline(null), 'Sin fecha');
    assert.equal(formatGoalDeadline(45), '45 días');
  });
});
