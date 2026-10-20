import { useState, useMemo } from "react";
import { Transaction, Category, CreditCard, Account, Goal, BillingStatement } from "@/types";
import { AgendaCalendar } from "./AgendaCalendar";
import { PaymentValidationModalV3 } from "@/features/dashboard/components/PaymentValidationModalV3";
import { BillingPaymentModalV3 } from "@/features/dashboard/components/BillingPaymentModalV3";

interface AgendaOverviewProps {
  transactions: Transaction[];
  categories: Category[];
  creditCards: CreditCard[];
  accounts: Account[];
  goals: Goal[];
  billingStatements: BillingStatement[];
  onRefresh: () => void;
}

export type AgendaEvent = {
  id: string;
  type: "tx" | "stmt";
  date: Date;
  data: Transaction | BillingStatement;
  title: string;
  subtitle: string;
  amount: number;
  isIncome: boolean;
  status: string;
};

export function AgendaOverview({
  transactions,
  categories,
  creditCards,
  accounts,
  goals,
  billingStatements,
  onRefresh
}: AgendaOverviewProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Combine transactions and statements into a unified "event" array
  const events = useMemo(() => {
    const list: AgendaEvent[] = [];

    // Pendientes transactions
    const pendingTx = transactions.filter(t => t.status === "pending");
    for (const tx of pendingTx) {
      const targetDate = tx.due_date || tx.date;
      if (!targetDate) continue;
      const targetDateStr = targetDate.split('T')[0];
      const date = new Date(targetDateStr + "T00:00:00");

      const isGoal = !!tx.goal_id;
      const goal = isGoal ? goals.find(g => g.id === tx.goal_id) : undefined;
      const category = categories.find(c => c.id === tx.category_id);

      const title = isGoal && goal ? goal.name : (tx.name || category?.name || "Transacción");
      const subtitle = isGoal ? "Meta de ahorro" : (category?.name || "General");

      list.push({
        id: `tx-${tx.id}`,
        type: "tx",
        date,
        data: tx,
        title,
        subtitle,
        amount: tx.amount,
        isIncome: tx.type === "income",
        status: tx.status || ""
      });
    }

    // Pendientes / partial statements
    const pendingStmts = billingStatements.filter(s => s.status === "pending" || s.status === "partial");
    for (const stmt of pendingStmts) {
      if (!stmt.payment_due_date) continue;
      const stmtDateStr = stmt.payment_due_date.split('T')[0];
      const date = new Date(stmtDateStr + "T00:00:00");
      const card = creditCards.find(c => c.id === stmt.credit_card_id);

      const title = card?.name || "Tarjeta de Crédito";
      const subtitle = "Estado de cuenta";
      const remaining = stmt.total_due - stmt.amount_paid;

      list.push({
        id: `stmt-${stmt.id}`,
        type: "stmt",
        date,
        data: stmt,
        title,
        subtitle,
        amount: remaining,
        isIncome: false,
        status: stmt.status || ""
      });
    }

    return list.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [transactions, billingStatements, creditCards, categories, goals]);

  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [selectedStatement, setSelectedStatement] = useState<BillingStatement | null>(null);

  const handlePay = (event: AgendaEvent) => {
    if (event.type === 'tx') {
      setSelectedTx(event.data as Transaction);
    } else {
      setSelectedStatement(event.data as BillingStatement);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center w-full mt-4">
      <AgendaCalendar
        events={events}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        onPay={handlePay}
      />

      {/* Modals */}
      {selectedTx && (
        <PaymentValidationModalV3
          transaction={selectedTx}
          accounts={accounts}
          category={categories.find(c => c.id === selectedTx.category_id)}
          goals={goals}
          isOpen={!!selectedTx}
          onClose={() => setSelectedTx(null)}
          onSuccess={() => {
            setSelectedTx(null);
            onRefresh();
          }}
        />
      )}

      {selectedStatement && (
        <BillingPaymentModalV3
          statement={selectedStatement}
          creditCard={creditCards.find(c => c.id === selectedStatement.credit_card_id)!}
          accounts={accounts}
          isOpen={!!selectedStatement}
          onClose={() => setSelectedStatement(null)}
          onSuccess={() => {
            setSelectedStatement(null);
            onRefresh();
          }}
        />
      )}
    </div>
  );
}
