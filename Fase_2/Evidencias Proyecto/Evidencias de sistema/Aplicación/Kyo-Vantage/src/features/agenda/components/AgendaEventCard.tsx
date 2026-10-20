import { Link } from 'react-router-dom';
import React from 'react';
import {
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Landmark,
  CreditCard as CreditCardIcon,
  Trash2,
  Edit2,
  CalendarPlus,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { RecurringTemplate } from '@/types';
import { Button } from '@heroui/react';

interface AgendaEventCardProps {
  event: RecurringTemplate;
  onToggleStatus: (event: RecurringTemplate) => void;
  onEdit: (event: RecurringTemplate) => void;
  onDelete: (id: string) => void;
  onPostpone?: (event: RecurringTemplate) => void;
  isUpdatingStatus?: boolean;
}

export function AgendaEventCard({
  event,
  onToggleStatus,
  onEdit,
  onDelete,
  onPostpone,
  isUpdatingStatus,
}: AgendaEventCardProps) {
  const isIncome = event.type === 'income';
  const amount = Number(event.amount || event.expected_amount || 0);

  // Status visual attributes
  const isPaid = event.status === 'paid';
  const isOverdue = event.status === 'overdue';
  const isPending = !isPaid && !isOverdue;

  let statusBadge = {
    label: 'Pendiente',
    icon: Clock,
    badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30',
    cardBorder: 'hover:border-amber-500/40',
  };

  if (isPaid) {
    statusBadge = {
      label: 'Pagado',
      icon: CheckCircle2,
      badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
      cardBorder: 'hover:border-emerald-500/40',
    };
  } else if (isOverdue) {
    statusBadge = {
      label: 'Vencido',
      icon: AlertTriangle,
      badgeClass: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30',
      cardBorder: 'hover:border-red-500/40',
    };
  }

  // Instrument display (Account vs Credit Card)
  const hasAccount = Boolean(event.account || event.account_id);
  const hasCard = Boolean(event.credit_card || event.credit_card_id);

  const instrumentName = event.credit_card?.name
    ? event.credit_card.name
    : event.account?.name
    ? event.account.name
    : hasCard
    ? 'Tarjeta de Crédito'
    : hasAccount
    ? 'Cuenta Bancaria'
    : null;

  // Day of occurrence display
  let dayDisplay = '';
  if (event.due_date) {
    const parts = String(event.due_date).split('T')[0].split('-');
    if (parts.length === 3) {
      dayDisplay = `Día ${parseInt(parts[2], 10)}`;
    }
  }
  if (!dayDisplay && (event.payment_day || event.day_of_month)) {
    dayDisplay = `Día ${event.payment_day || event.day_of_month}`;
  }

  const frequencyLabel =
    event.frequency === 'yearly'
      ? 'Anual'
      : event.frequency === 'once'
      ? 'Pago único'
      : 'Mensual';

  return (
    <div
      className={`group relative rounded-2xl border border-border-subtle bg-surface-card p-4.5 shadow-lg transition-all duration-200 ${statusBadge.cardBorder} hover:shadow-xl hover:bg-surface-raised flex flex-col gap-3`}
    >
      {/* Top Header: Date badge + Status Pill + Actions */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {/* Day pill */}
          <span className="rounded-lg bg-surface-raised px-2 py-0.5 text-[11px] font-bold text-on-surface-card-body">
            {dayDisplay || 'Programado'}
          </span>
          <span className="text-[11px] text-on-surface-card-secondary font-medium">
            • {frequencyLabel}
          </span>
        </div>

        {/* Status Pill */}
        <div className="flex items-center gap-2">
          {(() => {
            const StatusIcon = statusBadge.icon;
            return (
              <span
                className={`flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusBadge.badgeClass}`}
              >
                <StatusIcon size={11} />
                <span>{statusBadge.label}</span>
              </span>
            );
          })()}

          {/* Quick Edit/Delete buttons on hover/desktop */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onEdit(event)}
              disabled={Boolean(event.goal_id)}
              className="p-1 text-on-surface-card-secondary hover:text-foreground hover:bg-surface-raised rounded-lg transition-colors"
              title={event.goal_id ? 'Edita el plan desde la meta' : 'Editar compromiso'}
            >
              <Edit2 size={13} />
            </button>
            <button
              type="button"
              onClick={() => onDelete(event.id)}
              disabled={Boolean(event.payment_transaction_id || event.goal_id)}
              className="p-1 text-on-surface-card-secondary hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
              title={event.payment_transaction_id ? 'Este compromiso conserva un pago registrado y no se puede eliminar' : 'Eliminar compromiso'}
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Body: Title + Instrument + Amount */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1 min-w-0">
          <h4 className="font-extrabold text-sm md:text-base text-foreground tracking-tight truncate">
            {event.title || event.name}
          </h4>

          {/* Linked Payment Instrument Badge */}
          {instrumentName ? (
            <div className="flex items-center gap-1.5 text-xs text-on-surface-card-secondary">
              {hasCard ? (
                <CreditCardIcon size={13} className="text-[#8b5cf6] shrink-0" />
              ) : (
                <Landmark size={13} className="text-[#8b5cf6] shrink-0" />
              )}
              <span className="truncate max-w-[200px]">{instrumentName}</span>
            </div>
          ) : (
            <span className="text-[11px] text-on-surface-card-secondary">{event.goal_id ? 'Vinculado al plan de la meta' : 'Sin medio de pago vinculado'}</span>
          )}
        </div>

        {/* Amount */}
        <div className="flex flex-col items-end shrink-0">
          <span
            className={`text-base md:text-lg font-black tracking-tight ${
              isIncome ? 'text-emerald-700 dark:text-[#10b981]' : 'text-foreground'
            }`}
          >
            {event.goal_id && event.contribution_type==='free' && !isPaid ? 'Monto a definir' : `${isIncome ? '+' : '-'}$${amount.toLocaleString('es-CL')}`}
          </span>
          <span className="text-[10px] text-on-surface-card-secondary uppercase font-semibold">CLP</span>
        </div>
      </div>

      {/* Action Footer: Quick Toggle Action */}
      <div className="flex items-center justify-between pt-2.5 border-t border-border-subtle mt-1">
        {onPostpone && !isPaid && (
          <button
            type="button"
            onClick={() => onPostpone(event)}
            className="text-[11px] text-on-surface-card-secondary hover:text-[#8b5cf6] flex items-center gap-1 transition-colors"
          >
            <CalendarPlus size={12} />
            <span>Posponer</span>
          </button>
        )}

        {event.goal_id && <Link to={`/planning?view=goal-detail&id=${event.goal_id}`} className="text-xs text-purple-300">Ver meta / editar plan</Link>}
        <div className="ml-auto">
          <Button
            size="sm"
            isDisabled={isUpdatingStatus || isPaid}
            onPress={() => onToggleStatus(event)}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm ${
              isPaid
                ? 'bg-surface-raised hover:bg-surface-raised text-on-surface-card-body'
                : 'bg-gradient-to-r from-[#10b981] to-[#059669] hover:opacity-90 text-white shadow-emerald-500/20'
            }`}
          >
            <CheckCircle2 size={13} />
            <span>{isPaid ? (event.payment_transaction_id ? 'Pago registrado' : 'Marcado pagado') : 'Registrar pago'}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
