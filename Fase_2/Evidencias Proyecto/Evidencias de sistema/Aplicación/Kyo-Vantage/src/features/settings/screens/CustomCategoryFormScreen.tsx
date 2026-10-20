import { useAuth } from '@/features/auth/components/AuthProvider';
import { budgetQueryKeys } from '@/features/budget/model/queryKeys';
import { queryKeys } from '@/lib/queryKeys';
import { Suspense, useState, useEffect } from "react";
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader } from "@/shared/ui/PageHeader";
import { Tag, ShoppingCart, Coffee, Home, Car, Zap, Heart, Gift, Briefcase, GraduationCap, Monitor, Music, Plane, Dumbbell, Wine, Baby, Gamepad2, Wrench, Save } from "lucide-react";
import { CustomCategory, getUserCustomCategories, addUserCustomCategory, updateUserCustomCategory } from "@/features/settings/api/customEntitiesRepository";
import { Button, Spinner } from "@heroui/react";
import { usePrivateMutation } from '@/features/app-shell/hooks/usePrivateMutation';

const ICONS = [
  { name: 'Tag', icon: Tag },
  { name: 'ShoppingCart', icon: ShoppingCart },
  { name: 'Coffee', icon: Coffee },
  { name: 'Home', icon: Home },
  { name: 'Car', icon: Car },
  { name: 'Zap', icon: Zap },
  { name: 'Heart', icon: Heart },
  { name: 'Gift', icon: Gift },
  { name: 'Briefcase', icon: Briefcase },
  { name: 'GraduationCap', icon: GraduationCap },
  { name: 'Monitor', icon: Monitor },
  { name: 'Music', icon: Music },
  { name: 'Plane', icon: Plane },
  { name: 'Dumbbell', icon: Dumbbell },
  { name: 'Wine', icon: Wine },
  { name: 'Baby', icon: Baby },
  { name: 'Gamepad2', icon: Gamepad2 },
  { name: 'Wrench', icon: Wrench },
];

function CategoryFormContent() {
  const navigate = useNavigate();
  const { auth } = useAuth();
  const { runMutation } = usePrivateMutation([budgetQueryKeys.all(auth.id), queryKeys.budget.categories()]);
  const [searchParams] = useSearchParams();
  const id = searchParams.get('id');

  const [isLoading, setIsLoading] = useState(!!id);
  const [initialData, setInitialData] = useState<CustomCategory | null>(null);

  const [name, setName] = useState('');
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [selectedIcon, setSelectedIcon] = useState('Tag');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (id) {
      loadCategory(id);
    }
  }, [id]);

  const loadCategory = async (catId: string) => {
    try {
      const cats = await getUserCustomCategories();
      const found = cats.find(c => c.id === catId);
      if (found) {
        setInitialData(found);
        setName(found.name);
        setType(found.type);
        setSelectedIcon(found.icon_name);
      } else {
        setLoadError('No se encontró la categoría para editar.');
      }
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'No se pudo cargar la categoría.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    setShowValidation(true);
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      if (id && !initialData) throw new Error('No se encontró la categoría para editar.');
      if (id && initialData) {
        await runMutation(() => updateUserCustomCategory(id, { name, icon_name: selectedIcon }));
      } else {
        await runMutation(() => addUserCustomCategory(name, type, selectedIcon));
      }
      navigate('/settings/custom-categories');
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : 'Error guardando la categoría.');
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
          title={`${id ? 'Editar' : 'Nueva'} Categoría`}
          showBack
        /></div>

      <div className="md:hidden flex items-center gap-3">
        <button onClick={() => navigate('/settings/custom-categories')} className="p-2 -ml-2 rounded-xl text-[#5a5a72] hover:bg-default-100 dark:hover:bg-surface-card">
          <Zap size={24} className="rotate-180" /> {/* Back icon logic here is simple just using generic back shape if we want, or PageHeader has it but we just use title */}
        </button>
        <h1 className="text-2xl font-black text-foreground">{id ? 'Editar Categoría' : 'Nueva Categoría'}</h1>
      </div>

      <div className="flex flex-col gap-6 max-w-lg mx-auto w-full">
        {loadError && <p role="alert" className="text-danger">{loadError}</p>}

        {/* Tipo */}
        <div className="flex flex-col gap-2 w-full">
          <label className="text-[10px] font-bold text-[#5a5a72] dark:text-[#a0a0b8] uppercase tracking-widest ml-1">Tipo de Movimiento</label>
          <div className="grid grid-cols-2 gap-2 bg-default-50 dark:bg-surface-card p-1.5 rounded-2xl border border-transparent">
            <button
              type="button"
              disabled={!!id}
              onClick={() => setType('expense')}
              className={`py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${type === 'expense' ? 'bg-[#f31260] text-white shadow-md' : 'text-[#5a5a72] hover:text-foreground'}`}
            >
              Gasto
            </button>
            <button
              type="button"
              disabled={!!id}
              onClick={() => setType('income')}
              className={`py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${type === 'income' ? 'bg-[#17c964] text-white shadow-md' : 'text-[#5a5a72] hover:text-foreground'}`}
            >
              Ingreso
            </button>
          </div>
        </div>

        {id && <p className="text-sm text-default-500">El tipo se conserva para mantener la coherencia de los movimientos y presupuestos asociados.</p>}

        {/* Nombre */}
        <div className="flex flex-col gap-2 w-full">
          <label className="text-[10px] font-bold text-[#5a5a72] dark:text-[#a0a0b8] uppercase tracking-widest ml-1">Nombre</label>
          <div className={`flex items-center gap-3 bg-white dark:bg-surface-card hover:bg-default-100 dark:hover:bg-surface-card p-3.5 rounded-xl border transition-colors shadow-sm ${showValidation && !name ? 'border-danger' : 'border-transparent dark:border-border-subtle focus-within:border-[#6d28d9]'}`}>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ej: Viajes"
              maxLength={20}
              className="bg-transparent border-none outline-none w-full font-bold text-foreground"
            />
          </div>
          {showValidation && !name && <span className="text-[10px] text-danger font-medium ml-1">Campo obligatorio</span>}
        </div>

        {/* Icono */}
        <div className="flex flex-col gap-2 w-full">
          <label className="text-[10px] font-bold text-[#5a5a72] dark:text-[#a0a0b8] uppercase tracking-widest ml-1">Identidad Visual</label>
          <div className="bg-white dark:bg-surface-card border border-transparent dark:border-border-subtle rounded-xl overflow-hidden shadow-sm flex flex-col">

            <div className="p-4 border-b border-border-subtle/10 dark:border-border-subtle flex flex-col gap-3">
              <span className="text-sm font-semibold text-foreground">Icono de la Categoría</span>
              <div className="grid grid-cols-6 gap-2">
                 {ICONS.map(i => {
                   const isSelected = selectedIcon === i.name;
                   return (
                     <div
                       key={i.name}
                       onClick={() => setSelectedIcon(i.name)}
                       className={`aspect-square rounded-xl flex items-center justify-center cursor-pointer transition-all border ${
                         isSelected
                           ? 'border-[#6d28d9] bg-brand-primary/10 shadow-sm scale-105 z-10'
                           : 'border-transparent bg-default-50 dark:bg-surface-card text-[#5a5a72] hover:bg-default-100'
                       }`}
                       style={{
                         color: 'currentColor'
                       }}
                     >
                       <i.icon size={20} />
                     </div>
                   );
                 })}
              </div>
            </div>

          </div>
        </div>

        <Button
          className="w-full h-14 bg-brand-primary text-white font-bold shadow-md hover:bg-[#5b21b6] mt-4 rounded-xl"
          isDisabled={isSubmitting || Boolean(loadError)}
          onPress={handleSubmit}
        >
          {isSubmitting ? 'Guardando...' : 'Guardar Categoría'}
        </Button>

      </div>
    </div>
  );
}

export default function CategoryFormPage() {
  return (
    <Suspense fallback={<div className="flex justify-center p-10">Cargando formulario...</div>}>
      <CategoryFormContent />
    </Suspense>
  );
}
