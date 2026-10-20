import { useState } from "react";
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Bot, Check, AlertTriangle, X, ChevronLeft } from "lucide-react";
import { Bank } from "@/types";
import { usePrivateMutation } from "@/features/app-shell/hooks/usePrivateMutation";
import { addCreditCard } from "@/features/credit-cards/api/creditCardRepository";
import { CreditCardVisual } from "@/shared/ui/CreditCardVisual";
import { WheelPicker } from "@/shared/ui/WheelPicker";


interface CreditCardFormProps {
  banks: Bank[];
}

export function CreditCardForm({ banks }: CreditCardFormProps) {
  const navigate = useNavigate();
  const { runMutation } = usePrivateMutation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [name, setName] = useState('');
  const [bank_id, setbank_id] = useState('');
  const [type, setType] = useState(''); // Gold, Platinum, Black, Classic
  const [issuer, setIssuer] = useState<'visa' | 'mastercard' | 'amex' | ''>('');
  const [last_4_digits, setlast_4_digits] = useState('');
  const [total_limit, settotal_limit] = useState('');
  const [threshold, setThreshold] = useState(30);
  const [isBankDropdownOpen, setIsBankDropdownOpen] = useState(false);
  const [isUnitDropdownOpen, setIsUnitDropdownOpen] = useState(false);
  const [maintenance, setMaintenance] = useState('');
  const [maintenance_currency, setMaintenanceCurrency] = useState<'clp' | 'uf'>('clp');
  const [billing_date, setbilling_date] = useState(15);
  const [payment_date, setpayment_date] = useState(5);
  const [interest, setInterest] = useState('');
  const [defaultInterest, setDefaultInterest] = useState('2,9');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const formatCurrency = (val: string) => {
    const raw = val.replace(/\D/g, '');
    if (!raw) return '';
    return parseInt(raw, 10).toLocaleString('es-CL');
  };

  const parseCurrency = (val: string) => {
    return parseInt(val.replace(/\D/g, ''), 10) || 0;
  };

  const handleInterestChange = (val: string) => {
    const sanitized = val.replace(/[^0-9.,]/g, '');
    const numericValue = parseFloat(sanitized.replace(',', '.'));
    if (!isNaN(numericValue) && numericValue > 100) {
      return; // Do not update if greater than 100
    }
    setInterest(sanitized);
  };

  const parseDecimal = (val: string) => {
    if (!val) return 0;
    // Normalize: change comma to dot for JS parseFloat
    const normalized = val.replace(',', '.');
    return parseFloat(normalized) || 0;
  };

  const selectedBank = banks.find(b => b.id === bank_id);

  let healthLabel = 'Saludable';
  let healthClass = 'bg-[#EAF3DE] text-[#3B6D11] dark:bg-green-950/30 dark:text-green-400 dark:border dark:border-green-900/30';
  let Icon = Check;
  if (threshold > 70) {
    healthLabel = 'Peligro';
    healthClass = 'bg-[#FCEBEB] text-[#A32D2D] dark:bg-red-950/30 dark:text-red-400 dark:border dark:border-red-900/30';
    Icon = AlertTriangle;
  } else if (threshold > 40) {
    healthLabel = 'Atención';
    healthClass = 'bg-[#FAEEDA] text-[#854F0B] dark:bg-yellow-950/30 dark:text-yellow-400 dark:border dark:border-yellow-900/30';
    Icon = AlertTriangle;
  }

  const canSave = name && bank_id && type && issuer && total_limit && interest && maintenance;

  const handleSave = async () => {
    setShowValidation(true);
    if (!canSave || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMsg('');
    try {
      await runMutation(() => addCreditCard({
        bank_id,
        name,
        type,
        issuer: issuer as 'visa' | 'mastercard' | 'amex',
        last_4_digits: last_4_digits ? parseInt(last_4_digits, 10) : undefined,
        total_limit: parseCurrency(total_limit),
        recommended_threshold: threshold,
        billing_date,
        payment_date,
        maintenance_cost: maintenance_currency === 'uf' ? parseDecimal(maintenance) : parseCurrency(maintenance),
        maintenance_currency,
        monthly_interest_rate: parseDecimal(interest),
        default_interest_rate: parseDecimal(defaultInterest),
      }));
      navigate('/credit-cards');
    } catch (error) {
      console.error("Error adding card:", error);
      setErrorMsg(error instanceof Error ? error.message : "Error al guardar la tarjeta");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDateChange = (setter: React.Dispatch<React.SetStateAction<number>>, current: number, delta: number) => {
    let newVal = current + delta;
    if (newVal < 1) newVal = 31;
    if (newVal > 31) newVal = 1;
    setter(newVal);
  };

  return (
    <div className="flex flex-col h-full pb-6 pt-2 max-w-xl mx-auto w-full">
      <div className="flex-1 overflow-y-auto flex flex-col gap-0 pb-6 scrollbar-hide">

        {errorMsg && (
          <div className="mx-4 mb-4 p-4 bg-danger/10 border border-danger/20 rounded-xl text-danger font-medium text-sm animate-in fade-in">
            {errorMsg}
          </div>
        )}

        {/* Live Preview */}
        <div className="px-4 pb-4 flex justify-center">
          <CreditCardVisual
            card={{
              name: name || undefined,
              type: type || undefined,
              issuer: issuer || undefined,
              last_4_digits: last_4_digits ? parseInt(last_4_digits, 10) : undefined,
              billing_date: billing_date,
            }}
            bank={selectedBank}
            bankName={selectedBank ? selectedBank.name : 'Selecciona un banco'}
          />
        </div>

        {/* Bloque A: Identidad */}
        <div className="p-4 border-b border-[#E5E5EA] dark:border-border-subtle">
          <div className="flex items-center gap-2.5 mb-3.5">
            <div>
              <div className="text-[14px] font-bold text-foreground">Identidad</div>
              <div className="text-[11px] text-default-500 mt-[2px]">¿Cómo quieres llamar a esta tarjeta?</div>
            </div>
          </div>
          <div className="flex flex-col gap-2.5">
            <div className="flex flex-col gap-1.5">
              <div className="text-[11px] text-[#8E8E93] dark:text-gray-400 font-medium pl-0.5">Nombre personalizado</div>
              <input
                type="text"
                maxLength={40}
                className={`bg-[#F2F2F7] dark:bg-surface-card rounded-xl px-3 py-2.5 text-[13px] text-[#1C1C1E] dark:text-white border outline-none w-full transition-colors focus:bg-white dark:focus:bg-surface-card focus:border-[#6d28d9] dark:focus:border-[#6d28d9] ${showValidation && !name ? 'border-red-500 ring-1 ring-red-500/20' : name ? 'bg-white dark:bg-surface-card border-[#E5E5EA] dark:border-[#6d28d9]/50' : 'border-[#E5E5EA] dark:border-border-subtle'}`}
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ej: Mi Gold Viajes ✈"
              />
              {showValidation && !name && (
                <span className="text-[10px] text-red-500 font-medium ml-0.5">Campo obligatorio</span>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="text-[11px] text-[#8E8E93] dark:text-gray-400 font-medium pl-0.5">Últimos 4 dígitos (opcional)</div>
              <input
                type="text"
                maxLength={4}
                className={`bg-[#F2F2F7] dark:bg-surface-card rounded-xl px-3 py-2.5 text-[13px] text-[#1C1C1E] dark:text-white border outline-none w-full transition-colors focus:bg-white dark:focus:bg-surface-card focus:border-[#6d28d9] dark:focus:border-[#6d28d9] ${last_4_digits ? 'bg-white dark:bg-surface-card border-[#E5E5EA] dark:border-[#6d28d9]/50' : 'border-[#E5E5EA] dark:border-border-subtle'}`}
                value={last_4_digits}
                onChange={e => setlast_4_digits(e.target.value.replace(/\D/g, ''))}
                placeholder="Ej: 4821"
              />
            </div>
            <div className="flex flex-col gap-1.5" style={{ position: 'relative' }}>
              <div className="text-[11px] text-[#8E8E93] dark:text-gray-400 font-medium pl-0.5">Banco</div>
              <div
                className={`bg-white dark:bg-surface-card rounded-xl px-3 py-2.5 text-[13px] text-[#1C1C1E] dark:text-white border outline-none w-full appearance-none relative ${showValidation && !bank_id ? 'border-red-500 ring-1 ring-red-500/20' : 'border-[#E5E5EA] dark:border-border-subtle'}`}
                onClick={() => setIsBankDropdownOpen(!isBankDropdownOpen)}
                style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                {selectedBank ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full" style={{ background: selectedBank.color }}></div>
                    <span>{selectedBank.name}</span>
                  </div>
                ) : (
                  <span className="text-[#C7C7CC] dark:text-gray-500">Selecciona tu banco</span>
                )}
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8E8E93] pointer-events-none" style={{ position: 'static', transform: 'none' }} />
              </div>
              {showValidation && !bank_id && (
                <span className="text-[10px] text-red-500 font-medium ml-0.5">Campo obligatorio</span>
              )}

              {isBankDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-surface-card rounded-2xl shadow-xl border border-gray-100 dark:border-border-subtle p-2 z-50 max-h-60 overflow-y-auto scale-in-center">
                  {banks.map(b => (
                    <div
                      key={b.id}
                      className="flex items-center gap-3 p-3 hover:bg-[#F2F2F7] dark:hover:bg-surface-raised rounded-xl cursor-pointer transition-colors"
                      onClick={() => {
                        setbank_id(b.id);
                        setIsBankDropdownOpen(false);
                      }}
                    >
                      <div className="w-5 h-5 rounded-full shadow-sm" style={{ background: b.color }}></div>
                      <span className="text-[13px] text-[#1C1C1E] dark:text-white font-medium">{b.name}</span>
                    </div>
                  ))}
                  <div
                    className="flex items-center gap-3 p-3 hover:bg-[#F2F2F7] dark:hover:bg-surface-raised rounded-xl cursor-pointer transition-colors border-t border-gray-100 dark:border-border-subtle mt-1"
                    onClick={() => navigate('/settings')}
                  >
                    <div className="w-5 h-5 rounded-full border border-dashed border-gray-400 flex items-center justify-center text-gray-500">
                      <span className="text-[14px] leading-none">+</span>
                    </div>
                    <span className="text-[13px] text-gray-500 font-medium">Crear Nuevo Banco</span>
                  </div>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="text-[11px] text-[#8E8E93] dark:text-gray-400 font-medium pl-0.5">Tipo de Tarjeta</div>
              <div className={`flex gap-1.5 flex-wrap p-1 rounded-xl transition-colors ${showValidation && !type ? 'ring-1 ring-red-500/50 bg-red-50 dark:bg-red-950/20' : ''}`}>
                {['Gold', 'Platinum', 'Black', 'Classic'].map(t => (
                  <div
                    key={t}
                    className={`px-3 py-1.5 rounded-full border bg-white dark:bg-surface-card text-[11px] font-medium cursor-pointer transition-colors ${type === t ? 'border-[#6d28d9] dark:border-[#6d28d9] bg-[#EEEDFE] dark:bg-brand-primary/20 text-[#6d28d9] dark:text-white' : 'border-[#E5E5EA] dark:border-border-subtle text-[#636366] dark:text-gray-400'}`}
                    onClick={() => setType(t)}
                  >
                    {t}
                  </div>
                ))}
              </div>
              {showValidation && !type && (
                <span className="text-[10px] text-red-500 font-medium ml-0.5">Campo obligatorio</span>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="text-[11px] text-[#8E8E93] dark:text-gray-400 font-medium pl-0.5">Emisor</div>
              <div className={`flex gap-2 p-1 rounded-xl transition-colors ${showValidation && !issuer ? 'ring-1 ring-red-500/50 bg-red-50 dark:bg-red-950/20' : ''}`}>
                  <div
                    className={`flex-1 h-[60px] rounded-xl border-[1.5px] bg-white dark:bg-surface-card flex flex-col items-center justify-center cursor-pointer transition-colors ${issuer === 'visa' ? 'border-[#6d28d9] dark:border-[#6d28d9] bg-[#EEEDFE] dark:bg-brand-primary/20' : 'border-[#E5E5EA] dark:border-border-subtle'}`}
                    onClick={() => setIssuer('visa')}
                  >
                    <span className={`text-[24px] font-bold tracking-[0.05em] ${issuer === 'visa' ? 'text-[#6d28d9] dark:text-white' : 'text-[#8E8E93]'}`}>VISA</span>
                  </div>
                  <div
                    className={`flex-1 h-[60px] rounded-xl border-[1.5px] bg-white dark:bg-surface-card flex flex-col items-center justify-center cursor-pointer transition-colors ${issuer === 'mastercard' ? 'border-[#6d28d9] dark:border-[#6d28d9] bg-[#EEEDFE] dark:bg-brand-primary/20' : 'border-[#E5E5EA] dark:border-border-subtle'}`}
                    onClick={() => setIssuer('mastercard')}
                  >
                    <div className="flex">
                      <div className="w-[22px] h-[22px] rounded-full bg-[#EB001B]"></div>
                      <div className="w-[22px] h-[22px] rounded-full bg-[#F79E1B] -ml-2"></div>
                    </div>
                  </div>
                  <div
                    className={`flex-1 h-[60px] rounded-xl border-[1.5px] bg-white dark:bg-surface-card flex flex-col items-center justify-center cursor-pointer transition-colors ${issuer === 'amex' ? 'border-[#6d28d9] dark:border-[#6d28d9] bg-[#EEEDFE] dark:bg-brand-primary/20' : 'border-[#E5E5EA] dark:border-border-subtle'}`}
                    onClick={() => setIssuer('amex')}
                  >
                    <div className="flex flex-col items-center justify-center">
                      <span className={`font-black text-[12px] leading-[11px] tracking-tight ${issuer === 'amex' ? 'text-[#006FCF] dark:text-[#2684FF]' : 'text-[#8E8E93] dark:text-gray-500'}`}>AMERICAN</span>
                      <span className={`font-black text-[12px] leading-[11px] tracking-tight ${issuer === 'amex' ? 'text-[#006FCF] dark:text-[#2684FF]' : 'text-[#8E8E93] dark:text-gray-500'}`}>EXPRESS</span>
                    </div>
                  </div>
              </div>
              {showValidation && !issuer && (
                <span className="text-[10px] text-red-500 font-medium ml-0.5">Campo obligatorio</span>
              )}
            </div>
          </div>
        </div>

        {/* Bloque B: Límites y alertas */}
        <div className="p-4 border-b border-[#E5E5EA] dark:border-border-subtle">
          <div className="flex items-center gap-2.5 mb-3.5">
            <div>
              <div className="text-[14px] font-bold text-foreground">Límites y alertas</div>
              <div className="text-[11px] text-default-500 mt-[2px]">Configuración del entrenador</div>
            </div>
          </div>
          <div className="flex flex-col gap-2.5">
            <div className="flex flex-col gap-1.5">
              <div className="text-[11px] text-[#8E8E93] dark:text-gray-400 font-medium pl-0.5">Cupo total</div>
              <input
                type="text"
                maxLength={11}
                className={`bg-[#F2F2F7] dark:bg-surface-card rounded-xl px-3 py-2.5 text-[#1C1C1E] dark:text-white border outline-none w-full transition-colors focus:bg-white dark:focus:bg-surface-card focus:border-[#6d28d9] dark:focus:border-[#6d28d9] ${showValidation && !total_limit ? 'border-red-500 ring-1 ring-red-500/20' : total_limit ? 'bg-white dark:bg-surface-card border-[#E5E5EA] dark:border-[#6d28d9]/50' : 'border-[#E5E5EA] dark:border-border-subtle'}`}
                value={total_limit}
                onChange={e => {
                  const raw = e.target.value.replace(/\D/g, '');
                  if (raw.length <= 9) settotal_limit(formatCurrency(e.target.value));
                }}
                placeholder="Ej: 1.000.000"
                style={{ fontSize: '16px', fontWeight: 600, textAlign: 'center' }}
              />
              {showValidation && !total_limit && (
                <span className="text-[10px] text-red-500 font-medium ml-0.5">Campo obligatorio</span>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="text-[11px] text-[#8E8E93] dark:text-gray-400 font-medium pl-0.5">Umbral de salud crediticia</div>
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[12px] text-[#1C1C1E] dark:text-white font-semibold">{threshold}%</span>
                  <div className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${healthClass}`}>
                    <Icon size={10} /> {healthLabel}
                  </div>
                </div>
                <div className="relative flex items-center py-2">
                  <div className="absolute left-0 w-full h-1.5 rounded-full overflow-hidden bg-[#E5E5EA] dark:bg-surface-raised">
                    <div className="h-full bg-brand-primary pointer-events-none transition-all duration-200" style={{ width: `calc(((100% - 16px) * ${(threshold - 10) / 90}) + 8px)` }}></div>
                  </div>
                  <input
                    type="range"
                    min="10" max="100" step="5"
                    value={threshold}
                    onChange={e => setThreshold(Number(e.target.value))}
                    className="absolute w-full h-1.5 appearance-none bg-transparent cursor-pointer outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-brand-primary [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow-md"
                  />
                </div>
                <div className="relative h-4 mt-1">
                  {[10, 30, 50, 70, 100].map(val => {
                    const left = ((val - 10) / 90) * 100;
                    return (
                      <span key={val} className="absolute text-[10px] text-[#8E8E93] dark:text-gray-500"
                            style={{
                              left: `${left}%`,
                              transform: left === 0 ? 'translateX(0)' : left === 100 ? 'translateX(-100%)' : 'translateX(-50%)'
                            }}>
                        {val}%
                      </span>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <div className="text-[11px] text-[#8E8E93] dark:text-gray-400 font-medium pl-0.5">Costo de mantención</div>
                <input
                  type="text"
                  maxLength={9}
                  className={`bg-[#F2F2F7] dark:bg-surface-card rounded-xl px-3 py-2.5 text-[13px] text-[#1C1C1E] dark:text-white border outline-none w-full transition-colors focus:bg-white dark:focus:bg-surface-card focus:border-[#6d28d9] dark:focus:border-[#6d28d9] ${showValidation && !maintenance ? 'border-red-500 ring-1 ring-red-500/20' : maintenance ? 'bg-white dark:bg-surface-card border-[#E5E5EA] dark:border-[#6d28d9]/50' : 'border-[#E5E5EA] dark:border-border-subtle'}`}
                  value={maintenance}
                  onChange={e => {
                    if (maintenance_currency === 'uf') {
                      const sanitized = e.target.value.replace(/[^0-9.,]/g, '');
                      setMaintenance(sanitized);
                    } else {
                      const raw = e.target.value.replace(/\D/g, '');
                      if (raw.length <= 7) setMaintenance(formatCurrency(e.target.value));
                    }
                  }}
                  placeholder={maintenance_currency === 'uf' ? "Ej: 0,5" : "Ej: 5.000"}
                />
                {showValidation && !maintenance && (
                  <span className="text-[10px] text-red-500 font-medium ml-0.5">Campo obligatorio</span>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="text-[11px] text-[#8E8E93] dark:text-gray-400 font-medium pl-0.5">Unidad</div>
                <div className="relative">
                  <div
                    className="bg-white dark:bg-surface-card rounded-xl px-3 py-2.5 text-[13px] text-[#1C1C1E] dark:text-white border border-[#E5E5EA] dark:border-border-subtle outline-none w-full appearance-none cursor-pointer flex justify-between items-center"
                    onClick={() => setIsUnitDropdownOpen(!isUnitDropdownOpen)}
                  >
                    <span>{maintenance_currency === 'uf' ? 'UF' : 'CLP'}</span>
                    <ChevronDown size={14} className="text-[#8E8E93] pointer-events-none" />
                  </div>
                  {isUnitDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-surface-card rounded-2xl shadow-xl border border-gray-100 dark:border-border-subtle p-2 z-50">
                      <div
                        className="p-3 hover:bg-[#F2F2F7] dark:hover:bg-surface-raised rounded-xl cursor-pointer transition-colors text-[13px] text-[#1C1C1E] dark:text-white font-medium"
                        onClick={() => { setMaintenanceCurrency('clp'); setMaintenance(''); setIsUnitDropdownOpen(false); }}
                      >
                        CLP
                      </div>
                      <div
                        className="p-3 hover:bg-[#F2F2F7] dark:hover:bg-surface-raised rounded-xl cursor-pointer transition-colors text-[13px] text-[#1C1C1E] dark:text-white font-medium"
                        onClick={() => { setMaintenanceCurrency('uf'); setMaintenance(''); setIsUnitDropdownOpen(false); }}
                      >
                        UF
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bloque C: Ciclo de facturación */}
        <div className="p-4 border-b-0">
          <div className="flex items-center gap-2.5 mb-3.5">
            <div>
              <div className="text-[14px] font-bold text-foreground">Ciclo de facturación</div>
              <div className="text-[11px] text-default-500 mt-[2px]">Para proyectar tus pagos a tiempo</div>
            </div>
          </div>
          <div className="flex flex-col gap-2.5">
            <div className="flex flex-col gap-4 w-full bg-white dark:bg-surface-card p-5 rounded-xl border border-transparent dark:border-border-subtle shadow-sm">
              <div className="grid grid-cols-2 gap-4 w-full">
                <div className="flex flex-col gap-2 items-center">
                  <label className="text-[10px] font-bold text-[#5a5a72] dark:text-[#a0a0b8] uppercase tracking-widest text-center">Día de corte</label>
                  <WheelPicker
                    items={Array.from({length: 31}, (_, i) => i + 1)}
                    value={billing_date}
                    onChange={setbilling_date}
                    format={(val) => `Día ${val}`}
                    height={130}
                    itemHeight={40}
                  />
                </div>
                <div className="flex flex-col gap-2 items-center">
                  <label className="text-[10px] font-bold text-[#5a5a72] dark:text-[#a0a0b8] uppercase tracking-widest text-center">Día de pago</label>
                  <WheelPicker
                    items={Array.from({length: 31}, (_, i) => i + 1)}
                    value={payment_date}
                    onChange={setpayment_date}
                    format={(val) => `Día ${val}`}
                    height={130}
                    itemHeight={40}
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="text-[11px] text-[#8E8E93] dark:text-gray-400 font-medium pl-0.5">Tasa de interés mensual (%)</div>
              <input
                type="text"
                maxLength={5}
                className={`bg-[#F2F2F7] dark:bg-surface-card rounded-xl px-3 py-2.5 text-[13px] text-[#1C1C1E] dark:text-white border outline-none w-full transition-colors focus:bg-white dark:focus:bg-surface-card focus:border-[#6d28d9] dark:focus:border-[#6d28d9] ${showValidation && !interest ? 'border-red-500 ring-1 ring-red-500/20' : interest ? 'bg-white dark:bg-surface-card border-[#E5E5EA] dark:border-[#6d28d9]/50' : 'border-[#E5E5EA] dark:border-border-subtle'}`}
                value={interest}
                onChange={e => handleInterestChange(e.target.value)}
                placeholder="Ej: 2,5"
              />
              {showValidation && !interest && (
                <span className="text-[10px] text-red-500 font-medium ml-0.5">Campo obligatorio</span>
              )}
            </div>
          </div>
      </div>

      {/* Advanced Options */}
      <div className="px-4 py-2 mt-2">
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

      {/* Save Button */}
      <div className="px-4 pt-4 pb-20">
        <button
          onClick={handleSave}
          disabled={isSubmitting}
          className={`w-full py-4 bg-brand-primary text-white rounded-xl font-bold shadow-lg shadow-[#6d28d9]/30 hover:opacity-90 transition-all flex items-center justify-center gap-2 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {isSubmitting ? 'Guardando...' : 'Guardar Tarjeta'}
        </button>
      </div>

      </div>
    </div>
  );
}
