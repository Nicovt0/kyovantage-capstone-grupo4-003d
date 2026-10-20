import { useAccountingAction } from '@/features/accounting/hooks/useAccountingAction';
import { useState, useEffect } from 'react';
import { BillingStatement, CreditCard, Account, CreditCardLedger } from "@/types";
import { X, CreditCard as CreditCardIcon, DollarSign, Landmark, Calendar, Check, Edit2, ShoppingCart, Receipt, Wrench, Percent, ChevronDown } from 'lucide-react';
import { processCardPayment, getCreditCardLedger } from '@/features/credit-cards/api/creditCardRepository';
import { Button, Spinner } from '@heroui/react';
import { usePrivateMutation } from '@/features/app-shell/hooks/usePrivateMutation';

interface BillingPaymentModalV3Props {
  statement: BillingStatement;
  creditCard?: CreditCard;
  accounts: Account[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function BillingPaymentModalV3({ statement, creditCard, accounts, isOpen, onClose, onSuccess }: BillingPaymentModalV3Props) {
  const { runMutation } = usePrivateMutation();
  const runAccounting = useAccountingAction();
  const [paymentError, setPaymentError] = useState('');
  const [name, setName] = useState<string>(`Pago de Tarjeta ${creditCard?.name || ''}`);

  const remaining = statement.total_due - statement.amount_paid;
  const initialAmount = remaining > 0 ? remaining : 0;

  const [amount, setAmount] = useState<string>(initialAmount.toLocaleString('es-CL'));

  const originAccounts = accounts.filter(a => a.type !== 'ahorro' && a.type !== 'saving' && !a.is_archived);
  const [selectedOrigin, setSelectedOrigin] = useState<string>(originAccounts.length > 0 ? originAccounts[0].id : '');

  const pad = (n: number) => n.toString().padStart(2, '0');
  const getLocalDate = () => {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  const [paymentDate, setPaymentDate] = useState<string>(getLocalDate());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOriginDropdownOpen, setIsOriginDropdownOpen] = useState(false);

  const [activeInstallments, setActiveInstallments] = useState<CreditCardLedger[]>([]);

  useEffect(() => {
    if (isOpen) {
      const rem = statement.total_due - statement.amount_paid;
      setAmount(rem > 0 ? rem.toLocaleString('es-CL') : '0');

      const origins = accounts.filter(a => a.type !== 'ahorro' && a.type !== 'saving' && !a.is_archived);
      setSelectedOrigin(origins.length > 0 ? origins[0].id : '');
      setPaymentDate(getLocalDate());
      setName(`Pago de Tarjeta ${creditCard?.name || ''}`);

      if (creditCard?.id) {
        getCreditCardLedger(creditCard.id).then((res: any) => {
          // Filtrar compras activas y que sean a cuotas
          const installments = res.filter((r: any) => r.status === 'active' && r.installment_total > 1);
          setActiveInstallments(installments);
        });
      }
    }
  }, [isOpen, statement.id]);

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
    const parsedAmount = parseInt(amount.replace(/\D/g, ''), 10);
    if (!parsedAmount || parsedAmount <= 0 || !selectedOrigin || !creditCard?.id) return;

    setIsSubmitting(true);
    try {
      const [year, month, day] = paymentDate.split('-').map(Number);
      const finalDate = new Date(year, month - 1, day, 12, 0, 0);

      const payload = {
        userId: statement.user_id || '',
        cardId: creditCard.id,
        sourceAccountId: selectedOrigin,
        amountPaid: parsedAmount,
        billingStatementId: statement.id,
        customName: name,
        paymentDate: finalDate.toISOString()
      } as const;
      setPaymentError('');
      const res = await runMutation(() => runAccounting(payload, async requestId => {
        const saved = await processCardPayment({ ...payload, requestId });
        if (!saved.success) throw new Error(saved.error || 'No se pudo confirmar el pago.');
        return saved;
      }));

      if (res.success) {
        onSuccess();
        onClose();
      } else {
        console.error("Error pagando tarjeta:", res.error);
      }
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : 'No se pudo confirmar el pago.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedOriginObj = originAccounts.find(a => a.id === selectedOrigin);
  const formatCLP = (n: number) => `$${n.toLocaleString('es-CL')}`;

  const hasBreakdownItems = statement.consumed_amount > 0 || activeInstallments.length > 0 || statement.maintenance_cost > 0 || statement.interest_amount > 0;

  const parsedAmountForValidation = parseInt(amount.replace(/\D/g, ''), 10) || 0;
  const isAmountValid = parsedAmountForValidation >= statement.minimum_payment && parsedAmountForValidation <= remaining;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/80 transition-opacity">
      <div
        className="w-full max-w-md bg-white dark:bg-surface-card border border-[#6d28d9]/30 rounded-t-[32px] p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.5rem)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6d28d9] to-[#3C3489] flex items-center justify-center">
              <CreditCardIcon size={20} className="text-white" />
            </div>
            <div className="flex flex-col">
              <h3 className="text-lg font-black text-foreground">Estado de Cuenta</h3>
              <span className="text-xs text-[#a0a0b8]">{creditCard?.name} · Período {statement.billing_period}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-black/5 dark:bg-surface-card rounded-full transition-colors">
            <X size={20} className="text-[#a0a0b8]" />
          </button>
        </div>

        {paymentError && <p role="alert" className="mb-4 text-sm text-danger">{paymentError}</p>}
        {/* Breakdown Ticket */}
        {hasBreakdownItems && (
          <div className="bg-black/5 dark:bg-surface-card rounded-2xl border border-[#6d28d9]/20 p-4 mb-5 space-y-3 shadow-inner">
            <div className="text-[10px] font-bold text-[#a0a0b8] uppercase tracking-widest text-center mb-1">Desglose Facturado</div>

            {statement.consumed_amount > 0 && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingCart size={14} className="text-[#6d28d9]" />
                  <span className="text-xs text-[#d1d1e0] font-medium">Consumos directos (1 cuota)</span>
                </div>
                <span className="text-xs font-bold text-foreground">{formatCLP(statement.consumed_amount)}</span>
              </div>
            )}

            {activeInstallments.map((inst, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Receipt size={14} className="text-[#6d28d9]" />
                  <span className="text-xs text-[#d1d1e0] font-medium">{inst.installment_current}/{inst.installment_total} cuota de {inst.name}</span>
                </div>
                <span className="text-xs font-bold text-foreground">{formatCLP(inst.amount_per_installment)}</span>
              </div>
            ))}

            {statement.maintenance_cost > 0 && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wrench size={14} className="text-[#6d28d9]" />
                  <span className="text-xs text-[#d1d1e0] font-medium">Mantención</span>
                </div>
                <span className="text-xs font-bold text-foreground">{formatCLP(statement.maintenance_cost)}</span>
              </div>
            )}

            {statement.interest_amount > 0 && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Percent size={14} className="text-[#6d28d9]" />
                  <span className="text-xs text-[#d1d1e0] font-medium">Intereses</span>
                </div>
                <span className="text-xs font-bold text-foreground">{formatCLP(statement.interest_amount)}</span>
              </div>
            )}

            <div className="w-full h-px bg-gradient-to-r from-transparent via-[#6d28d9]/30 to-transparent my-2" />

            <div className="flex items-center justify-between px-1">
              <span className="text-sm font-bold text-[#d1d1e0]">Total a pagar</span>
              <span className="text-lg font-black text-foreground">{formatCLP(statement.total_due)}</span>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-4">

          {/* Nombre */}
          <div className="flex flex-col gap-2 w-full">
            <label className="text-[10px] font-bold text-[#a0a0b8] uppercase tracking-widest ml-1">Descripción</label>
            <div className="flex items-center gap-3 bg-black/5 dark:bg-surface-card p-3 rounded-xl border border-transparent focus-within:border-[#6d28d9]/50 transition-colors">
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
            <div className="flex items-center justify-between ml-1">
              <label className="text-[10px] font-bold text-[#a0a0b8] uppercase tracking-widest">Monto a Pagar</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setAmount(statement.minimum_payment.toLocaleString('es-CL'))}
                  className="text-[10px] bg-brand-primary/20 text-[#6d28d9] px-2 py-0.5 rounded-full font-bold hover:bg-brand-primary/30 transition-colors"
                >
                  Mínimo
                </button>
                <button
                  onClick={() => setAmount(remaining.toLocaleString('es-CL'))}
                  className="text-[10px] bg-brand-primary/20 text-[#6d28d9] px-2 py-0.5 rounded-full font-bold hover:bg-brand-primary/30 transition-colors"
                >
                  Total
                </button>
              </div>
            </div>
            <div className={`flex items-center gap-2 bg-black/5 dark:bg-surface-card p-3 rounded-xl border transition-colors ${!isAmountValid && amount !== '' ? 'border-[#f31260]' : 'border-transparent focus-within:border-[#6d28d9]/50'}`}>
              <span className={`font-bold shrink-0 ${!isAmountValid && amount !== '' ? 'text-[#f31260]' : 'text-[#6d28d9]'}`}>$</span>
              <input
                type="text"
                value={amount}
                onChange={handleAmountChange}
                className={`bg-transparent border-none outline-none w-full font-black text-xl ${!isAmountValid && amount !== '' ? 'text-[#f31260]' : 'text-foreground'}`}
              />
            </div>
            {!isAmountValid && amount !== '' && (
              <span className="text-[11px] font-semibold text-[#f31260] ml-1">
                El monto debe estar entre {formatCLP(statement.minimum_payment)} y {formatCLP(remaining)}
              </span>
            )}
          </div>

          {/* Origen */}
          <div className="flex flex-col gap-2 relative w-full">
            <label className="text-[10px] font-bold text-[#a0a0b8] uppercase tracking-widest ml-1">Pagar desde</label>
            <div
              className="bg-black/5 dark:bg-surface-card p-3 rounded-xl border border-transparent cursor-pointer flex justify-between items-center hover:border-[#6d28d9]/50 transition-colors"
              onClick={() => setIsOriginDropdownOpen(!isOriginDropdownOpen)}
            >
              {selectedOriginObj ? (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-black/10 dark:bg-surface-raised flex items-center justify-center">
                    <Landmark size={14} className="text-[#006FEE]" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-bold text-sm text-foreground">{selectedOriginObj.name}</span>
                    <span className="text-[10px] text-[#a0a0b8]">Balance: {formatCLP(selectedOriginObj.balance)}</span>
                  </div>
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
                      <span className="text-[10px] text-[#a0a0b8]">Balance: {formatCLP(acc.balance)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

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
            className="w-full h-14 bg-brand-primary text-white font-bold shadow-md hover:bg-[#5b21b6] mt-2 rounded-xl text-md"
            isDisabled={isSubmitting || !amount || !selectedOrigin || !isAmountValid}
            onPress={handleConfirm}
          >
            {isSubmitting ? <Spinner color="current" size="sm" /> : (
              <div className="flex items-center gap-2">
                <Check size={20} strokeWidth={3} />
                <span>Confirmar Pago y Liberar Cupo</span>
              </div>
            )}
          </Button>

        </div>
      </div>
    </div>
  );
}
