import { useFinancialSettings } from '@/features/settings/hooks/useFinancialSettings';
import { getFinancialCycle, financialCycleForMonth, isInFinancialCycle, financialCycleLabel } from '@/utils/financialCycle';
import { useState, useMemo } from "react";
import { Transaction, Category, Account } from "@/types";
import { Button } from "@heroui/react";
import * as LucideIcons from "lucide-react";
import { ArrowRightLeft, Search } from "lucide-react";

import { TransactionDetailModal } from "./TransactionDetailModal";

interface TransactionsViewProps {
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
}

export function TransactionsView({ transactions, categories, accounts }: TransactionsViewProps) {
  const { settings: { financial_cycle_start_day: cycleStartDay } } = useFinancialSettings();
  const [period, setPeriod] = useState(() => getFinancialCycle(new Date(), cycleStartDay).start);
  const cycle = getFinancialCycle(period, cycleStartDay);
  const movePeriod = (offset: number) => setPeriod(financialCycleForMonth(cycle.start.getFullYear(), cycle.start.getMonth() + offset, cycleStartDay).start);
  const [filter, setFilter] = useState<'all' | 'income' | 'expense' | 'transfer'>('all');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  const processedTransactions = useMemo(() => {
    const result: any[] = [];
    const skipIds = new Set<string>();
    const sortedAll = transactions.filter(tx => isInFinancialCycle(tx.date, cycle)).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    for (const tx of sortedAll) {
      if (skipIds.has(tx.id)) continue;

      const match = sortedAll.find(t =>
        !skipIds.has(t.id) &&
        t.id !== tx.id &&
        Boolean(tx.transfer_group_id) &&
        t.transfer_group_id === tx.transfer_group_id &&
        t.account_id !== tx.account_id &&
        t.type !== tx.type
      );

      if (match) {
        skipIds.add(match.id);
        const expenseTx = tx.type === 'expense' ? tx : match;
        const incomeTx = tx.type === 'income' ? tx : match;

        const originAccount = accounts.find(a => a.id === expenseTx.account_id);
        const destAccount = accounts.find(a => a.id === incomeTx.account_id);

        result.push({
          ...expenseTx,
          isGroupedTransfer: true,
          transferText: `${originAccount?.name || 'Origen'} → ${destAccount?.name || 'Destino'}`
        });
        continue;
      }
      result.push(tx);
    }
    return result;
  }, [transactions, accounts, cycle.start.getTime(), cycle.nextStart.getTime()]);

  const filteredTransactions = useMemo(() => {
    return processedTransactions.filter(t => {
      if (filter === 'all') return true;
      if (filter === 'transfer') return t.isGroupedTransfer || t.name?.toLowerCase().includes('transferencia');
      return t.type === filter && !t.isGroupedTransfer;
    });
  }, [processedTransactions, filter]);

  // Agrupar por fecha
  const groups = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    filteredTransactions.forEach(t => {
      const txDate = new Date(t.date);
      const dateStr = txDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
      if (!grouped[dateStr]) grouped[dateStr] = [];
      grouped[dateStr].push(t);
    });
    return grouped;
  }, [filteredTransactions]);

  return (
    <div className="flex flex-col gap-6 w-full">

      <div className="flex items-center justify-between gap-2 text-sm">
        <button aria-label="Mes financiero anterior" onClick={() => movePeriod(-1)} className="rounded-xl border border-border-subtle p-2">←</button>
        <span>{financialCycleLabel(cycle)}</span>
        <button aria-label="Mes financiero siguiente" onClick={() => movePeriod(1)} className="rounded-xl border border-border-subtle p-2">→</button>
      </div>
      {/* Filtros */}
      <div className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden px-2">
        {[
          { id: 'all', name: 'Todos' },
          { id: 'income', name: 'Ingresos' },
          { id: 'expense', name: 'Gastos' },
          { id: 'transfer', name: 'Transferencias' }
        ].map(f => (
          <Button
            key={f.id}
            size="sm"
            className={filter === f.id ? "bg-white dark:bg-surface-raised text-foreground shadow-sm font-medium rounded-2xl" : "bg-transparent text-default-500 hover:text-foreground font-medium rounded-2xl"}
            onPress={() => setFilter(f.id as any)}
          >
            {f.name}
          </Button>
        ))}
      </div>

      {/* Lista de Movimientos */}
      <div className="flex flex-col gap-6">
        {Object.entries(groups).map(([date, txs]) => (
          <div key={date} className="flex flex-col gap-3">
            <h3 className="text-sm font-bold text-default-500 uppercase tracking-wider px-2">{date}</h3>
            <div className="bg-white dark:bg-surface-card border border-transparent dark:border-border-subtle shadow-sm rounded-xl overflow-hidden flex flex-col p-2 gap-1">
              {txs.map(tx => {
                const isTransfer = tx.isGroupedTransfer || tx.name?.toLowerCase().includes('transferencia');

                const originAccount = accounts.find(a => a.id === tx.account_id);
                const accountStr = tx.isGroupedTransfer ? ` · ${tx.transferText}` : (originAccount ? ` · ${originAccount.name}` : '');

                const cat = categories.find(c => c.id === tx.category_id);
                const IconComponent = cat && !isTransfer ? ((LucideIcons as any)[cat.icon_name] || LucideIcons.ShoppingCart) : null;

                return (
                  <div
                    key={tx.id}
                    className="flex justify-between items-center p-3 hover:bg-default-50 dark:hover:bg-surface-card rounded-lg transition-colors cursor-pointer"
                    onClick={() => setSelectedTx(tx)}
                  >
                    <div className="flex items-center gap-4">
                      {isTransfer ? (
                        <div className="w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center text-[#6d28d9]">
                          <ArrowRightLeft size={18} />
                        </div>
                      ) : (
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center"
                          style={{
                            backgroundColor: cat ? '#a0a0b820' : (tx.type === 'income' ? 'rgba(23, 201, 100, 0.1)' : 'rgba(243, 18, 96, 0.1)'),
                            color: cat ? '#a0a0b8' : (tx.type === 'income' ? '#17c964' : '#f31260')
                          }}
                        >
                          {IconComponent ? <IconComponent size={18} /> : <span className="font-bold">{tx.name?.charAt(0).toUpperCase()}</span>}
                        </div>
                      )}

                      <div className="flex flex-col">
                        <span className="font-normal text-[15px] text-foreground">{tx.name}</span>
                        <span className="text-xs text-[#a0a0b8] font-light">
                          {tx.isGroupedTransfer ? 'Transferencia' : (isTransfer ? 'Transferencia' : (cat?.name || 'Otros'))}
                          {accountStr}
                        </span>
                      </div>
                    </div>
                    <span className={`font-normal text-[15px] ${isTransfer ? 'text-foreground' : tx.type === 'income' ? 'text-success' : 'text-danger'}`}>
                      {isTransfer ? '' : tx.type === 'income' ? '+' : '-'}${tx.amount.toLocaleString('es-CL')}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {filteredTransactions.length === 0 && (
          <div className="text-center py-20 flex flex-col items-center gap-3 opacity-50">
            <Search size={40} className="text-default-400 mb-2" />
            <div className="text-sm font-medium text-default-500">No se encontraron movimientos.</div>
          </div>
        )}
      </div>

      {selectedTx && (
        <TransactionDetailModal
          isOpen={!!selectedTx}
          onOpenChange={(open) => !open && setSelectedTx(null)}
          transaction={selectedTx}
          categories={categories}
          accounts={accounts}
        />
      )}

    </div>
  );
}
