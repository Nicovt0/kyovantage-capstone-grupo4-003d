import { useAccountingAction } from '@/features/accounting/hooks/useAccountingAction';
import { useState, useMemo } from "react";
import { ArrowDown, ArrowUp, ArrowLeftRight, CreditCard as CreditCardIcon, Landmark, ShoppingCart, Target } from "lucide-react";
import * as LucideIcons from 'lucide-react';
import { addTransaction } from "@/features/wallet/api/transactionRepository";
import { addCreditCardPurchase } from "@/features/credit-cards/api/creditCardRepository";
import { useNavigate } from 'react-router-dom';
import { Account, Category, CreditCard, Goal } from "@/types";
import { Form, Input, Button, Spinner } from "@heroui/react";
import { usePrivateMutation } from '@/features/app-shell/hooks/usePrivateMutation';

function Switch({ checked, onCheckedChange, className }: { checked: boolean, onCheckedChange: (val: boolean) => void, className?: string }) {
  return (
    <button
      type="button"
      onClick={() => onCheckedChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none ${checked ? 'bg-brand-primary' : 'bg-[#E5E5EA] dark:bg-surface-raised'} ${className}`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${checked ? 'translate-x-5' : 'translate-x-0.5'}`}
      />
    </button>
  );
}

const TextField = ({ children, className }: any) => <div className={className}>{children}</div>;
const Label = ({ children, className }: any) => <label className={className}>{children}</label>;
const Description = ({ children, className }: any) => <span className={className}>{children}</span>;

const Select: any = ({ children, className }: any) => <div className={className}>{children}</div>;
Select.Trigger = ({ children, className }: any) => <div className={className}>{children}</div>;
Select.Value = ({ children }: any) => typeof children === 'function' ? children() : children;
Select.Indicator = () => null;
Select.Popover = ({ children, className }: any) => <div className={className}>{children}</div>;

const ListBox: any = ({ children, className }: any) => <div className={className}>{children}</div>;
ListBox.Item = ({ children, className, onClick }: any) => <div className={className} onClick={onClick}>{children}</div>;

type TxType = 'expense' | 'income' | 'transfer';

type SelectableOption = {
  id: string;
  name: string;
  isCard: boolean;
  type?: string;
  balance?: number;
  currentDebt?: number;
  totalLimit?: number;
  issuer?: string;
};

interface TransactionFormV3Props {
  accounts: Account[];
  categories: Category[];
  creditCards?: CreditCard[];
  goals?: Goal[];
}

export function TransactionFormV3({ accounts = [], categories = [], creditCards = [], goals = [] }: TransactionFormV3Props) {
  const navigate = useNavigate();
  const runAccounting = useAccountingAction();
  const { runMutation } = usePrivateMutation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txType, setTxType] = useState<TxType>('expense');

  const [description, setDescription] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [selectedOriginId, setSelectedOriginId] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [date, setDate] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  });
  const [isPaid, setIsPaid] = useState(true);

  const [dueDate, setDueDate] = useState<string>(date);
  const [isCreditCard, setIsCreditCard] = useState(false);
  const [installmentsTotal, setInstallmentsTotal] = useState<string>('1');
  const [selectedDestinationId, setSelectedDestinationId] = useState<string>('');
  const [selectedGoalId, setSelectedGoalId] = useState<string>('');

  const [showValidation, setShowValidation] = useState(false);

  const allOptions: SelectableOption[] = useMemo(() => {
    const accs: SelectableOption[] = accounts.filter(a => !a.is_archived).map(a => ({
      id: a.id,
      name: a.name,
      isCard: false,
      type: a.type?.toLowerCase() || 'corriente',
      balance: a.balance,
    }));
    const cards: SelectableOption[] = creditCards.map(c => ({
      id: c.id,
      name: c.name,
      isCard: true,
      currentDebt: c.current_debt ?? 0,
      totalLimit: c.total_limit ?? 0,
      issuer: c.issuer,
    }));
    return [...accs, ...cards];
  }, [accounts, creditCards]);

  const visibleOptions = useMemo(() => {
    if (txType === 'expense') {
      return allOptions.filter(o => o.isCard || o.type === 'vista' || o.type === 'corriente');
    }
    if (txType === 'income') {
      return allOptions.filter(o => !o.isCard && ['efectivo', 'corriente', 'vista', 'ahorro'].includes(o.type || ''));
    }
    if (txType === 'transfer') {
      return allOptions.filter(o => !o.isCard && ['efectivo', 'corriente', 'vista', 'ahorro'].includes(o.type || ''));
    }
    return [];
  }, [allOptions, txType]);

  const destinationOptions = useMemo(() => {
    return allOptions.filter(o => !o.isCard && ['efectivo', 'corriente', 'vista', 'ahorro'].includes(o.type || '') && o.id !== selectedOriginId);
  }, [allOptions, selectedOriginId]);

  const filteredCategories = categories.filter(c => c.type === (txType === 'expense' ? 'expense' : 'income'));

  const handleTypeChange = (newType: TxType) => {
    setTxType(newType);
    setSelectedOriginId('');
    setIsCreditCard(false);
    setSelectedCategory('');
    setSelectedDestinationId('');
    setSelectedGoalId('');
  };

  const handleOriginChange = (id: string) => {
    setSelectedOriginId(id);
    const option = allOptions.find(o => o.id === id);
    if (option?.isCard) {
      setIsCreditCard(true);
      setTxType('expense');
    } else {
      setIsCreditCard(false);
    }
  };

  const parsedAmount = parseInt(amount.replace(/\D/g, ''), 10);

  const selectedOriginObj = allOptions.find(o => o.id === selectedOriginId);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (txType === 'expense' || txType === 'transfer') {
      if (selectedOriginObj && selectedOriginObj.balance !== undefined && !selectedOriginObj.isCard) {
        if (parsedAmount > selectedOriginObj.balance) {
          alert(`No dispones de fondos suficientes en "${selectedOriginObj.name}". Tu saldo es $${selectedOriginObj.balance.toLocaleString('es-CL')}.`);
          return;
        }
      }
    }

    if (txType !== 'transfer' && !selectedCategory) {
      alert("Por favor selecciona una categoría.");
      return;
    }

    setIsSubmitting(true);
    try {
      const [year, month, day] = date.split('-').map(Number);
      const selectedDate = new Date(year, month - 1, day, 12, 0, 0).toISOString();

      await runMutation(() => runAccounting({ selectedOriginId, selectedDestinationId, selectedGoalId, selectedCategory, description, parsedAmount, date, txType, isPaid, installmentsTotal, note }, async requestId => {
        if (isCreditCard) {
          const instTotal = parseInt(installmentsTotal, 10) || 1;
          await addCreditCardPurchase({
            credit_card_id: selectedOriginId,
            category_id: selectedCategory,
            name: description,
            amount_total: parsedAmount,
            installment_total: instTotal,
            installment_current: 1,
            amount_per_installment: Math.round(parsedAmount / instTotal),
            purchase_date: selectedDate,
            status: 'active',
          }, requestId);
        } else if (txType === 'transfer') {
          await addTransaction({
            account_id: selectedOriginId,
            destination_account_id: selectedDestinationId,
            goal_id: selectedGoalId || undefined,
            category_id: null as any,
            name: description,
            amount: parsedAmount,
            date: selectedDate,
            type: 'expense',
            status: 'paid',
            validated_at: new Date().toISOString(),
            is_recurring: false,
            note: note || undefined,
          }, false, requestId);
        } else {
          await addTransaction({
            account_id: selectedOriginId,
            category_id: selectedCategory,
            name: description,
            amount: parsedAmount,
            date: selectedDate,
            type: txType,
            status: isPaid ? 'paid' : 'pending',
            due_date: isPaid ? undefined : new Date(dueDate).toISOString(),
            validated_at: isPaid ? new Date().toISOString() : null,
            is_recurring: false,
            note: note || undefined,
          }, false, requestId);
        }
      }));

      navigate('/wallet');
    } catch (error: any) {
      console.error(error);
      alert(`Error al guardar: ${error?.message || 'Error desconocido'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderOptionIcon = (option: SelectableOption) => {
    if (option.isCard) {
      return (
        <div className="w-6 h-6 rounded-lg bg-kyo-purple/10 flex items-center justify-center shadow-sm">
          <CreditCardIcon size={14} className="text-kyo-lightPurple" />
        </div>
      );
    }
    return (
      <div className="w-6 h-6 rounded-lg bg-default-100 dark:bg-[#1A1A1A] flex items-center justify-center shadow-sm">
        <Landmark size={14} className="text-default-500" />
      </div>
    );
  };

  const renderOptionSubtitle = (option: SelectableOption) => {
    if (option.isCard) {
      const availableLimit = (option.totalLimit ?? 0) - Math.abs(option.currentDebt ?? 0);
      return `Cupo: $${availableLimit.toLocaleString('es-CL')}`;
    }
    return `Saldo: $${(option.balance ?? 0).toLocaleString('es-CL')}`;
  };

  return (
    <Form onSubmit={handleSave} validationBehavior="native" className="flex flex-col gap-6 max-w-lg mx-auto w-full pb-20">

      {/* 1. TABS */}
      {!isCreditCard && (
        <div className="grid grid-cols-3 gap-3 w-full">
          <button
            type="button"
            className={`flex flex-col items-center justify-center text-center p-3 rounded-xl border transition-colors ${
              txType === 'expense'
                ? 'border-danger/50 bg-danger/10'
                : 'border-border-subtle bg-transparent hover:bg-kyo-card/50'
            }`}
            onClick={() => handleTypeChange('expense')}
          >
            <ArrowDown size={20} className={`mb-2 ${txType === 'expense' ? 'text-danger' : 'text-[#5a5a72] dark:text-[#a0a0b8]'}`} />
            <span className={`text-sm font-semibold ${txType === 'expense' ? 'text-danger' : 'text-[#5a5a72] dark:text-[#a0a0b8]'}`}>
              Gasto
            </span>
          </button>
          <button
            type="button"
            className={`flex flex-col items-center justify-center text-center p-3 rounded-xl border transition-colors ${
              txType === 'income'
                ? 'border-success/50 bg-success/10'
                : 'border-border-subtle bg-transparent hover:bg-kyo-card/50'
            }`}
            onClick={() => handleTypeChange('income')}
          >
            <ArrowUp size={20} className={`mb-2 ${txType === 'income' ? 'text-success' : 'text-[#5a5a72] dark:text-[#a0a0b8]'}`} />
            <span className={`text-sm font-semibold ${txType === 'income' ? 'text-success' : 'text-[#5a5a72] dark:text-[#a0a0b8]'}`}>
              Ingreso
            </span>
          </button>
          <button
            type="button"
            className={`flex flex-col items-center justify-center text-center p-3 rounded-xl border transition-colors ${
              txType === 'transfer'
                ? 'border-warning/50 bg-warning/10'
                : 'border-border-subtle bg-transparent hover:bg-kyo-card/50'
            }`}
            onClick={() => handleTypeChange('transfer')}
          >
            <ArrowLeftRight size={20} className={`mb-2 ${txType === 'transfer' ? 'text-warning' : 'text-[#5a5a72] dark:text-[#a0a0b8]'}`} />
            <span className={`text-sm font-semibold ${txType === 'transfer' ? 'text-warning' : 'text-[#5a5a72] dark:text-[#a0a0b8]'}`}>
              Transferir
            </span>
          </button>
        </div>
      )}

      {isCreditCard && (
        <div className="flex items-center justify-between p-4 bg-kyo-purple/10 rounded-xl border border-[#6d28d9]/30">
          <div className="flex items-center gap-2">
            <CreditCardIcon size={18} className="text-kyo-lightPurple" />
            <span className="text-sm font-bold text-kyo-lightPurple">Modo Tarjeta de Crédito</span>
          </div>
          <button
            type="button"
            className="text-xs text-[#5a5a72] dark:text-[#a0a0b8] hover:text-kyo-lightPurple transition-colors underline"
            onClick={() => {
              setIsCreditCard(false);
              setSelectedOriginId('');
              setInstallmentsTotal('1');
            }}
          >
            Cambiar tipo
          </button>
        </div>
      )}

      {/* 2. DESCRIPCION */}
      <TextField
        isRequired
        className="w-full flex flex-col gap-2"
        value={description}
        onChange={setDescription}
      >
        <Label className="text-[10px] font-bold text-[#5a5a72] dark:text-[#a0a0b8] uppercase tracking-widest">Descripción</Label>
        <Input
          placeholder="Ej: Supermercado Jumbo"
          maxLength={40}
          className="bg-white dark:bg-surface-card hover:bg-default-100 dark:hover:bg-surface-card p-3 rounded-xl w-full outline-none transition-colors border border-transparent dark:border-border-subtle text-sm font-medium text-foreground"
        />
      </TextField>

      {/* 3. MONTO */}
      <TextField
        isRequired
        className="w-full flex flex-col gap-2"
        value={amount}
        onChange={(val: any) => {
          const raw = val.replace(/\D/g, '');
          if (!raw) setAmount('');
          else setAmount(parseInt(raw, 10).toLocaleString('es-CL'));
        }}
      >
        <Label className="text-[10px] font-bold text-[#5a5a72] dark:text-[#a0a0b8] uppercase tracking-widest">Monto</Label>
        <div className="bg-white dark:bg-surface-card hover:bg-default-100 dark:hover:bg-surface-card p-3 rounded-xl w-full flex items-center gap-2 transition-colors border border-transparent dark:border-border-subtle">
          <span className={`font-bold ${txType === 'expense' || isCreditCard ? 'text-danger' : txType === 'income' ? 'text-success' : 'text-warning'}`}>$</span>
          <Input
            placeholder="0"
            className={`bg-transparent w-full outline-none font-bold ${txType === 'expense' || isCreditCard ? 'text-danger' : txType === 'income' ? 'text-success' : 'text-warning'}`}
          />
        </div>
      </TextField>

      {/* 4. CUENTA (ORIGEN) */}
      <Select
        isRequired
        className="w-full flex flex-col gap-2"
        placeholder={txType === 'transfer' ? 'Selecciona la cuenta origen' : 'Selecciona una opción'}
        selectedKey={selectedOriginId ? selectedOriginId : null}
        onSelectionChange={(key: any) => {
          if (key) handleOriginChange(key.toString());
        }}
      >
        <Label className="text-[10px] font-bold text-[#5a5a72] dark:text-[#a0a0b8] uppercase tracking-widest">
          {txType === 'transfer' ? 'Cuenta de Origen' : 'Cuenta / Tarjeta'}
        </Label>
        <Select.Trigger className="bg-white dark:bg-surface-card hover:bg-default-100 dark:hover:bg-surface-card transition-colors p-3 rounded-xl border border-transparent dark:border-border-subtle w-full flex items-center justify-between text-left">
          <Select.Value>
            {() => {
              if (!selectedOriginObj) return <span className="text-[#5a5a72] dark:text-[#a0a0b8] text-sm font-medium">Selecciona una opción</span>;
              return (
                <div className="flex items-center gap-3">
                  {renderOptionIcon(selectedOriginObj)}
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-foreground leading-tight">{selectedOriginObj.name}</span>
                    <span className="text-[10px] text-[#5a5a72] dark:text-[#a0a0b8]">{renderOptionSubtitle(selectedOriginObj)}</span>
                  </div>
                </div>
              );
            }}
          </Select.Value>
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover className="bg-white dark:bg-surface-card shadow-xl rounded-xl border border-transparent dark:border-border-subtle">
          <ListBox className="p-1 flex flex-col gap-1">
            {visibleOptions.map((opt) => (
              <ListBox.Item
                key={opt.id}
                id={opt.id}
                textValue={opt.name}
                className="flex items-center gap-3 p-2 hover:bg-default-100 dark:hover:bg-surface-card rounded-lg cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3">
                  {renderOptionIcon(opt)}
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-foreground">{opt.name}</span>
                    <span className="text-[10px] text-[#5a5a72] dark:text-[#a0a0b8]">{renderOptionSubtitle(opt)}</span>
                  </div>
                </div>
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>

      {/* CUOTAS (Solo si es Tarjeta) */}
      {isCreditCard && (
        <TextField
          isRequired
          className="w-full flex flex-col gap-2 animate-in fade-in"
          value={installmentsTotal}
          onChange={(val: any) => setInstallmentsTotal(val.replace(/\D/g, ''))}
        >
          <Label className="text-[10px] font-bold text-[#5a5a72] dark:text-[#a0a0b8] uppercase tracking-widest">Cantidad de Cuotas</Label>
          <Input maxLength={2} className="bg-white dark:bg-surface-card hover:bg-default-100 dark:hover:bg-surface-card p-3 rounded-xl w-full outline-none transition-colors border border-transparent dark:border-border-subtle text-sm font-medium text-foreground" />
          {parseInt(installmentsTotal, 10) > 1 && parsedAmount > 0 && (
            <Description className="text-xs text-kyo-lightPurple font-bold">
              Serán {parseInt(installmentsTotal, 10)} cuotas de ${Math.round(parsedAmount / parseInt(installmentsTotal, 10)).toLocaleString('es-CL')}
            </Description>
          )}
        </TextField>
      )}

      {/* CUENTA DESTINO Y META (Solo si es Transferencia) */}
      {txType === 'transfer' && (
        <div className="flex flex-col gap-6 animate-in fade-in w-full">
          <Select
            isRequired
            className="w-full flex flex-col gap-2"
            placeholder="Selecciona la cuenta de destino"
            selectedKey={selectedDestinationId ? selectedDestinationId : null}
            onSelectionChange={(key: any) => {
              if (key) setSelectedDestinationId(key.toString());
            }}
          >
            <Label className="text-[10px] font-bold text-[#5a5a72] dark:text-[#a0a0b8] uppercase tracking-widest">Cuenta de Destino</Label>
            <Select.Trigger className="bg-white dark:bg-surface-card hover:bg-default-100 dark:hover:bg-surface-card transition-colors p-3 rounded-xl border border-transparent dark:border-border-subtle w-full flex items-center justify-between text-left">
              <Select.Value>
                {() => {
                  const destObj = allOptions.find(o => o.id === selectedDestinationId);
                  if (!destObj) return <span className="text-[#5a5a72] dark:text-[#a0a0b8] text-sm font-medium">Selecciona el destino</span>;
                  return (
                    <div className="flex items-center gap-3">
                      {renderOptionIcon(destObj)}
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-foreground leading-tight">{destObj.name}</span>
                        <span className="text-[10px] text-[#5a5a72] dark:text-[#a0a0b8]">{renderOptionSubtitle(destObj)}</span>
                      </div>
                    </div>
                  );
                }}
              </Select.Value>
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover className="bg-white dark:bg-surface-card shadow-xl rounded-xl border border-transparent dark:border-border-subtle">
              <ListBox className="p-1 flex flex-col gap-1">
                {destinationOptions.map((opt) => (
                  <ListBox.Item
                    key={opt.id}
                    id={opt.id}
                    textValue={opt.name}
                    className="flex items-center gap-3 p-2 hover:bg-default-100 dark:hover:bg-surface-card rounded-lg cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {renderOptionIcon(opt)}
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-foreground">{opt.name}</span>
                        <span className="text-[10px] text-[#5a5a72] dark:text-[#a0a0b8]">{renderOptionSubtitle(opt)}</span>
                      </div>
                    </div>
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>

          {goals.length > 0 && (
            <div className="flex flex-col gap-2 w-full">
              <Label className="text-[10px] font-bold text-[#5a5a72] dark:text-[#a0a0b8] uppercase tracking-widest mb-1">¿Aportar a una meta? (Opcional)</Label>
              <div className="bg-white dark:bg-surface-card border border-transparent dark:border-border-subtle rounded-xl p-2 flex flex-col gap-1 shadow-sm">
                <button
                  type="button"
                  className={`flex items-center gap-3 p-2 rounded-lg transition-all ${selectedGoalId === '' ? 'bg-kyo-purple/10 border border-kyo-purple/30' : 'hover:bg-default-100 dark:hover:bg-[#1A1A1A] border border-transparent'}`}
                  onClick={() => setSelectedGoalId('')}
                >
                  <div className="w-6 h-6 rounded-lg bg-default-100 dark:bg-surface-raised flex items-center justify-center">
                    <ArrowLeftRight size={12} className="text-[#5a5a72] dark:text-[#a0a0b8]" />
                  </div>
                  <span className="text-sm font-medium text-foreground">Solo transferencia (sin meta)</span>
                </button>
                {goals.map(goal => {
                  const Icon = (LucideIcons as any)[goal.icon_name] || Target;
                  const pct = Math.round((goal.current_amount / goal.target_amount) * 100);
                  return (
                    <button
                      key={goal.id}
                      type="button"
                      className={`flex items-center gap-3 p-2 rounded-lg transition-all ${selectedGoalId === goal.id ? 'bg-kyo-purple/10 border border-kyo-purple/30' : 'hover:bg-default-100 dark:hover:bg-[#1A1A1A] border border-transparent'}`}
                      onClick={() => setSelectedGoalId(goal.id)}
                    >
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${goal.color}20`, color: goal.color }}>
                        <Icon size={12} />
                      </div>
                      <div className="flex flex-col items-start flex-1">
                        <span className="text-sm font-medium text-foreground">{goal.name}</span>
                        <div className="flex items-center justify-between w-full mt-0.5">
                          <span className="text-[10px] text-[#5a5a72] dark:text-[#a0a0b8]">${goal.current_amount.toLocaleString('es-CL')} / ${goal.target_amount.toLocaleString('es-CL')}</span>
                          <span className="text-[10px] font-bold" style={{ color: goal.color }}>{pct}%</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. NOTA */}
      <TextField
        className="w-full flex flex-col gap-2"
        value={note}
        onChange={setNote}
      >
        <Label className="text-[10px] font-bold text-[#5a5a72] dark:text-[#a0a0b8] uppercase tracking-widest">Nota (Opcional)</Label>
        <Input
          placeholder="Añade algún detalle..."
          maxLength={120}
          className="bg-white dark:bg-surface-card hover:bg-default-100 dark:hover:bg-surface-card p-3 rounded-xl w-full outline-none transition-colors border border-transparent dark:border-border-subtle text-sm font-medium text-foreground placeholder-default-400"
        />
      </TextField>

      {/* 6. CATEGORIA (No en Transferencias) */}
      {txType !== 'transfer' && (
        <div className="flex flex-col gap-2 w-full">
          <Label className="text-[10px] font-bold text-[#5a5a72] dark:text-[#a0a0b8] uppercase tracking-widest">
            Categoría <span className="text-danger">*</span>
          </Label>
          <div className={`flex flex-wrap gap-2 p-3 bg-white dark:bg-surface-card border rounded-xl shadow-sm transition-colors ${!selectedCategory && showValidation ? 'border-danger' : 'border-transparent dark:border-border-subtle'}`}>
            {filteredCategories.map(cat => {
              const IconComponent = (LucideIcons as any)[cat.icon_name] || ShoppingCart;
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border"
                  style={isSelected ? { backgroundColor: '#a0a0b820', borderColor: '#a0a0b8', color: '#a0a0b8' } : { backgroundColor: 'transparent', borderColor: 'var(--border-subtle)', color: 'var(--text-default-500)' }}
                >
                  <IconComponent size={14} /> {cat.name}
                </button>
              );
            })}
            <button
              type="button"
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border border-border-subtle text-default-500 hover:bg-default-100 dark:hover:bg-surface-card transition-colors"
              onClick={() => navigate('/planning/categories')}
            >
              <LucideIcons.Plus size={14} /> Crear
            </button>
          </div>
          {!selectedCategory && showValidation && <span className="text-[10px] text-danger px-1">Selecciona una categoría</span>}
        </div>
      )}

      {/* 7. FECHA */}
      <TextField
        isRequired
        className="w-full flex flex-col gap-2"
        value={date}
        onChange={setDate}
      >
        <Label className="text-[10px] font-bold text-[#5a5a72] dark:text-[#a0a0b8] uppercase tracking-widest">Fecha de la Transacción</Label>
        <Input
          type="date"
          max={new Date().toISOString().split('T')[0]}
          className="bg-white dark:bg-surface-card hover:bg-default-100 dark:hover:bg-surface-card p-3 rounded-xl w-full outline-none transition-colors border border-transparent dark:border-border-subtle text-sm font-medium text-foreground"
        />
      </TextField>

      {/* 8. PAGO PENDIENTE */}
      {txType !== 'transfer' && !isCreditCard && (
        <div className="flex flex-col gap-4 bg-white dark:bg-surface-card hover:bg-default-100 dark:hover:bg-surface-card border border-transparent dark:border-border-subtle rounded-xl p-4 mt-2 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-foreground">¿Este movimiento ya fue pagado?</span>
              <span className="text-[11px] text-[#5a5a72] dark:text-[#a0a0b8] mt-0.5">Desactívalo si es un pago a futuro.</span>
            </div>
            <Switch checked={isPaid} onCheckedChange={setIsPaid} />
          </div>

          {!isPaid && (
            <div className="flex flex-col gap-2 pt-4 border-t border-border-subtle/10 dark:border-border-subtle animate-in fade-in duration-300">
              <TextField
                isRequired
                className="w-full flex flex-col gap-2"
                value={dueDate}
                onChange={setDueDate}
              >
                <Label className="text-[10px] font-bold text-danger uppercase tracking-widest">Fecha de Vencimiento</Label>
                <Input
                  type="date"
                  className="bg-danger/5 hover:bg-danger/10 p-3 rounded-xl w-full outline-none transition-colors border border-danger/20 text-sm font-bold text-danger"
                />
              </TextField>
            </div>
          )}
        </div>
      )}

      {/* GUARDAR */}
      <div className="pt-4 w-full">
        <Button
          type="submit"
          onPress={() => setShowValidation(true)}
          isLoading={isSubmitting}
          className="w-full font-bold bg-brand-primary text-white hover:bg-[#5b21b6] p-3 h-12 rounded-xl transition-colors disabled:opacity-50"
        >
          {isSubmitting ? <Spinner color="current" size="sm" /> : null}
          {isSubmitting ? 'Guardando...' : txType === 'transfer' ? 'Realizar Transferencia' : 'Guardar Transacción'}
        </Button>
      </div>

    </Form>
  );
}
