import { useState } from "react";
import { useNavigate } from 'react-router-dom';
import { CreditCard, Bank, Transaction, Category, BillingStatement } from "@/types";
import { CreditCardVisual } from "@/shared/ui/CreditCardVisual";
import { Button } from "@heroui/react";
import { ArrowLeft, Edit2, Trash2, CalendarDays, Activity, CheckCircle2, TrendingUp, Info, LayoutList } from "lucide-react";
import { CreditCardDetailCharts } from "./CreditCardDetailCharts";
import { CreditCardPaymentCalendar } from "./CreditCardPaymentCalendar";
import { CreditCardWeeklyNavigator } from "./CreditCardWeeklyNavigator";
import { CreditCardEditModal } from "./detail/CreditCardEditModal";
import { CreditCardDeleteModal } from "./detail/CreditCardDeleteModal";

interface CreditCardDetailViewProps {
  card: CreditCard;
  bank?: Bank;
  banks: Bank[];
  transactions: Transaction[];
  categories: Category[];
  billingStatements: BillingStatement[];
}

export function CreditCardDetailView({ card, bank, banks, transactions, categories, billingStatements }: CreditCardDetailViewProps) {
  const navigate = useNavigate();

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Metrics
  const totalLimit = card.total_limit || 0;
  const currentDebt = card.current_debt || 0;
  const available = Math.max(0, totalLimit - currentDebt);
  const healthPercentage = totalLimit > 0 ? (currentDebt / totalLimit) * 100 : 0;

  // Active Installments (compras en cuotas)
  // Only transactions where installment_total > 1 and installment_current <= installment_total
  // Wait, if it's already paid, the installment_current might be equal to total.
  // Actually, we can check if it's an installment purchase.
  const activeInstallments = transactions.filter(t =>
    t.installment_total && t.installment_total > 1 && t.installment_current && t.installment_current <= t.installment_total
  ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const getCategoryColor = (categoryId: string) => '#a0a0b8';
  const getCategoryName = (categoryId: string) => categories.find(c => c.id === categoryId)?.name || 'Gasto';

  return (
    <div className="flex flex-col gap-8 w-full animate-in fade-in pb-28">

      {/* 1. Header Visual */}
      <div className="flex flex-col items-center justify-center gap-6">
        <CreditCardVisual card={card} bank={bank} />

        <div className="flex items-center gap-3">
          <Button
            variant="flat"
            className="font-bold text-[#5a5a72] dark:text-[#a0a0b8] bg-default-100 dark:bg-surface-card"
            onPress={() => setIsEditOpen(true)}
          >
            <Edit2 size={16} /> Editar
          </Button>
          <Button
            variant="flat"
            className="font-bold text-[#f31260] bg-[#f31260]/10"
            onPress={() => setIsDeleteOpen(true)}
          >
            <Trash2 size={16} /> Eliminar
          </Button>
        </div>
      </div>

      {/* 2. Dashboard de Cupos */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center px-1">
          <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
            <TrendingUp size={20} className="text-[#6d28d9]" /> Resumen de Cupo
          </h3>
        </div>

        <div className="bg-white dark:bg-surface-card border border-transparent dark:border-border-subtle rounded-3xl p-6 md:p-8 shadow-sm flex flex-col">
          <div className="flex flex-col items-center justify-center text-center mt-2 mb-8">
            <span className="text-xs uppercase tracking-widest text-[#5a5a72] dark:text-[#a0a0b8] font-bold mb-2">Cupo Disponible</span>
            <span className={`text-4xl md:text-5xl font-bold ${available <= 0 ? 'text-[#f31260]' : 'text-foreground'}`}>
              ${available.toLocaleString('es-CL')}
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-[#5a5a72] dark:text-[#a0a0b8] font-medium flex items-center gap-1">
                Utilizado: <span className="text-foreground font-bold">${currentDebt.toLocaleString('es-CL')}</span>
              </span>
              <span className="text-[#5a5a72] dark:text-[#a0a0b8] font-medium flex items-center gap-1">
                Línea Total: <span className="text-foreground font-bold">${totalLimit.toLocaleString('es-CL')}</span>
              </span>
            </div>

            <div className="w-full h-3 bg-default-100 dark:bg-surface-card rounded-full overflow-hidden shadow-inner">
               <div
                 className={`h-full transition-all duration-1000 rounded-full ${
                   healthPercentage > 80 ? 'bg-[#f31260]' :
                   healthPercentage > 50 ? 'bg-warning' : 'bg-[#17c964]'
                 }`}
                 style={{ width: `${Math.min(healthPercentage, 100)}%` }}
               />
             </div>

             <div className="flex items-center justify-between text-[11px] font-bold text-[#5a5a72] dark:text-[#a0a0b8] mt-1">
               <span>0%</span>
               <span className={healthPercentage > 80 ? 'text-[#f31260]' : healthPercentage > 50 ? 'text-warning' : ''}>
                 {healthPercentage.toFixed(1)}% Comprometido
               </span>
               <span>100%</span>
             </div>
          </div>
        </div>
      </div>

      {/* 3. Compras Activas en Cuotas */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center px-1">
          <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
            <LayoutList size={20} className="text-[#6d28d9]" /> Compras Activas (Cuotas)
          </h3>
        </div>
        {activeInstallments.length === 0 ? (
          <div className="bg-white dark:bg-surface-card border border-transparent dark:border-border-subtle rounded-3xl p-6 shadow-sm flex items-center justify-center text-center gap-3">
            <CheckCircle2 className="text-[#17c964]" size={24} />
            <span className="font-bold text-[#5a5a72] dark:text-[#a0a0b8]">No tienes compras en cuotas activas.</span>
          </div>
        ) : (
          <div className="bg-white dark:bg-surface-card border border-transparent dark:border-border-subtle rounded-3xl p-2 shadow-sm flex flex-col">
            {activeInstallments.map((tx, i) => {
              const current = tx.installment_current || 1;
              const total = tx.installment_total || 1;
              const progress = (current / total) * 100;
              const catColor = getCategoryColor(tx.category_id);

              return (
                <div key={tx.id} className={`flex flex-col gap-3 p-4 rounded-2xl ${i !== activeInstallments.length - 1 ? 'border-b border-default-100 dark:border-border-subtle' : ''}`}>
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${catColor}15`, color: catColor }}>
                        <Activity size={18} />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-foreground text-sm">{tx.name || getCategoryName(tx.category_id)}</span>
                        <span className="text-xs text-[#5a5a72] dark:text-[#a0a0b8] font-medium">Cuota {current} de {total}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="font-black text-foreground text-sm">${tx.amount.toLocaleString('es-CL')}</span>
                      <span className="text-[10px] text-[#5a5a72] uppercase font-bold">Por cuota</span>
                    </div>
                  </div>
                  {/* Progress bar for the installment */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-1.5 bg-default-100 dark:bg-surface-card rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, backgroundColor: catColor }} />
                    </div>
                    <span className="text-[10px] font-bold text-[#5a5a72]">{Math.round(progress)}% pagado</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3.5 Navegación Semanal de Movimientos */}
      <CreditCardWeeklyNavigator
        transactions={transactions}
        categories={categories}
        color={bank?.color || '#6d28d9'}
      />

      {/* 4. Gráficos de Tendencia */}
      <CreditCardDetailCharts
        transactions={transactions}
        color={bank?.color || '#6d28d9'}
      />

      {/* 5. Historial de Pagos (Calendario) */}
      <CreditCardPaymentCalendar statements={billingStatements} />

      {/* 6. Resumen Técnico / Ficha */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center px-1">
          <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Info size={20} className="text-[#6d28d9]" /> Ficha Técnica
          </h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">

          <div className="bg-white dark:bg-surface-card border border-transparent dark:border-border-subtle rounded-2xl p-4 flex flex-col gap-1 shadow-sm">
            <span className="text-xs font-bold text-[#5a5a72] dark:text-[#a0a0b8] uppercase tracking-wider">Fecha de Corte</span>
            <div className="flex items-end gap-1 mt-1">
              <span className="text-xl font-black text-foreground">Día {card.billing_date}</span>
            </div>
            <span className="text-[10px] text-[#5a5a72]">De cada mes</span>
          </div>

          <div className="bg-white dark:bg-surface-card border border-transparent dark:border-border-subtle rounded-2xl p-4 flex flex-col gap-1 shadow-sm">
            <span className="text-xs font-bold text-[#5a5a72] dark:text-[#a0a0b8] uppercase tracking-wider">Fecha de Pago</span>
            <div className="flex items-end gap-1 mt-1">
              <span className="text-xl font-black text-foreground">Día {card.payment_date}</span>
            </div>
            <span className="text-[10px] text-[#5a5a72]">Del mes siguiente</span>
          </div>

          <div className="bg-white dark:bg-surface-card border border-transparent dark:border-border-subtle rounded-2xl p-4 flex flex-col gap-1 shadow-sm">
            <span className="text-xs font-bold text-[#5a5a72] dark:text-[#a0a0b8] uppercase tracking-wider">Mantención</span>
            <div className="flex items-end gap-1 mt-1">
              <span className="text-xl font-black text-foreground">
                {card.maintenance_currency === 'uf' ? `${card.maintenance_cost} UF` : `$${card.maintenance_cost.toLocaleString('es-CL')}`}
              </span>
            </div>
            <span className="text-[10px] text-[#5a5a72]">Costo fijo</span>
          </div>

          <div className="bg-white dark:bg-surface-card border border-transparent dark:border-border-subtle rounded-2xl p-4 flex flex-col gap-1 shadow-sm min-w-0">
            <span className="text-xs font-bold text-[#5a5a72] dark:text-[#a0a0b8] uppercase tracking-wider">Int. Mensual</span>
            <div className="flex items-end gap-1 mt-1 min-w-0">
              <span className="text-xl font-black text-foreground truncate block">{card.monthly_interest_rate}%</span>
            </div>
            <span className="text-[10px] text-[#5a5a72]">Tasa base</span>
          </div>

          <div className="bg-white dark:bg-surface-card border border-transparent dark:border-border-subtle rounded-2xl p-4 flex flex-col gap-1 shadow-sm min-w-0">
            <span className="text-xs font-bold text-[#5a5a72] dark:text-[#a0a0b8] uppercase tracking-wider">Int. Mora</span>
            <div className="flex items-end gap-1 mt-1 min-w-0">
              <span className="text-xl font-black text-[#f31260] truncate block">{card.default_interest_rate || 0}%</span>
            </div>
            <span className="text-[10px] text-[#f31260]">Penalización</span>
          </div>

        </div>
      </div>

      <CreditCardEditModal
        isOpen={isEditOpen}
        onOpenChange={setIsEditOpen}
        card={card}
        banks={banks}
      />

      <CreditCardDeleteModal
        isOpen={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        card={card}
      />

    </div>
  );
}
