import { useFinancialSettings } from '@/features/settings/hooks/useFinancialSettings';
import { getFinancialCycle, isInFinancialCycle, financialCycleLabel } from '@/utils/financialCycle';
import { selectActiveAccounts } from '@/features/wallet/selectors/accountSelectors';
import { Account, Transaction, Category } from "@/types";
import { useMemo, useState, useEffect } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface WealthChartProps {
  accounts: Account[];
  transactions: Transaction[];
  categories: Category[];
  activeTab: 'cuentas' | 'gastos';
  currentMonth: Date;
}

export function WealthChart({ accounts, transactions, categories, activeTab, currentMonth }: WealthChartProps) {
  const { settings: { financial_cycle_start_day: cycleStartDay } } = useFinancialSettings();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const regularAccounts = useMemo(() => {
    return selectActiveAccounts(accounts).filter(a => a.include_in_total !== false && a.type?.toLowerCase() !== 'ahorro' && !a.name?.toLowerCase().includes('ahorro'));
  }, [accounts]);

  const totalWealth = useMemo(() => {
    return regularAccounts.reduce((sum, acc) => sum + acc.balance, 0);
  }, [regularAccounts]);

  const chartData = useMemo(() => {
    if (activeTab === 'cuentas') {
      return regularAccounts
        .filter(acc => acc.balance > 0)
        .map(acc => ({
          name: acc.name,
          value: acc.balance,
          color: acc.color || '#6d28d9'
        }));
    } else {
      // Gastos tab
      const cycle = getFinancialCycle(currentMonth, cycleStartDay); // 'YYYY-MM'

      const monthlyExpenses = transactions.filter(tx =>
        tx.type === 'expense' && !tx.billing_payment &&
        !tx.transfer_group_id &&
        tx.status === 'paid' &&
        isInFinancialCycle(tx.date, cycle) &&
        !tx.name?.toLowerCase().includes('transferencia')
      );

      const categoryTotals: Record<string, { total: number, color: string, name: string }> = {};
      let totalSpent = 0;

      monthlyExpenses.forEach(tx => {
        totalSpent += tx.amount;
        if (tx.category_id) {
          const cat = categories.find(c => c.id === tx.category_id);
          const catName = cat?.name || 'Otros';
          const catColor = '#a0a0b8';

          if (!categoryTotals[tx.category_id]) {
            categoryTotals[tx.category_id] = { total: 0, color: catColor, name: catName };
          }
          categoryTotals[tx.category_id].total += tx.amount;
        } else {
          if (!categoryTotals['otros']) categoryTotals['otros'] = { total: 0, color: '#a0a0b8', name: 'Otros' };
          categoryTotals['otros'].total += tx.amount;
        }
      });

      const data: any[] = [];

      Object.values(categoryTotals).forEach(cat => {
        if (cat.total > 0) {
          data.push({
            name: cat.name,
            value: cat.total,
            color: '#a0a0b8'
          });
        }
      });

      return data;
    }
  }, [regularAccounts, transactions, categories, activeTab, currentMonth, totalWealth, cycleStartDay]);

  // Custom Tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-surface-card p-3 rounded-xl border border-default-200 dark:border-border-subtle shadow-xl">
          <p className="font-medium text-sm mb-1 text-foreground">{payload[0].name}</p>
          <p className="text-kyo-lightPurple font-medium">
            ${payload[0].value.toLocaleString('es-CL')}
          </p>
        </div>
      );
    }
    return null;
  };

  const renderCenterContent = () => {
    if (activeTab === 'cuentas') {
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-4">
          <span className="text-[10px] md:text-xs uppercase tracking-widest text-[#5a5a72] dark:text-[#a0a0b8] font-normal mb-0.5">
            Patrimonio Total
          </span>
          <span
            className="text-2xl md:text-3xl font-light tracking-tight text-foreground max-w-[140px] truncate pointer-events-auto"
            title={`$${totalWealth.toLocaleString('es-CL')}`}
          >
            ${totalWealth.toLocaleString('es-CL')}
          </span>
        </div>
      );
    } else {
      const monthlyExpenses = transactions.filter(tx =>
        tx.type === 'expense' && !tx.billing_payment &&
        !tx.transfer_group_id &&
        tx.status === 'paid' &&
        isInFinancialCycle(tx.date,getFinancialCycle(currentMonth,cycleStartDay)) &&
        !tx.name?.toLowerCase().includes('transferencia')
      );
      const totalSpent = monthlyExpenses.reduce((sum, tx) => sum + tx.amount, 0);

      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-4">
          <span className="text-[10px] md:text-xs uppercase tracking-widest text-[#5a5a72] dark:text-[#a0a0b8] font-normal mb-0.5">
            Total Gastado
          </span>
          <span
            className="text-2xl md:text-3xl font-light tracking-tight text-foreground max-w-[140px] truncate pointer-events-auto"
            title={`$${totalSpent.toLocaleString('es-CL')}`}
          >
            ${totalSpent.toLocaleString('es-CL')}
          </span>
        </div>
      );
    }
  };

  return (
    <div className="relative w-full h-[250px] md:h-[300px] flex items-center justify-center">
      {renderCenterContent()}

      {mounted && (
        <PieChart width={300} height={250}>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={80}
            outerRadius={110}
            stroke="none"
            paddingAngle={4}
            cornerRadius={20}
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      )}
    </div>
  );
}
