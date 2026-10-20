import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { X, ChevronDown, ChevronUp, Check, Search, Landmark, CreditCard, DollarSign, ArrowLeft, Plus } from 'lucide-react';
import { Button, Spinner } from '@heroui/react';
import { useBanks } from '@/features/wallet/hooks/useBanks';
import { useAccounts } from '@/features/wallet/hooks/useAccounts';
import { useCreditCards } from '@/features/credit-cards/hooks/useCreditCards';
import { useAllBankTemplates } from '@/features/wallet/hooks/useBankTemplates';
import { addAccount } from '@/features/wallet/api/accountRepository';
import { addCreditCard } from '@/features/credit-cards/api/creditCardRepository';
import { queryKeys } from '@/lib/queryKeys';
import { AccountTemplate, CreditCardTemplate } from '@/types';

interface AddInstrumentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SelectedItem {
  id: string;
  type: 'account' | 'credit_card';
  bankId: string | null;
  bankName: string;
  templateId: string | null;
  templateName: string;
  amount: string; // formatted money string
  accountType?: 'checking' | 'sight' | 'savings' | 'cash' | 'investment';
  cardNetwork?: 'visa' | 'mastercard' | 'amex' | 'other';
  billingDate?: string;
  paymentDate?: string;
  alreadyExists?: boolean;
  existingId?: string;
}

// Componente para renderear logo del banco sin contenedor gris
function BankLogo({ logoUrl, name, color }: { logoUrl?: string | null; name: string; color?: string | null }) {
  const [hasError, setHasError] = useState(false);

  if (logoUrl && !hasError) {
    return (
      <img
        src={logoUrl}
        alt={name}
        className="w-7 h-7 object-contain shrink-0"
        onError={() => setHasError(true)}
      />
    );
  }

  return (
    <div
      className="w-7 h-7 flex items-center justify-center font-extrabold text-xs shrink-0"
      style={{ color: color || '#8b5cf6' }}
    >
      {name ? name.charAt(0).toUpperCase() : <Landmark size={18} />}
    </div>
  );
}

export function AddInstrumentModal({ isOpen, onClose }: AddInstrumentModalProps) {
  const queryClient = useQueryClient();
  const { data: banks = [], isLoading: loadingBanks } = useBanks();
  const { data: existingAccounts = [] } = useAccounts();
  const { data: existingCreditCards = [] } = useCreditCards();
  const { accountTemplates, cardTemplates, isLoading: loadingTemplates } = useAllBankTemplates();

  // Mapa de acordeones desplegados (soporta múltiples bancos abiertos simultáneamente)
  const [expandedBankIds, setExpandedBankIds] = useState<Record<string, boolean>>({});

  // Estado global de elementos seleccionados (mapeado por id único)
  const [selectedItems, setSelectedItems] = useState<Record<string, SelectedItem>>({});

  // Formulario de creación personalizada/manual
  const [customType, setCustomType] = useState<'account' | 'credit_card'>('account');
  const [customName, setCustomName] = useState('');
  const [customAmount, setCustomAmount] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Pre-cargar cuentas y tarjetas existentes cuando se abre el modal
  useEffect(() => {
    if (!isOpen) return;

    const initialSelected: Record<string, SelectedItem> = {};

    // 1. Pre-marcar cuentas ya creadas por el usuario
    existingAccounts.forEach(acc => {
      if (acc.is_archived) return;
      const template = accountTemplates.find(t =>
        t.id === acc.template_id || (t.bank_id === acc.bank_id && (t.name === acc.name || t.type === acc.type))
      );
      const templateId = template?.id || acc.template_id || acc.id;
      const itemKey = `acc-${templateId}`;
      const bankObj = banks.find(b => b.id === (acc.bank_id || template?.bank_id));

      initialSelected[itemKey] = {
        id: itemKey,
        type: 'account',
        bankId: acc.bank_id || template?.bank_id || null,
        bankName: bankObj?.name || '',
        templateId: template?.id || null,
        templateName: acc.name || template?.name || 'Cuenta',
        amount: acc.balance ? acc.balance.toLocaleString('es-CL') : '0',
        alreadyExists: true,
        existingId: acc.id,
      };
    });

    // 2. Pre-marcar tarjetas ya creadas por el usuario
    existingCreditCards.forEach(card => {
      if (card.is_archived) return;
      const template = cardTemplates.find(t =>
        t.id === card.template_id || (t.bank_id === card.bank_id && t.name === card.name)
      );
      const templateId = template?.id || card.template_id || card.id;
      const itemKey = `card-${templateId}`;
      const bankObj = banks.find(b => b.id === (card.bank_id || template?.bank_id));

      initialSelected[itemKey] = {
        id: itemKey,
        type: 'credit_card',
        bankId: card.bank_id || template?.bank_id || null,
        bankName: bankObj?.name || '',
        templateId: template?.id || null,
        templateName: card.name || template?.name || 'Tarjeta',
        amount: card.total_limit ? card.total_limit.toLocaleString('es-CL') : '0',
        billingDate: card.billing_date?.toString() || '10',
        paymentDate: card.payment_date?.toString() || '25',
        alreadyExists: true,
        existingId: card.id,
      };
    });

    setSelectedItems(initialSelected);
  }, [isOpen, existingAccounts, existingCreditCards, accountTemplates, cardTemplates, banks]);

  if (!isOpen) return null;

  // Toggle desplegar/colapsar un banco de forma independiente
  const toggleBankExpansion = (bankId: string) => {
    setExpandedBankIds(prev => ({
      ...prev,
      [bankId]: !prev[bankId],
    }));
  };

  // Alternar selección de un item (Checkbox)
  const toggleItemSelection = (
    itemKey: string,
    type: 'account' | 'credit_card',
    bankId: string | null,
    bankName: string,
    template: AccountTemplate | CreditCardTemplate | null,
    customName?: string
  ) => {
    setErrorMsg('');
    setSelectedItems(prev => {
      const next = { ...prev };
      if (next[itemKey]) {
        delete next[itemKey];
      } else {
        const defaultName = template?.name || customName || (type === 'account' ? 'Cuenta Personal' : 'Tarjeta de Crédito');
        next[itemKey] = {
          id: itemKey,
          type,
          bankId,
          bankName,
          templateId: template?.id || null,
          templateName: defaultName,
          amount: '',
          accountType: type === 'account' ? ((template as AccountTemplate)?.type || 'checking') : undefined,
          cardNetwork: type === 'credit_card' ? ((template as CreditCardTemplate)?.card_network || 'visa') : undefined,
          billingDate: '10',
          paymentDate: '25',
          alreadyExists: false,
        };
      }
      return next;
    });
  };

  // Actualizar campo de un item seleccionado (Monto inicial)
  const updateSelectedItem = (itemKey: string, updates: Partial<SelectedItem>) => {
    setSelectedItems(prev => {
      if (!prev[itemKey]) return prev;
      return {
        ...prev,
        [itemKey]: { ...prev[itemKey], ...updates },
      };
    });
  };

  // Contar selección por banco
  const getSelectedCountForBank = (bankId: string) => {
    return Object.values(selectedItems).filter(item => item.bankId === bankId).length;
  };

  const selectedTotalCount = Object.keys(selectedItems).length;
  const newItemsToCreate = Object.values(selectedItems).filter(item => !item.alreadyExists);
  const newCount = newItemsToCreate.length;

  // Guardar solo los nuevos instrumentos seleccionados
  const handleSaveAll = async () => {
    if (newCount === 0) {
      onClose();
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      for (const item of newItemsToCreate) {
        const numericAmount = parseInt(item.amount.replace(/\D/g, ''), 10) || 0;

        if (item.type === 'account') {
          await addAccount({
            name: item.templateName,
            type: item.accountType === 'checking' ? 'corriente' : item.accountType === 'sight' ? 'vista' : item.accountType === 'savings' ? 'ahorro' : item.accountType === 'cash' ? 'efectivo' : 'inversion',
            bank_id: item.bankId || undefined,
            template_id: item.templateId || undefined,
            balance: numericAmount,
            initial_balance: numericAmount,
            currency: 'clp',
            maintenance_cost: 0,
            maintenance_currency: 'clp',
            include_in_total: item.accountType !== 'savings',
          });
        } else {
          await addCreditCard({
            name: item.templateName,
            bank_id: item.bankId || '',
            template_id: item.templateId || undefined,
            type: item.templateName,
            issuer: item.cardNetwork || 'visa',
            total_limit: numericAmount,
            current_debt: 0,
            billing_date: parseInt(item.billingDate || '10', 10) || 10,
            payment_date: parseInt(item.paymentDate || '25', 10) || 25,
            maintenance_cost: 0,
            maintenance_currency: 'clp',
            monthly_interest_rate: 0,
            penalty_interest_rate: 0,
          });
        }
      }

      // [SP2-09] Refresco selectivo de las queries afectadas (cuentas, tarjetas, wallet summary y dashboard)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.wallet.accounts() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.wallet.creditCards() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.wallet.summary() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all }),
      ]);

      onClose();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Ocurrió un error al guardar las cuentas.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/75 z-[100] flex items-center justify-center p-3 md:p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-surface-card border border-[#6d28d9]/30 rounded-3xl shadow-2xl w-full max-w-lg h-[88vh] flex flex-col overflow-hidden text-white animate-in zoom-in-95 duration-150">
        
        {/* Header Fijo */}
        <div className="p-5 border-b border-white/10 bg-surface-card flex flex-col gap-2 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-300 hover:text-white transition-colors"
              >
                <ArrowLeft size={18} />
              </button>
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight">Agregar Cuentas y Tarjetas</h2>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>
          <p className="text-gray-400 text-xs pl-1">
            Selecciona tu banco e inicializa el saldo de tus cuentas o el cupo de tus tarjetas.
          </p>
        </div>

        {/* Scrollable Accordion Body */}
        <div className="p-4 overflow-y-auto min-h-0 flex flex-col gap-3 flex-1">
          {errorMsg && (
            <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-300 text-xs font-medium shrink-0">
              {errorMsg}
            </div>
          )}

          {(loadingBanks || loadingTemplates) ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400 text-xs gap-3">
              <Spinner size="md" />
              <span>Cargando plantillas bancarias...</span>
            </div>
          ) : (
            <>
              {banks.map((bank) => {
                const isExpanded = Boolean(expandedBankIds[bank.id]);
                const count = getSelectedCountForBank(bank.id);

                const bankAccTemplates = accountTemplates.filter(t => t.bank_id === bank.id);
                const bankCardTemplates = cardTemplates.filter(t => t.bank_id === bank.id);

                return (
                  <div
                    key={bank.id}
                    className="shrink-0 border border-white/10 rounded-2xl bg-surface-card overflow-hidden transition-all shadow-md"
                  >
                    {/* Bank Header Accordion Card */}
                    <div
                      onClick={() => toggleBankExpansion(bank.id)}
                      className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/[0.04] transition-colors"
                    >
                      <div className="flex items-center gap-3.5">
                        <BankLogo logoUrl={bank.logo_url} name={bank.name} color={bank.color} />
                        <div className="flex flex-col">
                          <span className="font-bold text-sm text-white">{bank.name}</span>
                          {count > 0 && (
                            <span className="text-xs text-[#2563eb] font-semibold">
                              {count} {count === 1 ? 'seleccionada' : 'seleccionadas'}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5">
                        {count > 0 && (
                          <span className="w-6 h-6 rounded-full bg-[#2563eb] text-white text-xs font-bold flex items-center justify-center shadow-sm">
                            {count}
                          </span>
                        )}
                        {isExpanded ? (
                          <ChevronUp size={18} className="text-gray-400" />
                        ) : (
                          <ChevronDown size={18} className="text-gray-400" />
                        )}
                      </div>
                    </div>

                    {/* Expanded Bank Products List */}
                    {isExpanded && (
                      <div className="p-4 pt-2 border-t border-white/5 bg-black/40 flex flex-col gap-4 max-h-[380px] overflow-y-auto transition-all">
                        {/* Seccion 1: CUENTAS BANCARIAS */}
                        {bankAccTemplates.length > 0 && (
                          <div className="flex flex-col gap-2">
                            <span className="text-[10px] font-extrabold text-gray-400 tracking-wider uppercase flex items-center gap-1">
                              <Landmark size={12} className="text-[#8b5cf6]" /> Cuentas Bancarias
                            </span>
                            {bankAccTemplates.map((template) => {
                              const itemKey = `acc-${template.id}`;
                              const selected = selectedItems[itemKey];

                              return (
                                <div key={template.id} className="flex flex-col gap-2">
                                  <div
                                    onClick={() =>
                                      toggleItemSelection(itemKey, 'account', bank.id, bank.name, template)
                                    }
                                    className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                                      selected
                                        ? 'bg-[#8b5cf6]/20 border-[#8b5cf6] text-white'
                                        : 'bg-white/[0.03] border-white/5 hover:border-white/20 text-gray-300'
                                    }`}
                                  >
                                    <div className="flex items-center gap-3">
                                      <div
                                        className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                                          selected
                                            ? 'bg-[#8b5cf6] border-[#8b5cf6] text-white'
                                            : 'border-white/30 bg-white/5'
                                        }`}
                                      >
                                        {selected && <Check size={14} />}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="font-bold text-xs text-white">{template.name}</span>
                                        {selected?.alreadyExists && (
                                          <span className="text-[10px] font-bold text-[#4CD964] bg-[#4CD964]/10 border border-[#4CD964]/30 px-2 py-0.5 rounded-full">
                                            Ya vinculada
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Campo de Inicialización de Dinero (Solo si es nueva) */}
                                  {selected && !selected.alreadyExists && (
                                    <div className="ml-8 p-3 bg-white/[0.04] border border-[#8b5cf6]/40 rounded-xl flex flex-col gap-2.5 animate-in fade-in duration-150">
                                      <div className="flex flex-col gap-1">
                                        <label className="text-[11px] font-bold text-gray-300 flex items-center gap-1">
                                          <DollarSign size={12} className="text-[#4CD964]" /> Saldo Inicial de la Cuenta ($ CLP)
                                        </label>
                                        <div className="relative">
                                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                                          <input
                                            type="text"
                                            placeholder="0"
                                            value={selected.amount}
                                            onChange={(e) => {
                                              const raw = e.target.value.replace(/\D/g, '');
                                              const formatted = raw ? parseInt(raw, 10).toLocaleString('es-CL') : '';
                                              updateSelectedItem(itemKey, { amount: formatted });
                                            }}
                                            className="w-full pl-7 pr-3 py-2 bg-black/60 border border-white/10 rounded-lg text-xs font-bold text-white outline-none focus:border-[#8b5cf6]"
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Seccion 2: TARJETAS DE CRÉDITO */}
                        {bankCardTemplates.length > 0 && (
                          <div className="flex flex-col gap-2 mt-1">
                            <span className="text-[10px] font-extrabold text-gray-400 tracking-wider uppercase flex items-center gap-1">
                              <CreditCard size={12} className="text-[#06b6d4]" /> Tarjetas de Crédito
                            </span>
                            {bankCardTemplates.map((template) => {
                              const itemKey = `card-${template.id}`;
                              const selected = selectedItems[itemKey];

                              return (
                                <div key={template.id} className="flex flex-col gap-2">
                                  <div
                                    onClick={() =>
                                      toggleItemSelection(itemKey, 'credit_card', bank.id, bank.name, template)
                                    }
                                    className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                                      selected
                                        ? 'bg-[#06b6d4]/20 border-[#06b6d4] text-white'
                                        : 'bg-white/[0.03] border-white/5 hover:border-white/20 text-gray-300'
                                    }`}
                                  >
                                    <div className="flex items-center gap-3">
                                      <div
                                        className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                                          selected
                                            ? 'bg-[#06b6d4] border-[#06b6d4] text-white'
                                            : 'border-white/30 bg-white/5'
                                        }`}
                                      >
                                        {selected && <Check size={14} />}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="font-bold text-xs text-white">{template.name}</span>
                                        {selected?.alreadyExists && (
                                          <span className="text-[10px] font-bold text-[#06b6d4] bg-[#06b6d4]/10 border border-[#06b6d4]/30 px-2 py-0.5 rounded-full">
                                            Ya vinculada
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Campo de Inicialización de Cupo (Solo si es nueva) */}
                                  {selected && !selected.alreadyExists && (
                                    <div className="ml-8 p-3 bg-white/[0.04] border border-[#06b6d4]/40 rounded-xl flex flex-col gap-2.5 animate-in fade-in duration-150">
                                      <div className="flex flex-col gap-1">
                                        <label className="text-[11px] font-bold text-gray-300 flex items-center gap-1">
                                          <DollarSign size={12} className="text-[#06b6d4]" /> Cupo Total de la Tarjeta ($ CLP)
                                        </label>
                                        <div className="relative">
                                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                                          <input
                                            type="text"
                                            placeholder="Ej: 1.000.000"
                                            value={selected.amount}
                                            onChange={(e) => {
                                              const raw = e.target.value.replace(/\D/g, '');
                                              const formatted = raw ? parseInt(raw, 10).toLocaleString('es-CL') : '';
                                              updateSelectedItem(itemKey, { amount: formatted });
                                            }}
                                            className="w-full pl-7 pr-3 py-2 bg-black/60 border border-white/10 rounded-lg text-xs font-bold text-white outline-none focus:border-[#06b6d4]"
                                          />
                                        </div>
                                      </div>

                                      <div className="grid grid-cols-2 gap-2">
                                        <div className="flex flex-col gap-1">
                                          <label className="text-[10px] font-semibold text-gray-400">Día Corte</label>
                                          <input
                                            type="number"
                                            min={1}
                                            max={31}
                                            value={selected.billingDate || '10'}
                                            onChange={(e) => updateSelectedItem(itemKey, { billingDate: e.target.value })}
                                            className="w-full px-2.5 py-1.5 bg-black/60 border border-white/10 rounded-lg text-xs text-white outline-none"
                                          />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                          <label className="text-[10px] font-semibold text-gray-400">Día Pago</label>
                                          <input
                                            type="number"
                                            min={1}
                                            max={31}
                                            value={selected.paymentDate || '25'}
                                            onChange={(e) => updateSelectedItem(itemKey, { paymentDate: e.target.value })}
                                            className="w-full px-2.5 py-1.5 bg-black/60 border border-white/10 rounded-lg text-xs text-white outline-none"
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {bankAccTemplates.length === 0 && bankCardTemplates.length === 0 && (
                          <div className="py-4 text-center text-xs text-gray-400">
                            No hay productos registrados para este banco.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Opción Manual / Personalizada */}
              <div className="shrink-0 border border-white/10 rounded-2xl bg-surface-card overflow-hidden transition-all shadow-md mt-1">
                <div
                  onClick={() => toggleBankExpansion('custom-instrument')}
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/[0.04] transition-colors"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-7 h-7 rounded-lg bg-[#8b5cf6]/20 border border-[#8b5cf6]/40 flex items-center justify-center text-[#8b5cf6] font-bold text-xs shrink-0">
                      <Plus size={16} />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-bold text-sm text-white">Otro / Personalizado</span>
                      <span className="text-[10px] text-gray-400">Si tu banco o producto no aparece en la lista</span>
                    </div>
                  </div>
                  <ChevronDown size={18} className={`text-gray-400 transition-transform ${expandedBankIds['custom-instrument'] ? 'rotate-180' : ''}`} />
                </div>

                {expandedBankIds['custom-instrument'] && (
                  <div className="p-4 pt-3 border-t border-white/5 bg-black/40 flex flex-col gap-3 animate-in slide-in-from-top-2 duration-150">
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold text-gray-300">Tipo de Instrumento</label>
                      <div className="grid grid-cols-2 gap-2 bg-white/5 p-1 rounded-xl">
                        <button
                          type="button"
                          onClick={() => setCustomType('account')}
                          className={`py-1.5 rounded-lg text-xs font-bold transition-all ${customType === 'account' ? 'bg-[#8b5cf6] text-white shadow-md' : 'text-gray-400'}`}
                        >
                          Cuenta
                        </button>
                        <button
                          type="button"
                          onClick={() => setCustomType('credit_card')}
                          className={`py-1.5 rounded-lg text-xs font-bold transition-all ${customType === 'credit_card' ? 'bg-[#06b6d4] text-white shadow-md' : 'text-gray-400'}`}
                        >
                          Tarjeta
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold text-gray-300">Nombre de la Cuenta / Tarjeta</label>
                      <input
                        type="text"
                        placeholder="Ej: Efectivo, Caja Chica, Banco Internacional..."
                        value={customName}
                        onChange={(e) => setCustomName(e.target.value)}
                        className="w-full px-3 py-2 bg-black/60 border border-white/10 rounded-lg text-xs font-bold text-white outline-none focus:border-[#8b5cf6]"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold text-gray-300">
                        {customType === 'account' ? 'Saldo Inicial ($ CLP)' : 'Cupo Total ($ CLP)'}
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                        <input
                          type="text"
                          placeholder="0"
                          value={customAmount}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/\D/g, '');
                            setCustomAmount(raw ? parseInt(raw, 10).toLocaleString('es-CL') : '');
                          }}
                          className="w-full pl-7 pr-3 py-2 bg-black/60 border border-white/10 rounded-lg text-xs font-bold text-white outline-none focus:border-[#8b5cf6]"
                        />
                      </div>
                    </div>

                    <Button
                      onPress={() => {
                        if (!customName.trim()) return;
                        const itemKey = `custom-${Date.now()}`;
                        setSelectedItems(prev => ({
                          ...prev,
                          [itemKey]: {
                            id: itemKey,
                            type: customType,
                            bankId: null,
                            bankName: 'Personalizado',
                            templateId: null,
                            templateName: customName.trim(),
                            amount: customAmount,
                            accountType: 'checking',
                            cardNetwork: 'visa',
                            alreadyExists: false,
                          }
                        }));
                        setCustomName('');
                        setCustomAmount('');
                      }}
                      isDisabled={!customName.trim()}
                      className="bg-[#8b5cf6] hover:bg-[#7c3aed] text-white font-bold text-xs py-2 rounded-xl mt-1 shadow-md"
                    >
                      Añadir Instrumento Personalizado
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer Fijo */}
        <div className="p-4 border-t border-white/10 bg-surface-card shrink-0">
          <Button
            onPress={newCount > 0 ? handleSaveAll : onClose}
            isDisabled={isSubmitting}
            className="w-full bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold text-sm py-3 rounded-2xl shadow-lg transition-all"
          >
            {isSubmitting ? <Spinner size="sm" /> : newCount > 0 ? 'Guardar' : 'Cerrar'}
          </Button>
        </div>

      </div>
    </div>
  );
}
