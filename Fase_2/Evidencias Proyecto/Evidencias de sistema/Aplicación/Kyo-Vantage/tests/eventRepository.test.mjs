import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getOccurrenceInDateRange,
  normalizeRecurringTemplate,
  getUpcomingTemplates,
  createRecurringTemplate,
  updateRecurringTemplateStatus,
  deleteRecurringTemplate,
  calculateNextDueDate,
  updateRecurringTemplate,
  payAgendaOccurrence,
} from '../src/modules/agenda/services/eventRepository.ts';

describe('Agenda payments require an accounting operation', () => {
  it('rejects setting paid through the legacy status API', async () => {
    await assert.rejects(updateRecurringTemplateStatus('template', 'paid'), /Registrar pago/);
  });
  it('rejects creating or editing a paid flag without a transaction', async () => {
    await assert.rejects(createRecurringTemplate({ title: 'Rent', amount: 100, frequency: 'monthly', status: 'paid' }), /Registra el pago/);
    await assert.rejects(updateRecurringTemplate('template', { status: 'paid' }), /pago debe registrarse/);
  });
  it('rejects a payment without a selected account before calling the database', async () => {
    await assert.rejects(payAgendaOccurrence({ id: 'template', occurrenceDate: '2026-10-04', accountId: '' }), /cuenta|sesión real/);
  });
  it('rejects unsupported income commitments instead of recording an expense', async () => {
    await assert.rejects(createRecurringTemplate({ title: 'Salary', amount: 100, frequency: 'monthly', type: 'income' }), /ingresos desde Billetera/);
  });
});

describe('eventRepository - getOccurrenceInDateRange', () => {
  it('returns correct occurrence date for monthly frequency within cycle', () => {
    const template = {
      frequency: 'monthly',
      payment_day: 15,
      is_active: true,
    };
    const startDate = new Date('2026-10-01T00:00:00Z');
    const endDate = new Date('2026-10-31T23:59:59Z');

    const result = getOccurrenceInDateRange(template, startDate, endDate);
    assert.ok(result !== null);
    assert.equal(result.getDate(), 15);
    assert.equal(result.getMonth(), 9); // October (0-indexed: 9)
    assert.equal(result.getFullYear(), 2026);
  });

  it('adjusts day 31 to 28 for February in non-leap year', () => {
    const template = {
      frequency: 'monthly',
      payment_day: 31,
      is_active: true,
    };
    const startDate = new Date(2026, 1, 1);
    const endDate = new Date(2026, 1, 28, 23, 59, 59);

    const result = getOccurrenceInDateRange(template, startDate, endDate);
    assert.ok(result !== null);
    assert.equal(result.getDate(), 28);
    assert.equal(result.getMonth(), 1); // February
  });

  it('returns null if monthly day does not fall within date window', () => {
    const template = {
      frequency: 'monthly',
      payment_day: 5,
      is_active: true,
    };
    const startDate = new Date('2026-10-10T00:00:00Z');
    const endDate = new Date('2026-10-20T23:59:59Z');

    const result = getOccurrenceInDateRange(template, startDate, endDate);
    assert.equal(result, null);
  });

  it('correctly matches once frequency within date range', () => {
    const template = {
      frequency: 'once',
      due_date: '2026-10-18',
      is_active: true,
    };
    const startDate = new Date('2026-10-01T00:00:00Z');
    const endDate = new Date('2026-10-31T23:59:59Z');

    const result = getOccurrenceInDateRange(template, startDate, endDate);
    assert.ok(result !== null);
    assert.equal(result.getDate(), 18);
  });

  it('returns null for once frequency outside date range', () => {
    const template = {
      frequency: 'once',
      due_date: '2026-11-05',
      is_active: true,
    };
    const startDate = new Date('2026-10-01T00:00:00Z');
    const endDate = new Date('2026-10-31T23:59:59Z');

    const result = getOccurrenceInDateRange(template, startDate, endDate);
    assert.equal(result, null);
  });

  it('correctly matches yearly recurrence across matching years', () => {
    const template = {
      frequency: 'yearly',
      due_date: '2025-10-12',
      is_active: true,
    };
    const startDate = new Date('2026-10-01T00:00:00Z');
    const endDate = new Date('2026-10-31T23:59:59Z');

    const result = getOccurrenceInDateRange(template, startDate, endDate);
    assert.ok(result !== null);
    assert.equal(result.getFullYear(), 2026);
    assert.equal(result.getMonth(), 9);
    assert.equal(result.getDate(), 12);
  });

  it('returns null if template is inactive', () => {
    const template = {
      frequency: 'monthly',
      payment_day: 15,
      is_active: false,
    };
    const startDate = new Date('2026-10-01T00:00:00Z');
    const endDate = new Date('2026-10-31T23:59:59Z');

    const result = getOccurrenceInDateRange(template, startDate, endDate);
    assert.equal(result, null);
  });
});

describe('eventRepository - normalizeRecurringTemplate', () => {
  it('normalizes legacy and new field names with relational objects', () => {
    const raw = {
      id: 'template-uuid-1',
      user_id: 'user-uuid-1',
      name: 'Internet Fibra',
      expected_amount: '29990',
      day_of_month: 10,
      account_id: 'acc-1',
      account: {
        id: 'acc-1',
        name: 'Cuenta Corriente Santander',
        balance: 1500000,
      },
      credit_card_id: null,
      type: 'expense',
      status: 'pending',
      frequency: 'monthly',
      is_essential: true,
      is_active: true,
    };

    const normalized = normalizeRecurringTemplate(raw);

    assert.equal(normalized.id, 'template-uuid-1');
    assert.equal(normalized.title, 'Internet Fibra');
    assert.equal(normalized.name, 'Internet Fibra');
    assert.equal(normalized.amount, 29990);
    assert.equal(normalized.expected_amount, 29990);
    assert.equal(normalized.payment_day, 10);
    assert.equal(normalized.day_of_month, 10);
    assert.equal(normalized.frequency, 'monthly');
    assert.equal(normalized.status, 'pending');
    assert.equal(normalized.account?.name, 'Cuenta Corriente Santander');
    assert.equal(normalized.credit_card, null);
  });
});

describe('eventRepository - Validation rules', () => {
  it('rejects creation with empty title or name', async () => {
    await assert.rejects(
      () =>
        createRecurringTemplate({
          title: '',
          amount: 50000,
          frequency: 'monthly',
        }),
      /obligatorio/i
    );
  });

  it('rejects creation with non-positive amount', async () => {
    await assert.rejects(
      () =>
        createRecurringTemplate({
          title: 'Gasto Inválido',
          amount: 0,
          frequency: 'monthly',
        }),
      /positivo/i
    );
  });

  it('rejects creation with invalid frequency', async () => {
    await assert.rejects(
      () =>
        createRecurringTemplate({
          title: 'Gasto Inválido',
          amount: 1000,
          // @ts-expect-error Testing invalid frequency
          frequency: 'biweekly',
        }),
      /Frecuencia inválida/i
    );
  });

  it('rejects invalid status', async () => {
    await assert.rejects(
      // @ts-expect-error Testing invalid status
      () => updateRecurringTemplateStatus('some-id', 'in_progress'),
      /Estado inválido/i
    );
  });

  it('rejects payment day outside 1-31', async () => {
    await assert.rejects(
      () =>
        createRecurringTemplate({
          title: 'Gasto Inválido',
          amount: 1000,
          frequency: 'monthly',
          payment_day: 35,
        }),
      /entre 1 y 31/i
    );
  });
});

describe('eventRepository - calculateNextDueDate', () => {
  it('returns valid YYYY-MM-DD string for monthly payment day', () => {
    const nextDate = calculateNextDueDate({
      frequency: 'monthly',
      paymentDay: 15,
    });
    assert.match(nextDate, /^\d{4}-\d{2}-15$/);
  });

  it('clamps day 31 to month end if necessary', () => {
    const nextDate = calculateNextDueDate({
      frequency: 'monthly',
      paymentDay: 31,
    });
    assert.match(nextDate, /^\d{4}-\d{2}-(28|29|30|31)$/);
  });

  it('uses explicitly provided due_date when given', () => {
    const nextDate = calculateNextDueDate({
      frequency: 'once',
      dueDate: '2026-12-25',
    });
    assert.equal(nextDate, '2026-12-25');
  });

  it('never returns null or empty string', () => {
    const nextDate = calculateNextDueDate({});
    assert.ok(typeof nextDate === 'string' && nextDate.length === 10);
  });
});

