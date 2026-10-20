import { useState } from "react";
import { Button, Spinner } from "@heroui/react";
import { CreditCard, Bank } from "@/types";
import { updateCreditCard } from "@/features/credit-cards/api/creditCardRepository";
import { X, ChevronDown } from "lucide-react";
import { usePrivateMutation } from '@/features/app-shell/hooks/usePrivateMutation';

interface CreditCardEditModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  card: CreditCard;
  banks: Bank[];
}

export function CreditCardEditModal({ isOpen, onOpenChange, card, banks }: CreditCardEditModalProps) {
  const { runMutation } = usePrivateMutation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [name, setName] = useState(card.name);
  const [bankId, setBankId] = useState(card.bank_id);
  const [lastDigits, setLastDigits] = useState(card.last_4_digits?.toString() || '');
  const [totalLimit, setTotalLimit] = useState(card.total_limit?.toString() || '0');
  const [billingDate, setBillingDate] = useState(card.billing_date || 15);
  const [paymentDate, setPaymentDate] = useState(card.payment_date || 5);
  const [maintenance, setMaintenance] = useState(card.maintenance_cost?.toString() || '0');
  const [interest, setInterest] = useState(card.monthly_interest_rate?.toString() || '');
  const [defaultInterest, setDefaultInterest] = useState(card.default_interest_rate?.toString() || '');

  const [isBankOpen, setIsBankOpen] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!name || !bankId) return;
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const parsedLimit = parseInt(totalLimit.replace(/\D/g, ''), 10) || 0;
      const parsedMaintenance = parseInt(maintenance.replace(/\D/g, ''), 10) || 0;
      const parsedInterest = parseFloat(interest.replace(',', '.')) || 0;
      const parsedDefaultInterest = parseFloat(defaultInterest.replace(',', '.')) || 0;

      await runMutation(() => updateCreditCard(card.id, {
        name,
        bank_id: bankId,
        last_4_digits: lastDigits ? parseInt(lastDigits, 10) : undefined,
        total_limit: parsedLimit,
        billing_date: billingDate,
        payment_date: paymentDate,
        maintenance_cost: parsedMaintenance,
        monthly_interest_rate: parsedInterest,
        default_interest_rate: parsedDefaultInterest
      }));
      onOpenChange(false);
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Ocurrió un error al guardar los cambios.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedBankObj = banks.find(b => b.id === bankId);

  return (
    <div className="fixed inset-0 bg-black/40 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={(e) => {
      if (e.target === e.currentTarget) {
        onOpenChange(false);
      }
    }}>
      <div className="bg-white dark:bg-surface-card border border-transparent dark:border-border-subtle rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">

        <div className="flex items-center justify-between p-4 border-b border-default-100 dark:border-border-subtle">
          <h2 className="text-lg font-bold text-foreground">Ajustes de Tarjeta</h2>
          <button onClick={() => onOpenChange(false)} className="text-default-400 hover:text-foreground transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex flex-col gap-5">
            {errorMsg && (
              <div className="p-3 bg-danger/10 text-danger border border-danger/20 rounded-xl text-sm font-medium animate-in fade-in">
                {errorMsg}
              </div>
            )}

            <div className="flex flex-col gap-5 animate-in fade-in">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-default-500">Nombre de la Tarjeta</label>
                <input
                  type="text"
                  className="w-full p-3 bg-default-50 dark:bg-surface-card border-none rounded-xl text-sm outline-none text-foreground"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1.5 relative z-50">
                <label className="text-xs font-semibold text-default-500">Banco Emisor</label>
                <div
                  className="w-full p-3 bg-default-50 dark:bg-surface-card border-none rounded-xl text-sm outline-none text-foreground flex items-center justify-between cursor-pointer"
                  onClick={() => setIsBankOpen(!isBankOpen)}
                >
                  <div className="flex items-center gap-3">
                    {selectedBankObj ? (
                      <>
                        <div className="w-4 h-4 rounded-full shadow-sm" style={{ backgroundColor: selectedBankObj.color }}></div>
                        <span className="font-medium">{selectedBankObj.name}</span>
                      </>
                    ) : (
                      <span className="font-medium text-default-400">Selecciona un banco</span>
                    )}
                  </div>
                  <ChevronDown size={16} className={`text-default-400 transition-transform ${isBankOpen ? 'rotate-180' : ''}`} />
                </div>
                {isBankOpen && (
                  <div className="absolute top-[68px] left-0 right-0 bg-white dark:bg-surface-card border border-default-100 dark:border-border-subtle rounded-xl shadow-xl max-h-48 overflow-y-auto p-2 flex flex-col gap-1">
                    {banks.map(b => (
                      <div
                        key={b.id}
                        className="flex items-center gap-3 p-2 hover:bg-default-100 dark:hover:bg-surface-card rounded-lg cursor-pointer transition-colors"
                        onClick={() => {
                          setBankId(b.id);
                          setIsBankOpen(false);
                        }}
                      >
                        <div className="w-4 h-4 rounded-full shadow-sm" style={{ backgroundColor: b.color }}></div>
                        <span className="font-medium text-sm text-foreground">{b.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-default-500">Últimos 4 dígitos</label>
                <input
                  type="text"
                  className="w-full p-3 bg-default-50 dark:bg-surface-card border-none rounded-xl text-sm outline-none text-foreground"
                  placeholder="Ej: 4821"
                  value={lastDigits}
                  maxLength={4}
                  onChange={(e) => setLastDigits(e.target.value.replace(/\D/g, ''))}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-default-500">Cupo Total</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-default-400">$</span>
                  <input
                    type="text"
                    className="w-full p-3 pl-8 bg-default-50 dark:bg-surface-card border-none rounded-xl text-sm outline-none text-foreground font-bold"
                    value={totalLimit === '0' ? '' : totalLimit}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, '');
                      setTotalLimit(raw ? parseInt(raw, 10).toLocaleString('es-CL') : '0');
                    }}
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex flex-col gap-1.5 flex-1">
                  <label className="text-xs font-semibold text-default-500">Día de Corte</label>
                  <input
                    type="number"
                    className="w-full p-3 bg-default-50 dark:bg-surface-card border-none rounded-xl text-sm outline-none text-foreground"
                    value={billingDate}
                    min={1} max={31}
                    onChange={(e) => setBillingDate(parseInt(e.target.value, 10) || 1)}
                  />
                </div>
                <div className="flex flex-col gap-1.5 flex-1">
                  <label className="text-xs font-semibold text-default-500">Día de Pago</label>
                  <input
                    type="number"
                    className="w-full p-3 bg-default-50 dark:bg-surface-card border-none rounded-xl text-sm outline-none text-foreground"
                    value={paymentDate}
                    min={1} max={31}
                    onChange={(e) => setPaymentDate(parseInt(e.target.value, 10) || 1)}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-default-500">Costo de Mantención</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-default-400">{card.maintenance_currency === 'uf' ? 'UF' : '$'}</span>
                  <input
                    type="text"
                    className="w-full p-3 pl-10 bg-default-50 dark:bg-surface-card border-none rounded-xl text-sm outline-none text-foreground"
                    value={maintenance === '0' ? '' : maintenance}
                    onChange={(e) => {
                      if (card.maintenance_currency === 'uf') {
                        setMaintenance(e.target.value.replace(/[^0-9.,]/g, ''));
                      } else {
                        const raw = e.target.value.replace(/\D/g, '');
                        setMaintenance(raw ? parseInt(raw, 10).toLocaleString('es-CL') : '0');
                      }
                    }}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-default-500">Tasa de interés mensual (%)</label>
                <input
                  type="text"
                  maxLength={5}
                  className="w-full p-3 bg-default-50 dark:bg-surface-card border-none rounded-xl text-sm outline-none text-foreground focus:bg-white dark:focus:bg-surface-card focus:border-[#6d28d9] dark:focus:border-[#6d28d9] transition-colors"
                  value={interest}
                  onChange={(e) => {
                    const sanitized = e.target.value.replace(/[^0-9.,]/g, '');
                    setInterest(sanitized);
                  }}
                />
              </div>

              {/* Advanced Options */}
              <div className="mt-2">
                <div
                  className="flex items-center justify-between p-4 bg-[#F8F8FA] dark:bg-surface-card rounded-xl border border-[#F0F0F2] dark:border-border-subtle cursor-pointer"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                >
                  <span className="text-[13px] font-semibold text-[#1C1C1E] dark:text-white">Opciones Avanzadas</span>
                  <ChevronDown size={16} className={`text-[#8E8E93] transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
                </div>
                {showAdvanced && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-300 mt-2 p-4 bg-white dark:bg-surface-card border border-[#E5E5EA] dark:border-border-subtle rounded-xl flex flex-col gap-3">
                    <div className="flex flex-col gap-1.5">
                      <div className="text-[11px] text-[#8E8E93] dark:text-gray-400 font-medium pl-0.5">Tasa por Mora (%)</div>
                      <input
                        type="text"
                        maxLength={5}
                        className="bg-[#F2F2F7] dark:bg-surface-card rounded-xl px-3 py-2.5 text-[13px] text-[#1C1C1E] dark:text-white border border-[#E5E5EA] dark:border-border-subtle outline-none w-full transition-colors focus:bg-white dark:focus:bg-surface-card focus:border-[#6d28d9] dark:focus:border-[#6d28d9]"
                        value={defaultInterest}
                        onChange={e => {
                          const sanitized = e.target.value.replace(/[^0-9.,]/g, '');
                          setDefaultInterest(sanitized);
                        }}
                        placeholder="Ej: 2,9"
                      />
                      <p className="text-[10px] text-[#8E8E93] dark:text-gray-500 mt-1 leading-tight">
                        Tasa aplicada diariamente al saldo vencido. Por defecto ~2.9% mensual (TMC).
                      </p>
                    </div>
                  </div>
                )}
              </div>

            </div>
        </div>

        <div className="p-4 border-t border-default-100 dark:border-border-subtle flex justify-end gap-2">
            <Button variant="ghost" onPress={() => onOpenChange(false)} className="rounded-2xl">
              Cancelar
            </Button>
            <Button
              onPress={handleSave}
              isDisabled={!name || isSubmitting}
              className="bg-brand-primary text-white font-bold rounded-2xl"
            >
              {isSubmitting ? <Spinner size="sm" color="current" /> : 'Guardar Cambios'}
            </Button>
        </div>

      </div>
    </div>
  );
}
