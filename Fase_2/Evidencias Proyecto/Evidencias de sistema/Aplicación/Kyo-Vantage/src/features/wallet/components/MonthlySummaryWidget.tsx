import { Transaction } from "@/types";
import { Button, Card } from "@heroui/react";
import { ChevronLeft, ChevronRight, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { useMemo } from "react";

interface MonthlySummaryWidgetProps {
  currentMonth: Date;
  onMonthChange: (date: Date) => void;
  transactions: Transaction[];
}

export function MonthlySummaryWidget({ currentMonth, onMonthChange, transactions }: MonthlySummaryWidgetProps) {
  const monthName = currentMonth.toLocaleString('es-ES', { month: 'long', year: 'numeric' });
  const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);

  const { income, expense, surplus } = useMemo(() => {
    const currentMonthStr = currentMonth.toISOString().slice(0, 7); // 'YYYY-MM'

    let inc = 0;
    let exp = 0;

    transactions.forEach(tx => {
      if (tx.status === 'paid' && tx.date.startsWith(currentMonthStr)) {
        if (tx.type === 'transfer' || tx.transfer_group_id || tx.name?.toLowerCase().includes('transferencia')) return;

        if (tx.type === 'income') inc += tx.amount;
        if (tx.type === 'expense') exp += tx.amount;
      }
    });

    return { income: inc, expense: exp, surplus: inc - exp };
  }, [currentMonth, transactions]);

  const handlePrevMonth = () => {
    const d = new Date(currentMonth);
    d.setMonth(d.getMonth() - 1);
    onMonthChange(d);
  };

  const handleNextMonth = () => {
    const d = new Date(currentMonth);
    d.setMonth(d.getMonth() + 1);
    onMonthChange(d);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between px-2">
        <Button isIconOnly variant="ghost" onPress={handlePrevMonth} className="text-[#5a5a72] dark:text-[#a0a0b8] border-transparent hover:bg-default-100 dark:hover:bg-surface-card">
          <ChevronLeft size={20} />
        </Button>
        <span className="font-bold text-sm uppercase tracking-widest text-foreground">
          {capitalizedMonth}
        </span>
        <Button isIconOnly variant="ghost" onPress={handleNextMonth} className="text-[#5a5a72] dark:text-[#a0a0b8] border-transparent hover:bg-default-100 dark:hover:bg-surface-card">
          <ChevronRight size={20} />
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-white dark:bg-surface-card border border-transparent dark:border-border-subtle shadow-sm">
          <div className="p-3 md:p-4 flex flex-col items-center justify-center text-center gap-1">
            <span className="text-[10px] uppercase tracking-widest font-bold text-[#5a5a72] dark:text-[#a0a0b8]">Ingresos</span>
            <div className="flex items-center gap-1 text-success">
              <TrendingUp size={14} />
              <span className="font-bold text-sm md:text-base">${income.toLocaleString('es-CL')}</span>
            </div>
          </div>
        </Card>

        <Card className="bg-white dark:bg-surface-card border border-transparent dark:border-border-subtle shadow-sm">
          <div className="p-3 md:p-4 flex flex-col items-center justify-center text-center gap-1">
            <span className="text-[10px] uppercase tracking-widest font-bold text-[#5a5a72] dark:text-[#a0a0b8]">Gastos</span>
            <div className="flex items-center gap-1 text-danger">
              <TrendingDown size={14} />
              <span className="font-bold text-sm md:text-base">${expense.toLocaleString('es-CL')}</span>
            </div>
          </div>
        </Card>

        <Card className="bg-white dark:bg-surface-card border border-transparent dark:border-border-subtle shadow-sm">
          <div className="p-3 md:p-4 flex flex-col items-center justify-center text-center gap-1">
            <span className="text-[10px] uppercase tracking-widest font-bold text-[#5a5a72] dark:text-[#a0a0b8]">Excedente</span>
            <div className={`flex items-center gap-1 ${surplus > 0 ? 'text-success' : surplus < 0 ? 'text-danger' : 'text-warning'}`}>
              {surplus > 0 ? <TrendingUp size={14} /> : surplus < 0 ? <TrendingDown size={14} /> : <Minus size={14} />}
              <span className="font-bold text-sm md:text-base">${Math.abs(surplus).toLocaleString('es-CL')}</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
