import { useNavigate, Link } from 'react-router-dom';
import { useMemo } from "react";
import { CreditCard as CreditCardIcon, Activity, ArrowRightLeft, CalendarCheck } from "lucide-react";
import { CreditCard, Bank, Transaction, Category, BillingStatement } from "@/types";
import * as LucideIcons from 'lucide-react';
import { CreditCardCarousel } from "@/features/credit-cards/components/CreditCardCarousel";

interface CreditCardsOverviewProps {
  creditCards: CreditCard[];
  banks: Bank[];
  transactions: Transaction[];
  categories: Category[];
  billingStatements?: BillingStatement[];
  onAddCard?: () => void;
}

export function CreditCardsOverview({ creditCards, banks, transactions, categories, billingStatements = [], onAddCard }: CreditCardsOverviewProps) {

  const navigate = useNavigate();

  // Recent transactions (Global)
  const recentTransactions = [...transactions]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 10);

  const { totalLimit, totalDebt, totalAvailable, totalToPay, utilization } = useMemo(() => {
    let limit = 0;
    let debt = 0;
    let toPay = 0;

    creditCards.forEach(card => {
      limit += card.total_limit || 0;
      debt += card.current_debt || 0;
    });

    billingStatements.forEach(s => {
      if (s.status === 'pending' || s.status === 'partial') {
        toPay += Math.max(0, s.total_due - s.amount_paid);
      }
    });

    const utilization = limit > 0 ? (debt / limit) * 100 : 0;

    return {
      totalLimit: limit,
      totalDebt: debt,
      totalAvailable: Math.max(0, limit - debt),
      totalToPay: toPay,
      utilization
    };
  }, [creditCards, billingStatements]);

  const getBankColor = (bankId: string) => banks.find(b => b.id === bankId)?.color || '#6d28d9';
  const getCategoryColor = (categoryId: string) => '#a0a0b8';
  const getCategoryName = (categoryId: string) => categories.find(c => c.id === categoryId)?.name || 'Categoría';

  return (
    <div className="flex flex-col gap-6">

      {/* 1. Resumen General — Siempre visible */}
      <div className="mb-2">
        <div className="rounded-[28px] bg-white dark:bg-surface-card border border-black/5 dark:border-border-subtle p-5 flex flex-col gap-4 relative overflow-hidden shadow-sm">

          {/* Brillo decorativo */}
          <div className="absolute -right-8 -bottom-8 w-36 h-36 bg-brand-primary rounded-full blur-3xl opacity-10 dark:opacity-20 pointer-events-none" />

          {/* Deuda Total */}
          <div className="flex flex-col items-center text-center z-10">
            <span className="text-xs font-medium text-[#5a5a72] dark:text-[#a0a0b8] mb-1">Deuda total</span>
            <span className="font-black text-4xl text-foreground tracking-tighter">
              ${totalDebt.toLocaleString('es-CL')}
            </span>
            {/* Progress bar */}
            <div className="w-full max-w-xs h-1.5 bg-black/5 dark:bg-white/10 rounded-full overflow-hidden mt-3">
              <div
                className={`h-full rounded-full transition-all duration-1000 ease-out ${
                  utilization > 80 ? 'bg-danger' : utilization > 50 ? 'bg-warning' : 'bg-[#7c3aed]'
                }`}
                style={{ width: `${Math.min(utilization, 100)}%` }}
              />
            </div>
            <span className="text-[11px] text-[#5a5a72] dark:text-[#a0a0b8] mt-1.5">
              {utilization.toFixed(0)}% de ${totalLimit.toLocaleString('es-CL')} usado
            </span>
          </div>

          {/* Disponible + Tarjetas activas */}
          <div className="grid grid-cols-2 gap-3 z-10">
            <div className="bg-default-50 dark:bg-white/5 rounded-2xl p-3 flex flex-col gap-0.5">
              <span className="text-[10px] text-[#5a5a72] dark:text-[#a0a0b8]">Disponible</span>
              <span className="font-bold text-success text-base">${totalAvailable.toLocaleString('es-CL')}</span>
            </div>
            <div className="bg-default-50 dark:bg-white/5 rounded-2xl p-3 flex flex-col gap-0.5">
              <span className="text-[10px] text-[#5a5a72] dark:text-[#a0a0b8]">Tarjetas activas</span>
              <span className="font-bold text-foreground text-base">{creditCards.length}</span>
            </div>
          </div>

          {/* Próximo pago */}
          <div className={`flex items-center gap-3 rounded-2xl p-3.5 z-10 ${
            totalToPay > 0
              ? 'bg-brand-primary/10 dark:bg-brand-primary/30 border border-[#6d28d9]/30 dark:border-[#6d28d9]/40'
              : 'bg-default-50 dark:bg-white/5'
          }`}>
            <CalendarCheck size={18} className={totalToPay > 0 ? 'text-[#6d28d9] dark:text-[#a78bfa]' : 'text-[#5a5a72] dark:text-[#5a5a72]'} />
            <div className="flex flex-col">
              <span className="text-[10px] font-semibold text-[#5a5a72] dark:text-[#a0a0b8] uppercase tracking-wider">Próximo pago</span>
              {totalToPay > 0 ? (
                <span className="font-bold text-foreground text-sm">${totalToPay.toLocaleString('es-CL')} pendiente</span>
              ) : (
                <span className="font-medium text-[#5a5a72] dark:text-[#a0a0b8] text-sm">Sin pagos pendientes</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-foreground font-medium text-lg">
          <CreditCardIcon size={20} className="text-[#6d28d9]" />
          <h2>Mis Tarjetas de Crédito</h2>
        </div>
        {/* Contador X/5 estilo metas */}
        <span className="text-sm font-medium text-[#5a5a72] dark:text-[#a0a0b8]">
          {creditCards.length}/5
        </span>
      </div>

      {/* 2. Carrusel — siempre visible con tarjeta de añadir integrada */}
      <div className="-mx-4 md:mx-0">
        <CreditCardCarousel
          creditCards={creditCards}
          banks={banks}
          billingStatements={billingStatements}
          onCardClick={(cardId) => navigate(`/credit-cards/detail?id=${cardId}`)}
          onAddCardClick={onAddCard}
        />
      </div>

      {/* 3. Lista Global de Últimas Compras — siempre visible */}
      <div className="flex flex-col gap-3 mt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-foreground font-medium text-lg">
            <ArrowRightLeft size={18} className="text-[#6d28d9]" />
            <span>Últimos movimientos</span>
          </div>
          <Link to="/wallet/transactions">
            <span className="text-sm font-medium text-[#6d28d9] hover:underline cursor-pointer">Ver todos</span>
          </Link>
        </div>

        <div className="bg-white dark:bg-surface-card border border-transparent dark:border-border-subtle shadow-sm rounded-3xl p-3 flex flex-col gap-2">
          {recentTransactions.length === 0 ? (
            <p className="text-sm text-default-500 text-center py-8">No hay movimientos registrados.</p>
          ) : (
            recentTransactions.map(tx => {
              const card = creditCards.find(c => c.id === tx.credit_card_id);
              const cat = categories.find(c => c.id === tx.category_id);
              const IconComponent = cat ? ((LucideIcons as any)[cat.icon_name] || Activity) : Activity;

              const txDate = new Date(tx.date);
              const isToday = txDate.getDate() === new Date().getDate() && txDate.getMonth() === new Date().getMonth() && txDate.getFullYear() === new Date().getFullYear();
              const dateStr = isToday ? 'Hoy' : txDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });

              return (
                <div
                  key={tx.id}
                  className="flex justify-between items-center hover:bg-default-50 dark:hover:bg-surface-card p-3 rounded-2xl transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center"
                      style={{
                        backgroundColor: cat ? '#a0a0b820' : 'rgba(243, 18, 96, 0.1)',
                        color: cat ? '#a0a0b8' : '#f31260'
                      }}
                    >
                      <IconComponent size={20} />
                    </div>

                    <div className="flex flex-col">
                      <span className="font-normal text-[15px] text-foreground">{tx.name}</span>
                      <span className="text-xs text-[#a0a0b8] font-light">
                        {dateStr} · {card?.name || 'Tarjeta'}
                      </span>
                    </div>
                  </div>
                  <span className="font-normal text-[15px] text-danger">
                    -${tx.amount.toLocaleString('es-CL')}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

    </div>
  );
}
