import { useState } from "react";
import { useNavigate } from 'react-router-dom';
import { Category } from "@/types";
import { usePrivateMutation } from "@/features/app-shell/hooks/usePrivateMutation";
import { addBudget } from "@/features/budget/api/budgetRepository";
import { Input, Button, Form, TextField, Label, Description, Select, ListBox, Spinner } from "@heroui/react";
import { CalendarDays, CalendarClock, CalendarRange, ChevronDown, ChevronUp } from "lucide-react";
import * as LucideIcons from "lucide-react";

// Custom Switch para máxima compatibilidad
function Switch({ checked, onCheckedChange, className }: { checked: boolean, onCheckedChange: (val: boolean) => void, className?: string }) {
  return (
    <button
      type="button"
      onClick={() => onCheckedChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none ${checked ? 'bg-brand-primary' : 'bg-[#E5E5EA] dark:bg-gray-700'} ${className}`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${checked ? 'translate-x-5' : 'translate-x-0.5'}`}
      />
    </button>
  );
}

interface BudgetFormProps {
  categories: Category[];
}

export function BudgetForm({ categories }: BudgetFormProps) {
  const navigate = useNavigate();
  const { runMutation } = usePrivateMutation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Form State
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [limitAmount, setLimitAmount] = useState('');
  const [period, setPeriod] = useState<'monthly' | 'annual'>('monthly');
  const [isRecurrent, setIsRecurrent] = useState(true);
  const [isRollover, setIsRollover] = useState(false);
  const [alertThreshold, setAlertThreshold] = useState<number | number[]>(80);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Filtrar solo categorías de gasto
  const expenseCategories = categories.filter(c => c.type === 'expense');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategory || !limitAmount) return;

    setIsSubmitting(true);
    setErrorMsg('');

    const parsedAmount = parseInt(limitAmount.replace(/\D/g, ''), 10) || 0;

    try {
      await runMutation(() => addBudget({
        category_id: selectedCategory,
        limit_amount: parsedAmount,
        period: period,
        recurrent: isRecurrent,
        rollover: isRollover,
        alert_threshold: Array.isArray(alertThreshold) ? alertThreshold[0] : alertThreshold,
        start_date: new Date().toISOString()
      }));
      navigate('/budget');
    } catch (error: any) {
      console.error("Error adding budget:", error);
      setErrorMsg('Ocurrió un error al crear el presupuesto. Intenta nuevamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form onSubmit={handleSave} validationBehavior="native" className="flex flex-col gap-6 max-w-lg mx-auto w-full pb-24">
      {errorMsg && (
        <div className="p-4 bg-danger/10 border border-danger/20 rounded-xl text-danger font-medium text-sm animate-in fade-in">
          {errorMsg}
        </div>
      )}

      {/* Selector de Categoría */}
      <Select
        isRequired
        className="w-full flex flex-col gap-2"
        placeholder="Selecciona qué deseas presupuestar"
        selectedKey={selectedCategory ? selectedCategory : null}
        onSelectionChange={(key) => {
          if (key) setSelectedCategory(key.toString());
        }}
      >
        <Label className="text-[10px] font-bold text-[#5a5a72] dark:text-[#a0a0b8] uppercase tracking-widest">Categoría de Gasto</Label>
        <Select.Trigger className="bg-white dark:bg-surface-card hover:bg-default-100 dark:hover:bg-surface-card transition-colors p-3 rounded-xl border border-transparent dark:border-border-subtle w-full">
          <Select.Value>
            {({ selectedText }) => {
              const cat = expenseCategories.find(c => c.id === selectedCategory);
              if (cat) {
                const IconComponent = (LucideIcons as any)[cat.icon_name] || LucideIcons.ShoppingCart;
                return (
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 flex items-center justify-center rounded-lg" style={{ backgroundColor: '#a0a0b820', color: '#a0a0b8' }}>
                      <IconComponent size={14} />
                    </div>
                    <span className="text-sm font-medium">{cat.name}</span>
                  </div>
                );
              }
              return (
                <span className="text-[#5a5a72] dark:text-[#a0a0b8] text-sm">{selectedText || 'Selecciona qué deseas presupuestar'}</span>
              );
            }}
          </Select.Value>
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover className="bg-white dark:bg-surface-card shadow-xl rounded-xl">
          <ListBox className="p-1 flex flex-col gap-1">
            {expenseCategories.map(cat => {
              const IconComponent = (LucideIcons as any)[cat.icon_name] || LucideIcons.ShoppingCart;
              return (
                <ListBox.Item key={cat.id} id={cat.id} textValue={cat.name} className="flex items-center gap-3 p-2 hover:bg-default-100 dark:hover:bg-surface-card rounded-lg cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 flex items-center justify-center rounded-lg shadow-sm" style={{ backgroundColor: '#a0a0b820', color: '#a0a0b8' }}>
                      <IconComponent size={14} />
                    </div>
                    <span className="text-sm font-medium">{cat.name}</span>
                  </div>
                </ListBox.Item>
              );
            })}
          </ListBox>
        </Select.Popover>
      </Select>

      {/* Selector de Periodo */}
      <div className="flex flex-col gap-2 w-full">
        <Label className="text-[10px] font-bold text-[#5a5a72] dark:text-[#a0a0b8] uppercase tracking-widest mb-1">Periodo de Evaluación</Label>
        <div className="grid grid-cols-2 gap-3">
          {[
            { id: 'monthly', label: 'Mensual', desc: 'Cada mes', icon: CalendarClock },
            { id: 'annual', label: 'Anual', desc: 'Todo el año', icon: CalendarRange }
          ].map((type) => {
            const isSelected = period === type.id;
            return (
              <button
                key={type.id}
                type="button"
                onClick={() => setPeriod(type.id as 'monthly' | 'annual')}
                className={`flex flex-col items-center justify-center text-center p-3 rounded-xl border transition-colors ${
                  isSelected
                    ? 'border-kyo-purple bg-kyo-purple/10'
                    : 'border-border-subtle bg-transparent hover:bg-kyo-card/50'
                }`}
              >
                <type.icon size={20} className={`mb-2 ${isSelected ? 'text-kyo-lightPurple' : 'text-[#5a5a72] dark:text-[#a0a0b8]'}`} />
                <span className={`text-sm font-semibold mb-1 ${isSelected ? 'text-kyo-lightPurple' : 'text-[#5a5a72] dark:text-[#a0a0b8]'}`}>
                  {type.label}
                </span>
                <span className={`text-[10px] leading-tight hidden md:block ${isSelected ? 'text-kyo-lightPurple/80' : 'text-[#5a5a72] dark:text-[#a0a0b8]'}`}>
                  {type.desc}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Límite de Presupuesto */}
      <div className="flex flex-col gap-1 w-full">
        <label className="text-[10px] font-bold text-[#5a5a72] dark:text-[#a0a0b8] uppercase tracking-widest ml-1 mb-1">Monto Límite *</label>
        <div className="bg-white dark:bg-surface-card hover:bg-default-100 dark:hover:bg-surface-card p-3.5 rounded-xl w-full flex items-center gap-2 transition-colors border border-transparent dark:border-border-subtle focus-within:border-[#6d28d9] shadow-sm">
          <span className="text-kyo-lightPurple font-bold text-lg">$</span>
          <input
            required
            value={limitAmount}
            onChange={(e) => {
              const raw = e.target.value.replace(/\D/g, '');
              const num = parseInt(raw, 10);
              if (!isNaN(num) && num > 999999999) return;
              setLimitAmount(isNaN(num) ? '' : num.toLocaleString('es-CL'));
            }}
            placeholder="0"
            className="bg-transparent w-full outline-none text-lg font-bold text-foreground"
          />
        </div>
      </div>

      {/* Opciones Avanzadas */}
      <div className="flex flex-col gap-1 w-full mt-4">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex justify-between items-center w-full px-1 mb-1 outline-none"
        >
          <span className="text-[10px] font-bold text-[#5a5a72] dark:text-[#a0a0b8] uppercase tracking-widest">Opciones Avanzadas</span>
          {showAdvanced ? (
            <ChevronUp size={14} className="text-[#5a5a72] dark:text-[#a0a0b8]" />
          ) : (
            <ChevronDown size={14} className="text-[#5a5a72] dark:text-[#a0a0b8]" />
          )}
        </button>

        {showAdvanced && (
          <div className="bg-white dark:bg-surface-card border border-transparent dark:border-border-subtle rounded-xl overflow-hidden shadow-sm flex flex-col animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Renovación automática */}
          <div className="flex justify-between items-center p-3.5 border-b border-border-subtle/10 dark:border-border-subtle/50 hover:bg-default-100 dark:hover:bg-surface-card transition-colors">
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-foreground">Renovación automática</span>
              <span className="text-[11px] text-[#5a5a72] dark:text-[#a0a0b8]">Se reiniciará al terminar el periodo</span>
            </div>
            <Switch checked={isRecurrent} onCheckedChange={setIsRecurrent} className="scale-75 origin-right" />
          </div>

          {/* Acumular sobrante */}
          <div className="flex justify-between items-center p-3.5 border-b border-border-subtle/10 dark:border-border-subtle/50 hover:bg-default-100 dark:hover:bg-surface-card transition-colors">
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-foreground">Acumular sobrante</span>
              <span className="text-[11px] text-[#5a5a72] dark:text-[#a0a0b8]">Sumar lo no gastado al mes siguiente</span>
            </div>
            <Switch checked={isRollover} onCheckedChange={setIsRollover} className="scale-75 origin-right" />
          </div>

          {/* Slider de Alerta */}
          <div className="flex flex-col p-4 gap-3 hover:bg-default-100 dark:hover:bg-surface-card transition-colors">
            <div className="flex justify-between items-center w-full">
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-foreground">Alerta de uso</span>
                <span className="text-[11px] text-[#5a5a72] dark:text-[#a0a0b8]">Notificación al alcanzar este porcentaje; 0 la desactiva</span>
              </div>
              <span className="text-sm font-bold text-kyo-lightPurple">
                {(() => {
                  const val = Array.isArray(alertThreshold) ? alertThreshold[0] : alertThreshold;
                  return val === 0 ? 'Off' : `${val}%`;
                })()}
              </span>
            </div>
            <div className="relative w-full mb-1 mt-1">
              {(() => {
                const val = Array.isArray(alertThreshold) ? alertThreshold[0] : alertThreshold;
                return (
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={val}
                    onChange={(e) => setAlertThreshold(parseInt(e.target.value))}
                    className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-[#6d28d9]"
                    style={{
                      background: `linear-gradient(to right, #6d28d9 0%, #6d28d9 ${val}%, rgba(109, 40, 217, 0.15) ${val}%, rgba(109, 40, 217, 0.15) 100%)`
                    }}
                  />
                );
              })()}
              <div className="relative w-full h-4 mt-2">
                <span className="absolute text-[10px] text-[#5a5a72] dark:text-[#a0a0b8] font-medium left-0">0%</span>
                <span className="absolute text-[10px] text-[#5a5a72] dark:text-[#a0a0b8] font-medium -translate-x-1/2" style={{ left: '50%' }}>50%</span>
              </div>
            </div>
          </div>
        </div>
        )}
      </div>

      <div className="pt-4 w-full">
        <Button
          type="submit"
          isPending={isSubmitting}
          className="w-full font-bold bg-brand-primary text-white hover:bg-[#5b21b6] p-3 h-12 rounded-xl transition-colors disabled:opacity-50"
        >
          {({isPending}) => (
            <>
              {isPending ? <Spinner color="current" size="sm" /> : null}
              {isPending ? 'Guardando...' : 'Crear Presupuesto'}
            </>
          )}
        </Button>
      </div>
    </Form>
  );
}
