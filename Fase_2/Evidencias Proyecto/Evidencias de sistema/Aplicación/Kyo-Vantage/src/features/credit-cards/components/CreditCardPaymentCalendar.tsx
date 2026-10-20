import { BillingStatement } from "@/types";
import { CheckCircle2, AlertCircle, XCircle, CalendarDays } from "lucide-react";

interface CreditCardPaymentCalendarProps {
  statements: BillingStatement[];
}

export function CreditCardPaymentCalendar({ statements }: CreditCardPaymentCalendarProps) {
  // Generate last 12 months
  const months = [];
  const today = new Date();

  for (let i = 11; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const periodStr = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
    const monthName = new Intl.DateTimeFormat('es-CL', { month: 'short' }).format(d);

    // Find statement for this period
    const statement = statements.find(s => s.billing_period === periodStr);

    let status: 'paid' | 'partial' | 'pending' | 'none' = 'none';
    if (statement) {
      status = statement.status;
      // if it's pending but dueDate passed, maybe consider it 'late' -> mapped to pending for red color
    }

    months.push({
      periodStr,
      label: monthName.charAt(0).toUpperCase() + monthName.slice(1),
      year: d.getFullYear(),
      status,
      statement
    });
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-[#17c964] shadow-[0_0_10px_rgba(23,201,100,0.3)]';
      case 'partial': return 'bg-warning shadow-[0_0_10px_rgba(245,165,36,0.3)]';
      case 'pending': return 'bg-[#f31260] shadow-[0_0_10px_rgba(243,18,96,0.3)]';
      default: return 'bg-default-100 dark:bg-surface-raised border border-dashed border-default-200 dark:border-border-subtle';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid': return <CheckCircle2 size={12} className="text-white" />;
      case 'partial': return <AlertCircle size={12} className="text-white" />;
      case 'pending': return <XCircle size={12} className="text-white" />;
      default: return null;
    }
  };

  return (
    <div className="flex flex-col gap-3 w-full">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
          <CalendarDays size={20} className="text-[#6d28d9]" /> Historial de Pagos
        </h3>
        <span className="text-xs text-[#5a5a72] dark:text-[#a0a0b8]">Últimos 12 meses de facturación</span>
      </div>

      <div className="flex flex-col gap-4 w-full bg-white dark:bg-surface-card border border-transparent dark:border-border-subtle rounded-3xl p-6 shadow-sm">
        <div className="grid grid-cols-4 md:grid-cols-4 gap-4 mt-2 justify-items-center">
        {months.map((m, idx) => (
          <div key={m.periodStr} className="flex flex-col items-center gap-2 group">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 cursor-help ${getStatusColor(m.status)}`}
              title={m.statement ? `Facturado: $${m.statement.total_due.toLocaleString('es-CL')}\nPagado: $${m.statement.amount_paid.toLocaleString('es-CL')}` : 'Sin facturación'}
            >
              {getStatusIcon(m.status)}
            </div>
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-bold text-foreground uppercase">{m.label}</span>
              {/* Show year only if it's Jan or the first item */}
              {(m.label === 'Ene' || idx === 0) && (
                <span className="text-[8px] text-[#5a5a72] dark:text-[#a0a0b8]">{m.year}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-default-100 dark:border-border-subtle">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#17c964]" />
          <span className="text-xs font-medium text-[#5a5a72] dark:text-[#a0a0b8]">Pagado</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-warning" />
          <span className="text-xs font-medium text-[#5a5a72] dark:text-[#a0a0b8]">Mínimo/Parcial</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#f31260]" />
          <span className="text-xs font-medium text-[#5a5a72] dark:text-[#a0a0b8]">Pendiente</span>
        </div>
      </div>
      </div>
    </div>
  );
}
