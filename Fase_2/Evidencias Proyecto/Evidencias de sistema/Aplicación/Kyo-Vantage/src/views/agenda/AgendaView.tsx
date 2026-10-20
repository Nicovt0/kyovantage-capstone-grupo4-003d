import { useFinancialPeriod } from '@/features/app-shell/components/FinancialPeriodProvider';
import { useFinancialSettings } from '@/features/settings/hooks/useFinancialSettings';
import { getFinancialCycle } from '@/utils/financialCycle';
import React, { useState, useCallback } from 'react';
import { CalendarDays, Plus, RefreshCw, Sparkles, Filter } from 'lucide-react';
import { Button } from '@heroui/react';
import { useAgendaEvents } from '@/features/agenda/hooks/useAgendaEvents';
import { AgendaCalendarView } from '@/features/agenda/components/AgendaCalendarView';
import { AgendaEventList } from '@/features/agenda/components/AgendaEventList';
import { AgendaEventModal } from '@/features/agenda/components/AgendaEventModal';
import { AgendaPaymentModal } from '@/features/agenda/components/AgendaPaymentModal';
import { ToastNotification, ToastMessage } from '@/shared/ui/ToastNotification';
import { ViewHeader } from '@/shared/ui/ViewHeader';
import { AgendaPushNotificationBanner } from '@/modules/notifications/components/AgendaPushNotificationBanner';
import { RecurringTemplate, CreateRecurringTemplateDTO, UpdateRecurringTemplateDTO } from '@/types';

interface AgendaErrorBoundaryProps {
  children: React.ReactNode;
}

interface AgendaErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class AgendaErrorBoundary extends React.Component<AgendaErrorBoundaryProps, AgendaErrorBoundaryState> {
  constructor(props: AgendaErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): AgendaErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[AgendaErrorBoundary caught error]:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-8 min-h-[360px] text-center gap-4 bg-surface-card border border-red-500/30 rounded-3xl mx-auto max-w-xl my-8 text-foreground animate-in fade-in">
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
            <Filter className="w-6 h-6 rotate-180" />
          </div>
          <h2 className="text-lg font-bold">Ocurrió un problema en la vista de Agenda</h2>
          <p className="text-xs text-on-surface-card-body max-w-md">
            {this.state.error?.message || 'Error inesperado al renderizar el calendario o listado.'}
          </p>
          <Button
            size="sm"
            onPress={() => this.setState({ hasError: false, error: null })}
            className="bg-brand-primary hover:bg-[#5b21b6] text-white text-xs font-bold rounded-xl px-5 py-2 shadow-lg shadow-[#6d28d9]/30"
          >
            Reintentar carga
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

function AgendaContent() {
  const { settings: { financial_cycle_start_day: cycleStartDay } } = useFinancialSettings();
  const {cycle}=useFinancialPeriod();
  const now = cycle.start;
  const [currentMonth, setCurrentMonth] = useState<number>(now.getMonth() + 1);
  const [currentYear, setCurrentYear] = useState<number>(now.getFullYear());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<RecurringTemplate | null>(null);
  const [payingEvent, setPayingEvent] = useState<RecurringTemplate | null>(null);

  // Toast feedback state
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const showToast = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    setToast({ id: String(Date.now()), type, message });
    setTimeout(() => {
      setToast(null);
    }, 3500);
  }, []);

  // TanStack Query v5 Hook
  const {
    events,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
    createCommitment,
    payCommitment,
    isPaying,
    deleteCommitment,
    updateCommitment,
    isUpdatingStatus,
  } = useAgendaEvents({
    month: currentMonth,
    year: currentYear,
  });

  const handleChangeMonth = (month: number, year: number) => {
    setCurrentMonth(month);
    setCurrentYear(year);
    setSelectedDate(null); // Reset date filter when navigating months
  };

  const handleOpenCreateModal = (day?: number) => {
    setEditingEvent(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (event: RecurringTemplate) => {
    setEditingEvent(event);
    setIsModalOpen(true);
  };

  const handleToggleStatus = (event: RecurringTemplate) => {
    if (event.status === 'paid') {
      showToast('info', 'Un pago registrado no se revierte cambiando su estado.');
      return;
    }
    setPayingEvent(event);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar este compromiso recurrente?')) {
      return;
    }
    try {
      await deleteCommitment(id);
      showToast('success', 'Compromiso eliminado de la agenda.');
    } catch (err: any) {
      showToast('error', err.message || 'Error al eliminar el compromiso.');
    }
  };

  const handleSaveModal = async (
    data: CreateRecurringTemplateDTO | { id: string; updates: UpdateRecurringTemplateDTO }
  ) => {
    if ('id' in data) {
      await updateCommitment({ id: data.id, updates: data.updates });
      showToast('success', 'Compromiso actualizado exitosamente.');
    } else {
      await createCommitment(data);
      showToast('success', 'Nuevo compromiso agendado exitosamente.');
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto p-4 md:p-6 text-foreground animate-in fade-in duration-300 font-sans pb-24">
      {/* Banner / Header */}
      <ViewHeader
        icon={<CalendarDays className="w-6 h-6" />}
        title="Agenda Financiera"
        description="Monitorea tus vencimientos mensuales, gastos fijos y programas de cobro en un solo lugar."
        titleSuffix={isFetching && !isLoading && (
          <RefreshCw size={14} className="animate-spin text-purple-400" />
        )}
        actions={
          <>
            <Button
              size="sm"
              onPress={() => refetch()}
              className="rounded-xl px-3 py-2 text-xs font-semibold text-on-surface-card-body hover:text-foreground bg-surface-raised hover:bg-surface-raised border border-border-subtle transition-colors"
            >
              <RefreshCw size={13} className={isFetching ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Actualizar</span>
            </Button>

            <Button
              onPress={() => handleOpenCreateModal()}
              className="bg-gradient-to-r from-[#6d28d9] to-[#8b5cf6] hover:opacity-95 text-white font-extrabold py-2.5 px-5 rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-[#6d28d9]/30 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Compromiso</span>
            </Button>
          </>
        }
      />

      {/* Error Alert Banner */}
      {isError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-red-200">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-red-500/20 flex items-center justify-center text-red-400 shrink-0">
              <Filter className="w-4 h-4 rotate-180" />
            </div>
            <div>
              <div className="text-xs font-bold text-red-400">Error al sincronizar compromisos</div>
              <div className="text-xs text-on-surface-card-body">
                {(error as any)?.message || 'No se pudieron cargar los registros de la agenda.'}
              </div>
            </div>
          </div>
          <Button
            size="sm"
            onPress={() => refetch()}
            className="bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 text-xs font-bold rounded-xl px-4 py-1.5 self-start sm:self-auto shrink-0 transition-all"
          >
            Reintentar
          </Button>
        </div>
      )}

      {/* Contextual Push Notifications Prompt */}
      <AgendaPushNotificationBanner />

      {/* Dual View Layout: Responsive Grid (Desktop: 2 columns, Mobile: Stacked) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Columna Izquierda: Calendario Interactivo Mensual (5 columnas en Desktop) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <AgendaCalendarView
            currentMonth={currentMonth}
            currentYear={currentYear}
            events={events}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            onChangeMonth={handleChangeMonth}
          />
        </div>

        {/* Columna Derecha: Listado Cronológico de Vencimientos (7 columnas en Desktop) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <AgendaEventList
            events={events}
            isLoading={isLoading}
            selectedDate={selectedDate}
            onClearDateFilter={() => setSelectedDate(null)}
            onOpenCreateModal={() => handleOpenCreateModal(selectedDate?.getDate())}
            onToggleStatus={handleToggleStatus}
            onEdit={handleOpenEditModal}
            onDelete={handleDelete}
            isUpdatingStatus={isUpdatingStatus}
          />
        </div>
      </div>

      {/* Modal de Creación / Edición */}
      <AgendaEventModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveModal}
        initialData={editingEvent}
        defaultDay={selectedDate ? selectedDate.getDate() : undefined}
      />

      {/* Payment Confirmation Modal */}
      {payingEvent && (
        <AgendaPaymentModal
          event={payingEvent}
          isPaying={isPaying}
          onClose={() => setPayingEvent(null)}
          onPay={async (accountId, amount, savingsAccountId) => {
            await payCommitment({
              id: payingEvent.id,
              occurrenceDate: payingEvent.due_date || new Date().toISOString().split('T')[0],
              accountId,
              amount,
              savingsAccountId,
            });
            setPayingEvent(null);
            showToast('success', 'Pago registrado. El movimiento y el saldo de la cuenta fueron actualizados.');
          }}
        />
      )}
      <ToastNotification toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}

export function AgendaView() {
  return (
    <AgendaErrorBoundary>
      <AgendaContent />
    </AgendaErrorBoundary>
  );
}

export default AgendaView;

