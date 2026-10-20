import { useState, useRef, useEffect } from "react";
import { useNavigate } from 'react-router-dom';
import { Bank } from "@/types";
import { usePrivateMutation } from "@/features/app-shell/hooks/usePrivateMutation";
import { addAccount } from "@/features/wallet/api/accountRepository";
import { Input, Button, Form, TextField, Label, Description, Select, ListBox, Spinner, FieldError } from "@heroui/react";
import { Landmark, Eye, PiggyBank, ChevronDown } from "lucide-react";

interface AccountFormProps {
  banks: Bank[];
}

export function AccountForm({ banks }: AccountFormProps) {
  const navigate = useNavigate();
  const { runMutation } = usePrivateMutation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [accountType, setAccountType] = useState('corriente');
  const [selectedBank, setSelectedBank] = useState<string>('');
  const [accountName, setAccountName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [balance, setBalance] = useState('');
  const [lastDigits, setLastDigits] = useState('');
  const [overdraftLimit, setOverdraftLimit] = useState('');
  const [isBankOpen, setIsBankOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (errorMsg) errorRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [errorMsg]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsBankOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!selectedBank || !accountName.trim() || !balance) {
      setErrorMsg('Completa banco o institución, nombre y saldo inicial. Puedes escribir 0 como saldo.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    // Auto-calculate include_in_total based on account type
    const includeInTotal = accountType !== 'ahorro';
    const parsedBalance = parseInt(balance.replace(/\D/g, ''), 10) || 0;
    const parsedOverdraft = parseInt(overdraftLimit.replace(/\D/g, ''), 10) || 0;
    const finalColor = banks.find(b => b.id === selectedBank)?.color || '#534AB7';

    try {
      await runMutation(() => addAccount({
        bank_id: selectedBank === 'none' ? null : selectedBank,
        name: accountName.trim(),
        type: accountType,
        balance: parsedBalance,
        color: finalColor,
        last_digits: lastDigits || undefined,
        include_in_total: includeInTotal,
        overdraft_limit: accountType === 'corriente' ? parsedOverdraft : 0
      }));
      navigate('/wallet');
    } catch (error: unknown) {
      console.error("Error adding account:", error);
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('Staging no tiene plantillas')) {
        setErrorMsg(message);
      } else if (message.includes('Ya existe una cuenta activa')) {
        setErrorMsg('Ya tienes una cuenta activa con este nombre. Elige otro para evitar confusiones.');
      } else {
        setErrorMsg(message || 'No se pudo crear la cuenta. Intenta nuevamente.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedBankObj = banks.find(b => b.id === selectedBank);

  return (
    <Form onSubmit={handleSave} validationBehavior="native"
      onInvalidCapture={() => setErrorMsg('Revisa los campos obligatorios: banco o institución, nombre y saldo inicial. Puedes escribir 0 como saldo.')}
      className="flex flex-col gap-6 max-w-lg mx-auto w-full pb-24">
      {errorMsg && (
        <div ref={errorRef} role="alert" className="p-4 bg-danger/10 border border-danger/20 rounded-xl text-danger font-medium text-sm animate-in fade-in">
          {errorMsg}
        </div>
      )}

      {/* Selector de Tipo de Cuenta */}
      <div className="flex flex-col gap-2 w-full">
        <Label className="text-[10px] font-bold text-[#5a5a72] dark:text-[#a0a0b8] uppercase tracking-widest mb-1">Tipo de Cuenta</Label>
        <div className="grid grid-cols-2 gap-3">
          {[
            { id: 'corriente', label: 'Cuenta corriente', desc: 'Líquido con sobregiro', icon: Landmark },
            { id: 'vista', label: 'Cuenta vista', desc: 'Solo saldo disponible', icon: Eye },
            { id: 'ahorro', label: 'Ahorro', desc: 'Solo para guardar', icon: PiggyBank }
          ].map((type, idx) => {
            const isSelected = accountType === type.id;
            return (
              <button
                key={type.id}
                type="button"
                onClick={() => setAccountType(type.id)}
                className={`flex flex-col items-center justify-center text-center p-3 rounded-xl border transition-colors ${
                  idx === 2 ? 'col-span-2' : ''
                } ${
                  isSelected
                    ? 'border-kyo-purple bg-kyo-purple/10'
                    : 'border-border-subtle bg-transparent hover:bg-kyo-card/50'
                }`}
              >
                <type.icon size={20} className={`mb-2 ${isSelected ? 'text-kyo-lightPurple' : 'text-[#5a5a72] dark:text-[#a0a0b8]'}`} />
                <span className={`text-sm font-semibold mb-1 ${isSelected ? 'text-kyo-lightPurple' : 'text-[#5a5a72] dark:text-[#a0a0b8]'}`}>
                  {type.label}
                </span>
                <span className={`text-[10px] leading-tight ${isSelected ? 'text-kyo-lightPurple/80' : 'text-[#5a5a72] dark:text-[#a0a0b8]'}`}>
                  {type.desc}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <Select
        isRequired
        className="w-full flex flex-col gap-2"
        placeholder="Selecciona dónde guardarás el dinero"
        selectedKey={selectedBank ? selectedBank : null}
        onSelectionChange={(key) => {
          if (key) setSelectedBank(key.toString());
        }}
      >
        <Label className="text-[10px] font-bold text-[#5a5a72] dark:text-[#a0a0b8] uppercase tracking-widest">Banco / Institución</Label>
        <Select.Trigger className="bg-white dark:bg-surface-card hover:bg-default-100 dark:hover:bg-surface-card transition-colors p-3 rounded-xl border border-transparent dark:border-border-subtle w-full">
          <Select.Value>
            {({ selectedText }) => {
              const b = banks.find(b => b.id === selectedBank);
              return selectedBank === 'none' ? (
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full border-2 border-default-400"></div>
                  <span className="text-sm font-medium">Sin Banco</span>
                </div>
              ) : b ? (
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full shadow-sm" style={{ backgroundColor: b.color }}></div>
                  <span className="text-sm font-medium">{b.name}</span>
                </div>
              ) : (
                <span className="text-[#5a5a72] dark:text-[#a0a0b8] text-sm">{selectedText || 'Selecciona dónde guardarás el dinero'}</span>
              );
            }}
          </Select.Value>
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover className="bg-white dark:bg-surface-card shadow-xl rounded-xl">
          <ListBox className="p-1 flex flex-col gap-1">
            <ListBox.Item key="none" id="none" textValue="Sin Banco" className="flex items-center gap-3 p-2 hover:bg-default-100 dark:hover:bg-surface-card rounded-lg cursor-pointer">
              Sin Banco
            </ListBox.Item>
            {banks.map(bank => (
              <ListBox.Item key={bank.id} id={bank.id} textValue={bank.name} className="flex items-center gap-3 p-2 hover:bg-default-100 dark:hover:bg-surface-card rounded-lg cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full shadow-sm" style={{ backgroundColor: bank.color }}></div>
                  <span className="text-sm font-medium">{bank.name}</span>
                </div>
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
        <FieldError />
      </Select>

      <TextField
        isRequired
        className="w-full flex flex-col gap-2"
        value={accountName}
        onChange={setAccountName}
      >
        <Label className="text-[10px] font-bold text-[#5a5a72] dark:text-[#a0a0b8] uppercase tracking-widest">Nombre de la Cuenta</Label>
        <Input maxLength={50} placeholder="Ej: BCI Cuenta Corriente" className="bg-white dark:bg-surface-card hover:bg-default-100 dark:hover:bg-surface-card p-3 rounded-xl w-full outline-none transition-colors border border-transparent dark:border-border-subtle" />
        <Description className="text-xs text-[#5a5a72] dark:text-[#a0a0b8]">Dale un nombre descriptivo para reconocerla fácilmente.</Description>
        <FieldError />
      </TextField>

      <TextField
        className="w-full flex flex-col gap-2"
        value={lastDigits}
        onChange={(val) => setLastDigits(val.replace(/\D/g, ''))}
        maxLength={4}
      >
        <Label className="text-[10px] font-bold text-[#5a5a72] dark:text-[#a0a0b8] uppercase tracking-widest">Últimos 4 dígitos</Label>
        <Input placeholder="Ej: 4821" className="bg-white dark:bg-surface-card hover:bg-default-100 dark:hover:bg-surface-card p-3 rounded-xl w-full outline-none transition-colors border border-transparent dark:border-border-subtle" />
        <Description className="text-xs text-[#5a5a72] dark:text-[#a0a0b8]">Opcional. Muy útil si tienes varias tarjetas del mismo banco.</Description>
      </TextField>

      <TextField
        isRequired
        className="w-full flex flex-col gap-2"
        value={balance}
        onChange={(val) => {
          const raw = val.replace(/\D/g, '');
          const num = parseInt(raw, 10);
          if (!isNaN(num) && num > 999999999) return;
          setBalance(isNaN(num) ? '' : num.toLocaleString('es-CL'));
        }}
      >
        <Label className="text-[10px] font-bold text-[#5a5a72] dark:text-[#a0a0b8] uppercase tracking-widest">Saldo Inicial</Label>
        <div className="bg-white dark:bg-surface-card hover:bg-default-100 dark:hover:bg-surface-card p-3 rounded-xl w-full flex items-center gap-2 transition-colors border border-transparent dark:border-border-subtle focus-within:!border-[#6d28d9] focus-within:ring-2 focus-within:ring-[#6d28d9]/20">
          <span className="text-kyo-lightPurple font-bold">$</span>
          <Input placeholder="0" className="bg-transparent w-full outline-none focus:outline-none focus:ring-0 data-[focus-visible=true]:outline-none shadow-none" style={{boxShadow: 'none'}} />
        </div>
        <Description className="text-xs text-[#5a5a72] dark:text-[#a0a0b8]">¿Con cuánto dinero empiezas a registrar esta cuenta hoy?</Description>
        <FieldError />
      </TextField>

      {accountType === 'corriente' && (
        <TextField
          className="w-full flex flex-col gap-2"
          value={overdraftLimit}
          onChange={(val) => {
            const raw = val.replace(/\D/g, '');
            const num = parseInt(raw, 10);
            if (!isNaN(num) && num > 999999999) return;
            setOverdraftLimit(isNaN(num) ? '' : num.toLocaleString('es-CL'));
          }}
        >
          <Label className="text-[10px] font-bold text-[#5a5a72] dark:text-[#a0a0b8] uppercase tracking-widest">Límite de Sobregiro (Línea de Crédito)</Label>
          <div className="bg-white dark:bg-surface-card hover:bg-default-100 dark:hover:bg-surface-card p-3 rounded-xl w-full flex items-center gap-2 transition-colors border border-transparent dark:border-border-subtle focus-within:!border-[#6d28d9] focus-within:ring-2 focus-within:ring-[#6d28d9]/20">
            <span className="text-kyo-lightPurple font-bold">$</span>
            <Input placeholder="0" className="bg-transparent w-full outline-none focus:outline-none focus:ring-0 data-[focus-visible=true]:outline-none shadow-none" style={{boxShadow: 'none'}} />
          </div>
          <Description className="text-xs text-[#5a5a72] dark:text-[#a0a0b8]">Opcional. ¿Cuánto dinero extra te presta el banco?</Description>
        </TextField>
      )}

      <div className="pt-4 w-full">
        <Button
          type="submit"
          isDisabled={isSubmitting}
          isPending={isSubmitting}
          className="w-full font-bold bg-brand-primary text-white hover:bg-[#5b21b6] p-3 h-12 rounded-xl transition-colors disabled:opacity-50"
        >
          {({isPending}) => (
            <>
              {isPending ? <Spinner color="current" size="sm" /> : null}
              {isPending ? 'Guardando...' : 'Crear Cuenta'}
            </>
          )}
        </Button>
      </div>
    </Form>
  );
}
