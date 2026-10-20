import { useState } from "react";
import { Button, Spinner } from "@heroui/react";
import { Account, Bank } from "@/types";
import { updateAccount } from "@/features/wallet/api/accountRepository";
import { X, Landmark, Eye, PiggyBank, ChevronDown } from "lucide-react";
import { usePrivateMutation } from "@/features/app-shell/hooks/usePrivateMutation";

interface AccountEditModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  account: Account;
  banks: Bank[];
}

const ACCOUNT_TYPES = [
  { id: 'corriente', label: 'Cuenta Corriente', icon: Landmark },
  { id: 'vista', label: 'Cuenta Vista', icon: Eye },
  { id: 'ahorro', label: 'Cuenta de Ahorro', icon: PiggyBank }
];

export function AccountEditModal({ isOpen, onOpenChange, account, banks }: AccountEditModalProps) {
  const { runMutation } = usePrivateMutation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [name, setName] = useState(account.name);
  const [balance, setBalance] = useState(account.balance?.toString() || '0');
  const [type, setType] = useState(account.type || 'corriente');
  const [bankId, setBankId] = useState(account.bank_id || 'none');
  const [lastDigits, setLastDigits] = useState(account.last_digits || '');
  const [overdraftLimit, setOverdraftLimit] = useState(account.overdraft_limit?.toString() || '');

  const [isTypeOpen, setIsTypeOpen] = useState(false);
  const [isBankOpen, setIsBankOpen] = useState(false);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!name) return;
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const finalBankId = bankId === 'none' ? null : bankId;
      const finalColor = banks.find(b => b.id === finalBankId)?.color || '#534AB7';
      const parsedOverdraft = parseInt(overdraftLimit.replace(/\D/g, ''), 10) || 0;
      const parsedBalance = parseInt(balance.replace(/\D/g, ''), 10) || 0;

      await runMutation(() => updateAccount(account.id, {
        name,
        balance: parsedBalance,
        type,
        bank_id: finalBankId,
        color: finalColor,
        last_digits: lastDigits || undefined,
        overdraft_limit: type === 'corriente' ? parsedOverdraft : 0,
        include_in_total: type !== 'ahorro'
      }));
      onOpenChange(false);
    } catch (err: any) {
      console.error(err);
      if (err.message?.includes('Ya existe una cuenta activa')) {
        setErrorMsg('Ya tienes una cuenta con este nombre.');
      } else {
        setErrorMsg('Ocurrió un error al guardar los cambios.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedTypeObj = ACCOUNT_TYPES.find(t => t.id === type) || ACCOUNT_TYPES[0];
  const TypeIcon = selectedTypeObj.icon;
  const selectedBankObj = banks.find(b => b.id === bankId);
  const isCashAccount = account.name.toLowerCase() === 'efectivo' && account.bank_id === null;

  return (
    <div className="fixed inset-0 bg-black/40 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={(e) => {
      if (e.target === e.currentTarget) {
        onOpenChange(false);
      }
    }}>
      <div className="bg-white dark:bg-surface-card border border-transparent dark:border-border-subtle rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">

        <div className="flex items-center justify-between p-4 border-b border-default-100 dark:border-border-subtle">
          <h2 className="text-lg font-bold text-foreground">Ajustes de Cuenta</h2>
          <button onClick={() => {
            onOpenChange(false);
          }} className="text-default-400 hover:text-foreground transition-colors">
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
                <label className="text-xs font-semibold text-default-500">Saldo de la Cuenta</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-default-400">$</span>
                  <input
                    type="text"
                    className="w-full p-3 pl-8 bg-default-50 dark:bg-surface-card border-none rounded-xl outline-none text-xl font-bold text-foreground"
                    value={balance === '0' ? '' : balance}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, '');
                      setBalance(raw ? parseInt(raw, 10).toLocaleString('es-CL') : '0');
                    }}
                  />
                </div>
              </div>

              {!isCashAccount && (
                <>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-default-500">Nombre de la Cuenta</label>
                    <input
                      type="text"
                      maxLength={30}
                      className="w-full p-3 bg-default-50 dark:bg-surface-card border-none rounded-xl text-sm outline-none text-foreground"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>

              <div className="flex flex-col gap-1.5 relative">
                <label className="text-xs font-semibold text-default-500">Tipo de Cuenta</label>
                <div
                  className="w-full p-3 bg-default-50 dark:bg-surface-card border-none rounded-xl text-sm outline-none text-foreground flex items-center justify-between cursor-pointer"
                  onClick={() => setIsTypeOpen(!isTypeOpen)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-default-200 dark:bg-surface-raised flex items-center justify-center text-default-600 dark:text-default-300">
                      <TypeIcon size={12} />
                    </div>
                    <span className="font-medium">{selectedTypeObj.label}</span>
                  </div>
                  <ChevronDown size={16} className={`text-default-400 transition-transform ${isTypeOpen ? 'rotate-180' : ''}`} />
                </div>
                {isTypeOpen && (
                  <div className="absolute top-[68px] left-0 right-0 bg-white dark:bg-surface-card border border-default-100 dark:border-border-subtle rounded-xl shadow-xl z-[60] p-2 flex flex-col gap-1">
                    {ACCOUNT_TYPES.map(t => {
                      const TIcon = t.icon;
                      return (
                        <div
                          key={t.id}
                          className="flex items-center gap-3 p-2 hover:bg-default-100 dark:hover:bg-surface-card rounded-lg cursor-pointer transition-colors"
                          onClick={() => {
                            setType(t.id);
                            setIsTypeOpen(false);
                          }}
                        >
                          <div className="w-6 h-6 rounded-full bg-default-200 dark:bg-surface-raised flex items-center justify-center text-default-600 dark:text-default-300">
                            <TIcon size={12} />
                          </div>
                          <span className="font-medium text-sm text-foreground">{t.label}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-1.5 relative z-50">
                <label className="text-xs font-semibold text-default-500">Banco / Institución</label>
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
                      <>
                        <div className="w-4 h-4 rounded-full border-2 border-default-400"></div>
                        <span className="font-medium">Sin Banco</span>
                      </>
                    )}
                  </div>
                  <ChevronDown size={16} className={`text-default-400 transition-transform ${isBankOpen ? 'rotate-180' : ''}`} />
                </div>
                {isBankOpen && (
                  <div className="absolute top-[68px] left-0 right-0 bg-white dark:bg-surface-card border border-default-100 dark:border-border-subtle rounded-xl shadow-xl max-h-48 overflow-y-auto p-2 flex flex-col gap-1">
                    <div
                      className="flex items-center gap-3 p-2 hover:bg-default-100 dark:hover:bg-surface-card rounded-lg cursor-pointer transition-colors"
                      onClick={() => {
                        setBankId('none');
                        setIsBankOpen(false);
                      }}
                    >
                      <div className="w-4 h-4 rounded-full border-2 border-default-400"></div>
                      <span className="font-medium text-sm text-foreground">Sin Banco</span>
                    </div>
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
                <label className="text-xs font-semibold text-default-500">Últimos 4 dígitos (Opcional)</label>
                <input
                  type="text"
                  className="w-full p-3 bg-default-50 dark:bg-surface-card border-none rounded-xl text-sm outline-none text-foreground"
                  placeholder="Ej: 4821"
                  value={lastDigits}
                  maxLength={4}
                  onChange={(e) => setLastDigits(e.target.value.replace(/\D/g, ''))}
                />
              </div>

              {type === 'corriente' && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-default-500">Límite de Sobregiro</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-default-400">$</span>
                    <input
                      type="text"
                      className="w-full p-3 pl-8 bg-default-50 dark:bg-surface-card border-none rounded-xl text-sm outline-none text-foreground"
                      placeholder="0"
                      value={overdraftLimit === '0' ? '' : overdraftLimit}
                      onChange={(e) => setOverdraftLimit(e.target.value.replace(/\D/g, ''))}
                    />
                  </div>
                </div>
              )}
              </>
              )}
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
              {isSubmitting ? <Spinner size="sm" /> : 'Guardar Cambios'}
            </Button>
          </div>

      </div>
    </div>
  );
}
