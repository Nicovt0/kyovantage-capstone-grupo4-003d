import { Suspense, useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader } from "@/shared/ui/PageHeader";
import { Save, AlertCircle, ChevronDown, Landmark, ShoppingCart, Tag, Coffee, Home, Car, Zap, Heart, Gift, Briefcase, GraduationCap, Monitor, Music, Plane, Dumbbell, Wine, Baby, Gamepad2, Wrench, CreditCard } from "lucide-react";
import { Account, Category, RecurringTemplate } from "@/types";
import { getAccounts } from "@/features/wallet/api/accountRepository";
import { getCategories } from "@/features/budget/api/categoryRepository";
import { getCreditCards } from "@/features/credit-cards/api/creditCardRepository";
import { getRecurringTemplates, addRecurringTemplate, updateRecurringTemplate } from "@/features/settings/api/recurringRepository";
import { Button, Spinner, Slider } from "@heroui/react";
import { usePrivateMutation } from '@/features/app-shell/hooks/usePrivateMutation';

import { WheelPicker } from "@/shared/ui/WheelPicker";


function RecurringItemFormContent() {
  const navigate = useNavigate();
  const { runMutation } = usePrivateMutation();
  const [searchParams] = useSearchParams();
  const id = searchParams.get('id');
  const typeParam = searchParams.get('type');
  const type = (typeParam === 'income' || typeParam === 'expense') ? (typeParam as 'income' | 'expense') : 'expense';

  const isIncome = type === 'income';

  const [isLoading, setIsLoading] = useState(true);
  const [initialData, setInitialData] = useState<RecurringTemplate | null>(null);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [creditCards, setCreditCards] = useState<any[]>([]);

  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');

  const [selectedAccount, setSelectedAccount] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [leadDays, setLeadDays] = useState(5);
  const [isEssential, setIsEssential] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showValidation, setShowValidation] = useState(false);

  const [isAccDropdownOpen, setIsAccDropdownOpen] = useState(false);
  const [isCatDropdownOpen, setIsCatDropdownOpen] = useState(false);

  const [isDayPickerOpen, setIsDayPickerOpen] = useState(false);
  const [isLeadPickerOpen, setIsLeadPickerOpen] = useState(false);

  const iconMap: Record<string, any> = {
    Tag, ShoppingCart, Coffee, Home, Car, Zap, Heart, Gift, Briefcase, GraduationCap, Monitor, Music, Plane, Dumbbell, Wine, Baby, Gamepad2, Wrench
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      const [allAccounts, allCategories, allCreditCards, allTemplates] = await Promise.all([
        getAccounts(),
        getCategories(),
        getCreditCards(),
        getRecurringTemplates()
      ]);

      const filteredAccs = allAccounts.filter(a => a.type !== 'ahorro' && a.type !== 'saving');
      setAccounts(filteredAccs);
      setCategories(allCategories);
      setCreditCards(allCreditCards);

      if (id) {
        const found = allTemplates.find(t => t.id === id);
        if (found) {
          setInitialData(found);
          setName(found.name);
          setAmount(found.expected_amount?.toLocaleString('es-CL') || '');
          setSelectedAccount(found.account_id || '');
          setSelectedCategory(found.category_id || '');
          setDayOfMonth(found.day_of_month || 1);
          setLeadDays(found.lead_days || 5);
          setIsEssential(found.is_essential ?? true);
        }
      } else {
        // Por defecto, cuenta y categoría vacías (Por seleccionar...)
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '');
    if (val === '') {
      setAmount('');
      return;
    }
    if (val.length > 12) return;
    setAmount(parseInt(val, 10).toLocaleString('es-CL'));
  };

  const handleSubmit = async () => {
    setShowValidation(true);
    if (!name || !amount) return;

    setIsSubmitting(true);

    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
    const isPastThisMonth = Number(dayOfMonth) < now.getDate();

    const payload: any = {
      name,
      expected_amount: parseInt(amount.replace(/\D/g, ''), 10),
      account_id: selectedAccount || undefined,
      category_id: selectedCategory || undefined,
      day_of_month: dayOfMonth,
      lead_days: leadDays,
      is_essential: isEssential,
      type,
    };

    if (!id && isPastThisMonth) {
      payload.last_generated_month = currentMonthStr;
    }

    try {
      if (id && initialData) {
        await runMutation(() => updateRecurringTemplate(id, payload));
      } else {
        await runMutation(() => addRecurringTemplate(payload));
      }
      navigate(`/settings/fixed-${isIncome ? 'incomes' : 'expenses'}`);
    } catch (error) {
      console.error(error);
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 animate-in fade-in pb-20">
        <PageHeader title="Cargando..." showBack />
        <div className="flex justify-center py-10"><Spinner color="current" /></div>
      </div>
    );
  }

  const filteredAccounts = accounts;
  const selectedAccountObj = filteredAccounts.find(a => a.id === selectedAccount);
  const selectedCreditCardObj = creditCards.find(c => c.id === selectedAccount);
  const selectedCategoryObj = categories.find(c => c.id === selectedCategory);
  const displayObj = selectedAccountObj || selectedCreditCardObj;

  return (
    <div className="flex flex-col gap-6 animate-in fade-in pb-20">

      <div className="hidden md:flex flex-col w-full">
        <PageHeader
          title={`${id ? 'Editar' : 'Añadir'} ${isIncome ? 'Ingreso' : 'Gasto'}`}
          showBack
        />
      </div>

      <div className="flex flex-col gap-6 max-w-lg mx-auto w-full">

        {/* Nombre */}
        <div className="flex flex-col gap-2 w-full">
          <label className="text-[10px] font-bold text-[#5a5a72] dark:text-[#a0a0b8] uppercase tracking-widest ml-1">Nombre</label>
          <div className={`flex items-center gap-3 bg-white dark:bg-surface-card hover:bg-default-100 dark:hover:bg-surface-card p-3.5 rounded-xl border transition-colors shadow-sm ${showValidation && !name ? 'border-danger' : 'border-transparent dark:border-border-subtle focus-within:border-[#6d28d9]'}`}>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={isIncome ? 'Ej: Sueldo' : 'Ej: Arriendo'}
              maxLength={40}
              className="bg-transparent border-none outline-none w-full font-bold text-foreground"
            />
          </div>
          {showValidation && !name && <span className="text-[10px] text-danger font-medium ml-1">Campo obligatorio</span>}
        </div>

        {/* Monto Mensual */}
        <div className="flex flex-col gap-2 w-full">
          <label className="text-[10px] font-bold text-[#5a5a72] dark:text-[#a0a0b8] uppercase tracking-widest ml-1">Monto Mensual</label>
          <div className={`flex items-center gap-2 bg-white dark:bg-surface-card hover:bg-default-100 dark:hover:bg-surface-card p-3.5 rounded-xl border transition-colors shadow-sm ${showValidation && !amount ? 'border-danger' : 'border-transparent dark:border-border-subtle focus-within:border-[#6d28d9]'}`}>
            <span className={`font-bold shrink-0 ${isIncome ? 'text-[#17c964]' : 'text-[#f31260]'}`}>$</span>
            <input
              type="text"
              value={amount}
              onChange={handleAmountChange}
              placeholder="0"
              className="bg-transparent border-none outline-none w-full font-bold text-foreground text-lg"
            />
          </div>
          {showValidation && !amount && <span className="text-[10px] text-danger font-medium ml-1">Campo obligatorio</span>}
        </div>

        {/* Días (Pickers Inline Sin Bordes) */}
        <div className="flex flex-col gap-4 w-full bg-white dark:bg-surface-card p-5 rounded-xl border border-transparent dark:border-border-subtle shadow-sm">
          <div className="grid grid-cols-2 gap-4 w-full">

            <div className="flex flex-col gap-2 items-center">
              <label className="text-[10px] font-bold text-[#5a5a72] dark:text-[#a0a0b8] uppercase tracking-widest text-center">Día del mes</label>
              <WheelPicker
                 items={Array.from({length: 31}, (_, i) => i + 1)}
                 value={dayOfMonth}
                 onChange={setDayOfMonth}
                 format={(val) => `Día ${val}`}
                 height={130}
                 itemHeight={40}
              />
            </div>

            <div className="flex flex-col gap-2 items-center">
              <label className="text-[10px] font-bold text-[#5a5a72] dark:text-[#a0a0b8] uppercase tracking-widest text-center">Anticipación</label>
              <WheelPicker
                 items={Array.from({length: 16}, (_, i) => i)}
                 value={leadDays}
                 onChange={setLeadDays}
                 format={(val) => val === 0 ? 'Mismo día' : `${val} día${val > 1 ? 's' : ''}`}
                 height={130}
                 itemHeight={40}
              />
            </div>

          </div>
        </div>

        {/* Importancia */}
        <div className="flex flex-col gap-2 w-full">
          <label className="text-[10px] font-bold text-[#5a5a72] dark:text-[#a0a0b8] uppercase tracking-widest ml-1">Importancia</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setIsEssential(true)}
              className={`py-3 rounded-xl font-bold text-sm transition-all flex flex-col items-center justify-center gap-1 cursor-pointer border ${isEssential ? 'border-[#6d28d9] bg-brand-primary/10 text-[#6d28d9] shadow-sm' : 'border-transparent bg-white dark:bg-surface-card text-[#5a5a72] hover:bg-default-100 dark:hover:bg-surface-card'}`}
            >
              <span className="text-sm">Esencial</span>
              <span className="text-[10px] opacity-80 font-medium">Prioritario en presupuesto</span>
            </button>
            <button
              type="button"
              onClick={() => setIsEssential(false)}
              className={`py-3 rounded-xl font-bold text-sm transition-all flex flex-col items-center justify-center gap-1 cursor-pointer border ${!isEssential ? 'border-warning bg-warning/10 text-warning shadow-sm' : 'border-transparent bg-white dark:bg-surface-card text-[#5a5a72] hover:bg-default-100 dark:hover:bg-surface-card'}`}
            >
              <span className="text-sm">Opcional</span>
              <span className="text-[10px] opacity-80 font-medium">No indispensable</span>
            </button>
          </div>
        </div>

        {/* Cuenta */}
        <div className="flex flex-col gap-2 relative w-full">
          <label className="text-[10px] font-bold text-[#5a5a72] dark:text-[#a0a0b8] uppercase tracking-widest ml-1">Cuenta</label>
          <div
            className="bg-white dark:bg-surface-card p-3.5 rounded-xl border border-transparent dark:border-border-subtle cursor-pointer flex justify-between items-center transition-colors shadow-sm hover:border-[#6d28d9]/50 dark:hover:border-[#6d28d9]/50"
            onClick={() => { setIsAccDropdownOpen(!isAccDropdownOpen); setIsCatDropdownOpen(false); }}
          >
            {displayObj ? (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-default-100 dark:bg-surface-card flex items-center justify-center">
                  {selectedCreditCardObj ? (
                    <CreditCard size={14} className="text-[#006FEE]" />
                  ) : (
                    <Landmark size={14} className="text-[#006FEE]" />
                  )}
                </div>
                <span className="font-bold text-sm text-foreground">{displayObj.name}</span>
              </div>
            ) : (
              <div className="flex items-center gap-3 opacity-80">
                <div className="w-8 h-8 rounded-xl bg-default-100 dark:bg-surface-raised flex items-center justify-center">
                  <Landmark size={14} className="text-[#5a5a72]" />
                </div>
                <span className="text-[#5a5a72] text-sm font-semibold">Por seleccionar...</span>
              </div>
            )}
            <ChevronDown size={16} className="text-[#5a5a72]" />
          </div>

          {isAccDropdownOpen && (
            <div className="absolute top-[80px] left-0 right-0 bg-white dark:bg-surface-card border border-default-200 dark:border-border-subtle rounded-2xl shadow-xl z-20 max-h-48 overflow-y-auto p-2 flex flex-col gap-1">
              <div
                className="flex items-center gap-3 p-2 hover:bg-default-100 dark:hover:bg-surface-card rounded-xl cursor-pointer transition-colors"
                onClick={() => { setSelectedAccount(''); setIsAccDropdownOpen(false); }}
              >
                <div className="w-8 h-8 rounded-xl bg-default-100 dark:bg-surface-raised flex items-center justify-center">
                  <Landmark size={14} className="text-[#5a5a72]" />
                </div>
                <span className="text-sm font-semibold text-[#5a5a72]">Por seleccionar...</span>
              </div>
              <div className="px-3 pt-2 pb-1 text-[10px] font-bold text-[#5a5a72] uppercase tracking-wide">Cuentas</div>
              {filteredAccounts.map(acc => (
                <div
                  key={acc.id}
                  className="flex items-center gap-3 p-2 hover:bg-default-100 dark:hover:bg-surface-card rounded-xl cursor-pointer transition-colors"
                  onClick={() => { setSelectedAccount(acc.id); setIsAccDropdownOpen(false); }}
                >
                  <div className="w-8 h-8 rounded-xl bg-default-100 dark:bg-surface-raised flex items-center justify-center">
                    <Landmark size={14} className="text-[#006FEE]" />
                  </div>
                  <span className="text-sm font-bold text-foreground">{acc.name}</span>
                </div>
              ))}

              {creditCards.length > 0 && type === 'expense' && (
                <>
                  <div className="px-3 pt-3 pb-1 text-[10px] font-bold text-[#5a5a72] uppercase tracking-wide">Tarjetas</div>
                  {creditCards.map(cc => (
                    <div
                      key={cc.id}
                      className="flex items-center gap-3 p-2 hover:bg-default-100 dark:hover:bg-surface-card rounded-xl cursor-pointer transition-colors"
                      onClick={() => { setSelectedAccount(cc.id); setIsAccDropdownOpen(false); }}
                    >
                      <div className="w-8 h-8 rounded-xl bg-default-100 dark:bg-surface-raised flex items-center justify-center">
                        <CreditCard size={14} className="text-[#006FEE]" />
                      </div>
                      <span className="text-sm font-bold text-foreground">{cc.name}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {/* Categoría */}
        <div className="flex flex-col gap-2 relative w-full">
          <label className="text-[10px] font-bold text-[#5a5a72] dark:text-[#a0a0b8] uppercase tracking-widest ml-1">Categoría</label>
          <div
            className={`bg-white dark:bg-surface-card p-3.5 rounded-xl border cursor-pointer flex justify-between items-center transition-colors shadow-sm border-transparent dark:border-border-subtle hover:border-[#6d28d9]/50 dark:hover:border-[#6d28d9]/50`}
            onClick={() => { setIsCatDropdownOpen(!isCatDropdownOpen); setIsAccDropdownOpen(false); }}
          >
            {selectedCategoryObj ? (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#a0a0b820' }}>
                  {(() => {
                    const IconComponent = iconMap[selectedCategoryObj.icon_name] || ShoppingCart;
                    return <IconComponent size={14} style={{ color: '#a0a0b8' }} />;
                  })()}
                </div>
                <span className="font-bold text-sm text-foreground">{selectedCategoryObj.name}</span>
              </div>
            ) : (
              <div className="flex items-center gap-3 opacity-80">
                <div className="w-8 h-8 rounded-xl bg-default-100 dark:bg-surface-raised flex items-center justify-center">
                  <Tag size={14} className="text-[#5a5a72]" />
                </div>
                <span className="text-[#5a5a72] text-sm font-semibold">Por seleccionar...</span>
              </div>
            )}
            <ChevronDown size={16} className="text-[#5a5a72]" />
          </div>

          {isCatDropdownOpen && (
            <div className="absolute top-[80px] left-0 right-0 bg-white dark:bg-surface-card border border-default-200 dark:border-border-subtle rounded-2xl shadow-xl z-20 max-h-48 overflow-y-auto p-2 flex flex-col gap-1">
              <div
                className="flex items-center gap-3 p-2 hover:bg-default-100 dark:hover:bg-surface-card rounded-xl cursor-pointer transition-colors"
                onClick={() => { setSelectedCategory(''); setIsCatDropdownOpen(false); }}
              >
                <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-default-100 dark:bg-surface-raised">
                  <Tag size={14} className="text-[#5a5a72]" />
                </div>
                <span className="text-sm font-semibold text-[#5a5a72]">Por seleccionar...</span>
              </div>
              {categories.filter(c => c.type === type).map(cat => {
                const IconComponent = iconMap[cat.icon_name] || ShoppingCart;
                return (
                  <div
                    key={cat.id}
                    className="flex items-center gap-3 p-2 hover:bg-default-100 dark:hover:bg-surface-card rounded-xl cursor-pointer transition-colors"
                    onClick={() => { setSelectedCategory(cat.id); setIsCatDropdownOpen(false); }}
                  >
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#a0a0b820' }}>
                      <IconComponent size={14} style={{ color: '#a0a0b8' }} />
                    </div>
                    <span className="text-sm font-bold text-foreground">{cat.name}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Aviso */}
        <div className="flex items-start gap-3 bg-brand-primary/5 dark:bg-brand-primary/10 p-4 rounded-xl border border-[#6d28d9]/20 w-full mt-2">
          <AlertCircle size={20} className="text-[#6d28d9] shrink-0 mt-0.5" />
          <p className="text-xs text-foreground/80 font-medium leading-relaxed">
            Se generará un pago pendiente en tu agenda cada día <strong>{dayOfMonth - leadDays <= 0 ? 1 : dayOfMonth - leadDays}</strong> del mes, dándote {leadDays} día{leadDays !== 1 && 's'} de margen antes de la fecha límite (día {dayOfMonth}).
          </p>
        </div>

        <Button
          className="w-full h-14 bg-brand-primary text-white font-bold shadow-md hover:bg-[#5b21b6] mt-4 rounded-xl"
          isDisabled={isSubmitting}
          onPress={handleSubmit}
        >
          {isSubmitting ? 'Guardando...' : 'Guardar Plantilla'}
        </Button>

      </div>
    </div>
  );
}

export default function RecurringItemFormPage() {
  return (
    <Suspense fallback={<div className="flex justify-center p-10">Cargando formulario...</div>}>
      <RecurringItemFormContent />
    </Suspense>
  );
}
