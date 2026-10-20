import { Suspense, useState, useEffect } from "react";
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader } from "@/shared/ui/PageHeader";
import { Landmark, Zap, Save } from "lucide-react";
import { CustomBank, getUserCustomBanks, addUserCustomBank, updateUserCustomBank } from "@/features/settings/api/customEntitiesRepository";
import { Button, ColorPicker, ColorArea, ColorSlider, ColorSwatch, Label, Spinner } from "@heroui/react";
import { usePrivateMutation } from '@/features/app-shell/hooks/usePrivateMutation';

function BankFormContent() {
  const navigate = useNavigate();
  const { runMutation } = usePrivateMutation();
  const [searchParams] = useSearchParams();
  const id = searchParams.get('id');

  const [isLoading, setIsLoading] = useState(!!id);
  const [initialData, setInitialData] = useState<CustomBank | null>(null);

  const [name, setName] = useState('');
  const [selectedColor, setSelectedColor] = useState('#006FEE');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showValidation, setShowValidation] = useState(false);

  useEffect(() => {
    if (id) {
      loadBank(id);
    }
  }, [id]);

  const loadBank = async (bankId: string) => {
    try {
      const banks = await getUserCustomBanks();
      const found = banks.find(b => b.id === bankId);
      if (found) {
        setInitialData(found);
        setName(found.name);
        setSelectedColor(found.color);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    setShowValidation(true);
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      if (id && initialData) {
        await runMutation(() => updateUserCustomBank(id, { name, color: selectedColor }));
      } else {
        await runMutation(() => addUserCustomBank(name, selectedColor));
      }
      navigate('/settings/custom-banks');
    } catch (e) {
      console.error(e);
      alert('Error guardando el banco.');
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

  return (
    <div className="flex flex-col gap-6 animate-in fade-in pb-20">

      <div className="flex flex-col w-full">
        <PageHeader
          title={`${id ? 'Editar' : 'Nuevo'} Banco`}
          showBack
        /></div>

      <div className="md:hidden flex items-center gap-3">
        <button onClick={() => navigate('/settings/custom-banks')} className="p-2 -ml-2 rounded-xl text-[#5a5a72] hover:bg-default-100 dark:hover:bg-surface-card">
          <Zap size={24} className="rotate-180" />
        </button>
        <h1 className="text-2xl font-black text-foreground">{id ? 'Editar Banco' : 'Nuevo Banco'}</h1>
      </div>

      <div className="flex flex-col gap-6 max-w-lg mx-auto w-full">

        {/* Nombre */}
        <div className="flex flex-col gap-2 w-full">
          <label className="text-[10px] font-bold text-[#5a5a72] dark:text-[#a0a0b8] uppercase tracking-widest ml-1">Nombre de la Institución</label>
          <div className={`flex items-center gap-3 bg-white dark:bg-surface-card hover:bg-default-100 dark:hover:bg-surface-card p-3.5 rounded-xl border transition-colors shadow-sm ${showValidation && !name ? 'border-danger' : 'border-transparent dark:border-border-subtle focus-within:border-[#6d28d9]'}`}>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ej: Banco de Chile"
              maxLength={30}
              className="bg-transparent border-none outline-none w-full font-bold text-foreground"
            />
          </div>
          {showValidation && !name && <span className="text-[10px] text-danger font-medium ml-1">Campo obligatorio</span>}
        </div>

        {/* Color */}
        <div className="flex flex-col gap-2 w-full">
          <label className="text-[10px] font-bold text-[#5a5a72] dark:text-[#a0a0b8] uppercase tracking-widest ml-1">Color Corporativo</label>
          <div className="bg-white dark:bg-surface-card border border-transparent dark:border-border-subtle rounded-xl overflow-hidden shadow-sm flex flex-col p-4 gap-3">
             <span className="text-sm font-semibold text-foreground">Color Principal</span>
             <ColorPicker value={selectedColor} onChange={(color) => setSelectedColor(color.toString('hex'))} defaultValue="#6d28d9">
               <ColorPicker.Trigger aria-label="Seleccionar Color">
                 <div className="flex items-center gap-3 cursor-pointer">
                   <ColorSwatch size="lg" />
                   <span className="text-sm text-[#5a5a72] font-medium uppercase">{typeof selectedColor === 'string' ? selectedColor : (selectedColor as any).toString('hex')}</span>
                 </div>
               </ColorPicker.Trigger>
               <ColorPicker.Popover className="bg-default-50 dark:bg-surface-card border border-transparent dark:border-border-subtle rounded-xl p-3 z-[100]">
                 <ColorArea
                   aria-label="Color area"
                   className="max-w-full"
                   colorSpace="hsb"
                   xChannel="saturation"
                   yChannel="brightness"
                 >
                   <ColorArea.Thumb />
                 </ColorArea>
                 <ColorSlider channel="hue" className="gap-1 px-1 mt-2" colorSpace="hsb">
                   <Label className="text-xs font-semibold text-[#5a5a72] dark:text-[#a0a0b8]">Tono</Label>
                   <ColorSlider.Output className="text-muted text-xs" />
                   <ColorSlider.Track>
                     <ColorSlider.Thumb />
                   </ColorSlider.Track>
                 </ColorSlider>
               </ColorPicker.Popover>
             </ColorPicker>
          </div>
        </div>

        <Button
          className="w-full h-14 bg-brand-primary text-white font-bold shadow-md hover:bg-[#5b21b6] mt-4 rounded-xl"
          isDisabled={isSubmitting}
          onPress={handleSubmit}
        >
          {isSubmitting ? 'Guardando...' : 'Guardar Banco'}
        </Button>

      </div>
    </div>
  );
}

export default function BankFormPage() {
  return (
    <Suspense fallback={<div className="flex justify-center p-10">Cargando formulario...</div>}>
      <BankFormContent />
    </Suspense>
  );
}
