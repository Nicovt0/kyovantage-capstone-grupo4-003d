import React, { useState, useMemo } from 'react';
import { CalendarDays, Clock, CheckCircle2, AlertTriangle, Plus, Filter, Sparkles } from 'lucide-react';
import { RecurringTemplate } from '@/types';
import { AgendaEventCard } from './AgendaEventCard';
import { Button } from '@heroui/react';

interface AgendaEventListProps {
  events: RecurringTemplate[];
  isLoading: boolean;
  selectedDate: Date | null;
  onClearDateFilter: () => void;
  onOpenCreateModal: () => void;
  onToggleStatus: (event: RecurringTemplate) => void;
  onEdit: (event: RecurringTemplate) => void;
  onDelete: (id: string) => void;
  onPostpone?: (event: RecurringTemplate) => void;
  isUpdatingStatus?: boolean;
}

type FilterTab = 'all' | 'pending' | 'paid' | 'overdue';

export function AgendaEventList({
  events = [],
  isLoading,
  selectedDate,
  onClearDateFilter,
  onOpenCreateModal,
  onToggleStatus,
  onEdit,
  onDelete,
  onPostpone,
  isUpdatingStatus,
}: AgendaEventListProps) {
  const safeEvents = useMemo(() => (Array.isArray(events) ? events : []), [events]);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  // Filter events based on active tab and selected date
  const filteredEvents = useMemo(() => {
    let result = [...safeEvents];

    // Filter by specific day if calendar day is selected
    if (selectedDate) {
      const targetDay = selectedDate.getDate();
      const targetMonth = selectedDate.getMonth() + 1;
      const targetYear = selectedDate.getFullYear();

      result = result.filter((ev) => {
        if (ev.due_date) {
          const parts = String(ev.due_date).split('T')[0].split('-');
          if (parts.length === 3) {
            return (
              parseInt(parts[0], 10) === targetYear &&
              parseInt(parts[1], 10) === targetMonth &&
              parseInt(parts[2], 10) === targetDay
            );
          }
        }
        const preferred = ev.payment_day ?? ev.day_of_month ?? null;
        return preferred === targetDay;
      });
    }

    // Filter by status tab
    if (activeTab === 'pending') {
      result = result.filter((ev) => ev.status === 'pending');
    } else if (activeTab === 'paid') {
      result = result.filter((ev) => ev.status === 'paid');
    } else if (activeTab === 'overdue') {
      result = result.filter((ev) => ev.status === 'overdue');
    }

    // Sort chronologically by day
    return result.sort((a, b) => {
      if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
      const dayA = a.payment_day ?? a.day_of_month ?? (a.due_date ? new Date(a.due_date).getDate() : 99);
      const dayB = b.payment_day ?? b.day_of_month ?? (b.due_date ? new Date(b.due_date).getDate() : 99);
      return dayA - dayB;
    });
  }, [safeEvents, selectedDate, activeTab]);

  return (
    <div className="flex flex-col gap-4">
      {/* Controls Bar: Filter tabs + Add button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-card p-3 rounded-2xl border border-border-subtle">
        {/* Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 ${
              activeTab === 'all'
                ? 'bg-brand-primary text-white shadow-md shadow-[#6d28d9]/30'
                : 'text-on-surface-card-secondary hover:text-foreground bg-surface-raised'
            }`}
          >
            Todos ({safeEvents.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('pending')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === 'pending'
                ? 'bg-amber-500 text-black shadow-md shadow-amber-500/30'
                : 'text-on-surface-card-secondary hover:text-amber-400 bg-surface-raised'
            }`}
          >
            <Clock size={12} />
            <span>Pendientes ({safeEvents.filter((e) => e.status === 'pending').length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('paid')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === 'paid'
                ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
                : 'text-on-surface-card-secondary hover:text-emerald-400 bg-surface-raised'
            }`}
          >
            <CheckCircle2 size={12} />
            <span>Pagados ({safeEvents.filter((e) => e.status === 'paid').length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('overdue')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === 'overdue'
                ? 'bg-red-500 text-white shadow-md shadow-red-500/30'
                : 'text-on-surface-card-secondary hover:text-red-400 bg-surface-raised'
            }`}
          >
            <AlertTriangle size={12} />
            <span>Vencidos ({safeEvents.filter((e) => e.status === 'overdue').length})</span>
          </button>
        </div>

        {/* Add Commitment Button */}
        <Button
          size="sm"
          onPress={onOpenCreateModal}
          className="bg-gradient-to-r from-[#6d28d9] to-[#8b5cf6] text-white font-bold text-xs rounded-xl px-4 py-2 flex items-center gap-1.5 shadow-lg shadow-[#6d28d9]/30 hover:opacity-95 transition-all self-start sm:self-auto shrink-0"
        >
          <Plus size={15} />
          <span>Nuevo Compromiso</span>
        </Button>
      </div>

      {/* Selected Day filter banner */}
      {selectedDate && (
        <div className="flex items-center justify-between bg-brand-primary/20 border border-[#6d28d9]/40 rounded-xl px-3.5 py-2 text-xs text-brand-primary dark:text-[#c4b5fd]">
          <span>
            Mostrando compromisos agendados para el día <strong>{selectedDate.getDate()}</strong>
          </span>
          <button
            type="button"
            onClick={onClearDateFilter}
            className="text-[11px] font-bold text-foreground underline hover:text-on-surface-card-body"
          >
            Ver todos los días
          </button>
        </div>
      )}

      {/* Loading Skeletons */}
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="h-28 rounded-2xl border border-border-subtle bg-surface-card/60 p-4 animate-pulse flex flex-col justify-between"
            >
              <div className="flex justify-between items-center">
                <div className="h-4 w-24 bg-surface-raised rounded-lg" />
                <div className="h-4 w-20 bg-surface-raised rounded-full" />
              </div>
              <div className="flex justify-between items-center">
                <div className="h-6 w-40 bg-surface-raised rounded-lg" />
                <div className="h-6 w-24 bg-surface-raised rounded-lg" />
              </div>
              <div className="h-4 w-28 bg-surface-raised rounded-lg" />
            </div>
          ))}
        </div>
      ) : filteredEvents.length === 0 ? (
        /* Empty State */
        <div className="rounded-3xl border border-border-subtle bg-surface-card/70 p-8 flex flex-col items-center justify-center text-center gap-3 min-h-[260px]">
          <div className="w-14 h-14 rounded-2xl bg-surface-raised border border-border-subtle flex items-center justify-center text-on-surface-card-secondary mb-1">
            <CalendarDays size={28} />
          </div>
          <h4 className="text-base font-bold text-foreground">No hay compromisos agendados</h4>
          <p className="text-xs text-on-surface-card-secondary max-w-sm">
            {selectedDate
              ? 'No tienes ningún pago ni cobro registrado para este día en particular.'
              : activeTab !== 'all'
              ? `No se encontraron compromisos con estado "${activeTab}".`
              : 'Agrega tus gastos fijos recurrentes (arriendos, suscripciones, créditos) para visualizar su calendario y control de pagos.'}
          </p>
          <Button
            size="sm"
            onPress={onOpenCreateModal}
            className="mt-2 bg-brand-primary hover:bg-[#5b21b6] text-white text-xs font-bold rounded-xl px-5 py-2 shadow-md shadow-[#6d28d9]/30 transition-all flex items-center gap-1.5"
          >
            <Plus size={14} />
            <span>Agregar Primer Compromiso</span>
          </Button>
        </div>
      ) : (
        /* Event Cards List */
        <div className="flex flex-col gap-3">
          {filteredEvents.map((event) => (
            <AgendaEventCard
              key={`${event.id}:${event.due_date}`}
              event={event}
              onToggleStatus={onToggleStatus}
              onEdit={onEdit}
              onDelete={onDelete}
              onPostpone={onPostpone}
              isUpdatingStatus={isUpdatingStatus}
            />
          ))}
        </div>
      )}
    </div>
  );
}
