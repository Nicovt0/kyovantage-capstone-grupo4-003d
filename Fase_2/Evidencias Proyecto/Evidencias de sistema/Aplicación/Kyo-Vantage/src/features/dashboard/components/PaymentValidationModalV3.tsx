import { useAccountingAction } from '@/features/accounting/hooks/useAccountingAction';
import { useState, useEffect } from 'react';
import { Transaction, Account, Category, Goal } from "@/types";
import { X, Landmark, Calendar, DollarSign, Check, ChevronDown, PiggyBank, Edit2, SkipForward } from 'lucide-react';
import { confirmPendingTransaction, skipPendingTransaction } from '@/features/wallet/api/transactionRepository';
import { Button, Spinner } from '@heroui/react';
import { usePrivateMutation } from '@/features/app-shell/hooks/usePrivateMutation';

interface PaymentValidationModalV3Props {
  transaction: Transaction;
  accounts: Account[];
  category?: Category;
  goals?: Goal[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function PaymentValidationModalV3({ transaction, accounts, category, goals = [], isOpen, onClose, onSuccess }: PaymentValidationModalV3Props) {
  const { runMutation } = usePrivateMutation();
  const runAccounting = useAccountingAction();
  const [name, setName] = useState<string>(transaction.name || (category?.name || 'Transacción'));
  const [amount, setAmount] = useState<string>(transaction.amount.toLocaleString('es-CL'));

  const originAccounts = accounts.filter(a => a.type !== 'ahorro' && a.type !== 'saving' && !a.is_archived);
  const destAccounts = accounts.filter(a => (a.type === 'ahorro' || a.type === 'saving') && !a.is_archived);

  const [selectedOrigin, setSelectedOrigin] = useState<string>(transaction.account_id || (originAccounts.length > 0 ? originAccounts[0].id : ''));
  const [selectedDest, setSelectedDest] = useState<string>(''); // For goals

  const pad = (n: number) => n.toString().padStart(2, '0');
  const getLocalDate = () => {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  const [paymentDate, setPaymentDate] = useState<string>(getLocalDate());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isOriginDropdownOpen, setIsOriginDropdownOpen] = useState(false);
  const [isDestDropdownOpen, setIsDestDropdownOpen] = useState(false);

  const isGoal = !!transaction.goal_id;
  const isIncome = transaction.type === 'income';

  const [isOptional, setIsOptional] = useState(false);

  useEffect(() => {
    if (isOpen && transaction.is_recurring) {
      import('@/features/settings/api/recurringRepository').then(mod => {
        mod.getRecurringTemplates().then(templates => {
          const t = templates.find(temp => temp.name === transaction.name);
          if (t && t.is_essential === false) {
            setIsOptional(true);
          } else {
            setIsOptional(false);
          }
        });
      });
    } else {
      setIsOptional(false);
    }
  }, [isOpen, transaction.is_recurring, transaction.name]);

  useEffect(() => {
    if (isOpen) {
      setAmount(transaction.amount.toLocaleString('es-CL'));

      const origins = accounts.filter(a => a.type !== 'ahorro' && a.type !== 'saving' && !a.is_archived);
      const dests = accounts.filter(a => (a.type === 'ahorro' || a.type === 'saving') && !a.is_archived);

      setSelectedOrigin(transaction.account_id || (origins.length > 0 ? origins[0].id : ''));
      setPaymentDate(getLocalDate());

      if (transaction.goal_id) {
        setName(transaction.name || `Abono a Meta`);
        if (dests.length > 0) setSelectedDest(dests[0].id);
      } else {
        setName(transaction.name || category?.name || 'Transacción');
        setSelectedDest('');
      }
    }
  }, [isOpen, transaction.id]);

  if (!isOpen) return null;

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    if (rawValue === '') {
      setAmount('');
      return;
    }
    const num = parseInt(rawValue, 10);
    setAmount(num.toLocaleString('es-CL'));
  };

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      const parsedAmount = parseInt(amount.replace(/\D/g, ''), 10);
      const [year, month, day] = paymentDate.split('-').map(Number);
      const finalDate = new Date(year, month - 1, day, 12, 0, 0);

      const payload = {
        transaction,
        name,
        amount: parsedAmount,
        accountId: selectedOrigin,
        date: finalDate.toISOString(),
        savingsAccountId: isGoal ? selectedDest : undefined,
      } as const;
      await runMutation(() => runAccounting(payload, requestId => confirmPendingTransaction({ ...payload, requestId })));

      onSuccess();
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = async () => {
    setIsSubmitting(true);
    try {
      const goal = isGoal && transaction.goal_id
        ? goals.find(item => item.id === transaction.goal_id)
        : undefined;
      await runMutation(() => skipPendingTransaction(transaction, goal));
      onSuccess();
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedOriginObj = originAccounts.find(a => a.id === selectedOrigin);
  const selectedDestObj = destAccounts.find(a => a.id === selectedDest);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/80 transition-opacity">
      <div
        className="w-full max-w-md bg-white dark:bg-surface-card border border-[#6d28d9]/30 rounded-t-[32px] p-6 shadow-2xl"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.5rem)' }}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-black text-foreground">
            {isGoal ? 'Confirmar Aporte' : (isIncome ? 'Confirmar Ingreso' : 'Confirmar Gasto')}
          </h2>
          <button
            onClick={onClose} className="p-2 hover:bg-black/5 dark:bg-surface-card rounded-full transition-colors">
            <X size={20} className="text-[#a0a0b8]" />
          </button>
        </div>

        <div className="flex flex-col gap-5">

          {/* Nombre */}
          <div className="flex flex-col gap-2 relative w-full">
            <label className="text-[10px] font-bold text-[#a0a0b8] uppercase tracking-widest ml-1">Descripción</label>
            <div className="flex items-center gap-3 bg-black/5 dark:bg-surface-card p-3.5 rounded-xl border border-transparent focus-within:border-[#6d28d9]/50 transition-colors shadow-sm">
              <Edit2 size={16} className="text-[#6d28d9] shrink-0" />
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="bg-transparent border-none outline-none w-full font-bold text-foreground text-sm"
              />
            </div>
          </div>

          {/* Monto */}
          <div className="flex flex-col gap-2 w-full">
            <label className="text-[10px] font-bold text-[#a0a0b8] uppercase tracking-widest ml-1">Monto del {isGoal ? 'Aporte' : 'Movimiento'}</label>
            <div className="flex items-center gap-2 bg-black/5 dark:bg-surface-card p-3.5 rounded-xl border border-transparent focus-within:border-[#6d28d9]/50 transition-colors shadow-sm">
              <span className={`font-bold shrink-0 ${isGoal ? 'text-[#17c964]' : 'text-[#6d28d9]'}`}>$</span>
              <input
                type="text"
                value={amount}
                onChange={handleAmountChange}
                className="bg-transparent border-none outline-none w-full font-black text-foreground text-xl"
              />
            </div>
          </div>

          {/* Origen / Destino */}
          <div className="flex flex-col gap-2 relative w-full">
            <label className="text-[10px] font-bold text-[#a0a0b8] uppercase tracking-widest ml-1">
              {isIncome ? 'Cuenta de Destino' : 'Cuenta de Origen'}
            </label>
            <div
              className="bg-black/5 dark:bg-surface-card p-3.5 rounded-xl border border-transparent cursor-pointer flex justify-between items-center transition-colors shadow-sm hover:border-[#6d28d9]/50"
              onClick={() => setIsOriginDropdownOpen(!isOriginDropdownOpen)}
            >
              {selectedOriginObj ? (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-black/10 dark:bg-surface-raised flex items-center justify-center">
                    <Landmark size={14} className="text-[#006FEE]" />
                  </div>
                  <span className="font-bold text-sm text-foreground">{selectedOriginObj.name}</span>
                </div>
              ) : (
                <span className="text-[#5a5a72] text-sm font-semibold">Seleccionar cuenta...</span>
              )}
              <ChevronDown size={16} className="text-[#5a5a72]" />
            </div>

            {isOriginDropdownOpen && (
              <div className="absolute top-[80px] left-0 right-0 bg-white dark:bg-surface-card border border-[#6d28d9]/30 rounded-2xl shadow-xl z-20 max-h-48 overflow-y-auto p-2 flex flex-col gap-1">
                {originAccounts.map(acc => (
                  <div
                    key={acc.id}
                    className="flex items-center gap-3 p-2 hover:bg-black/5 dark:bg-surface-card rounded-xl cursor-pointer transition-colors"
                    onClick={() => { setSelectedOrigin(acc.id); setIsOriginDropdownOpen(false); }}
                  >
                    <div className="w-8 h-8 rounded-xl bg-black/10 dark:bg-surface-raised flex items-center justify-center">
                      <Landmark size={14} className="text-[#006FEE]" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-foreground">{acc.name}</span>
                      <span className="text-[10px] text-[#a0a0b8]">Balance: ${acc.balance.toLocaleString('es-CL')}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Destino (Solo para Metas) */}
          {isGoal && destAccounts.length > 0 && (
            <div className="flex flex-col gap-2 relative w-full">
              <label className="text-[10px] font-bold text-[#a0a0b8] uppercase tracking-widest ml-1">Cuenta de Destino (Ahorro)</label>
              <div
                className="bg-black/5 dark:bg-surface-card p-3.5 rounded-xl border border-transparent cursor-pointer flex justify-between items-center transition-colors shadow-sm hover:border-[#17c964]/50"
                onClick={() => setIsDestDropdownOpen(!isDestDropdownOpen)}
              >
                {selectedDestObj ? (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-black/10 dark:bg-surface-raised flex items-center justify-center">
                      <PiggyBank size={14} className="text-[#17c964]" />
                    </div>
                    <span className="font-bold text-sm text-foreground">{selectedDestObj.name}</span>
                  </div>
                ) : (
                  <span className="text-[#5a5a72] text-sm font-semibold">Seleccionar cuenta de ahorro...</span>
                )}
                <ChevronDown size={16} className="text-[#5a5a72]" />
              </div>

              {isDestDropdownOpen && (
                <div className="absolute top-[80px] left-0 right-0 bg-white dark:bg-surface-card border border-[#17c964]/30 rounded-2xl shadow-xl z-20 max-h-48 overflow-y-auto p-2 flex flex-col gap-1">
                  {destAccounts.map(acc => (
                    <div
                      key={acc.id}
                      className="flex items-center gap-3 p-2 hover:bg-black/5 dark:bg-surface-card rounded-xl cursor-pointer transition-colors"
                      onClick={() => { setSelectedDest(acc.id); setIsDestDropdownOpen(false); }}
                    >
                      <div className="w-8 h-8 rounded-xl bg-black/10 dark:bg-surface-raised flex items-center justify-center">
                        <PiggyBank size={14} className="text-[#17c964]" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-foreground">{acc.name}</span>
                        <span className="text-[10px] text-[#a0a0b8]">Balance: ${acc.balance.toLocaleString('es-CL')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Fecha */}
          <div className="flex flex-col gap-2 w-full">
            <label className="text-[10px] font-bold text-[#a0a0b8] uppercase tracking-widest ml-1">Fecha de Pago (No editable)</label>
            <div className="flex items-center gap-3 bg-black/5 dark:bg-surface-card p-3 rounded-xl border border-transparent opacity-60">
              <Calendar size={16} className="text-[#a0a0b8]" />
              <input
                type="date"
                value={paymentDate}
                className="bg-transparent border-none outline-none w-full text-sm font-bold text-foreground cursor-not-allowed"
                style={{ colorScheme: 'dark' }}
                readOnly
              />
            </div>
          </div>

          <Button
            className="w-full h-14 bg-brand-primary text-white font-bold shadow-md hover:bg-[#5b21b6] mt-4 rounded-xl text-md"
            isDisabled={
              isSubmitting ||
              !amount ||
              !selectedOrigin ||
              (isGoal && !selectedDest) ||
              (!isIncome && ((originAccounts.find(a => a.id === selectedOrigin)?.balance ?? 0) + (originAccounts.find(a => a.id === selectedOrigin)?.overdraft_limit ?? 0)) < (parseInt(amount.replace(/\D/g, ''), 10) || 0))
            }
            onPress={handleConfirm}
          >
            {isSubmitting ? <Spinner color="current" size="sm" /> :
             (!isIncome && ((originAccounts.find(a => a.id === selectedOrigin)?.balance ?? 0) + (originAccounts.find(a => a.id === selectedOrigin)?.overdraft_limit ?? 0)) < (parseInt(amount.replace(/\D/g, ''), 10) || 0)
               ? 'Fondos Insuficientes'
               : (isGoal ? 'Confirmar Aporte' : (isIncome ? 'Confirmar Cobro' : 'Confirmar Pago')))}
          </Button>

          {(isOptional || isGoal) && (
            <Button
              className="w-full h-12 bg-transparent text-[#5a5a72] dark:text-[#a0a0b8] font-bold hover:bg-black/5 dark:hover:bg-white/5 mt-1 rounded-xl text-sm flex items-center gap-2"
              isDisabled={isSubmitting}
              onPress={handleSkip}
            >
              <SkipForward size={16} />
              {isGoal
                ? (goals.find(g => g.id === transaction.goal_id)?.contribution_type === 'fixed'
                    ? 'Omitir (extiende plazo 1 mes)'
                    : goals.find(g => g.id === transaction.goal_id)?.contribution_type === 'auto'
                      ? 'Omitir (recalcula cuota)'
                      : 'Omitir aporte')
                : 'Omitir este mes'
              }
            </Button>
          )}

        </div>
      </div>
    </div>
  );
}
