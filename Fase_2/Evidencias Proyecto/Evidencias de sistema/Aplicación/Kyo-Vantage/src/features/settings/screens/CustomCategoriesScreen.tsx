import { useAuth } from '@/features/auth/components/AuthProvider';
import { budgetQueryKeys } from '@/features/budget/model/queryKeys';
import { queryKeys } from '@/lib/queryKeys';
import { PageHeader } from "@/shared/ui/PageHeader";
import { Button } from "@heroui/react";
import { Plus, Tag, Trash2, Edit2, ShoppingCart, Coffee, Home, Car, Zap, Heart, Gift, Briefcase, GraduationCap, Monitor, Music, Plane, Dumbbell, Wine, Baby, Gamepad2, Wrench } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { CustomCategory, getUserCustomCategories, deleteUserCustomCategory } from "@/features/settings/api/customEntitiesRepository";
import { useNavigate } from 'react-router-dom';
import { DeleteConfirmModal } from '@/features/settings/components/DeleteConfirmModal';
import { usePrivateMutation } from "@/features/app-shell/hooks/usePrivateMutation";
import { CategoryCreationModal } from '@/features/budget/components/CategorySelect';

export default function CustomCategoriesPage() {
  const navigate = useNavigate();
  const { auth } = useAuth();
  const { runMutation } = usePrivateMutation([budgetQueryKeys.all(auth.id), queryKeys.budget.categories()]);
  const [categories, setCategories] = useState<CustomCategory[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [categoryToDelete, setCategoryToDelete] = useState<CustomCategory | null>(null);
  const [creatingCategory,setCreatingCategory]=useState(false);

  const loadData = useCallback(async () => {
    try {
      const data = await getUserCustomCategories();
      setCategories(data);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar las categorías.');
    } finally {
      setLoading(false);
    }
  }, []);

  const iconMap: Record<string, any> = {
    Tag, ShoppingCart, Coffee, Home, Car, Zap, Heart, Gift, Briefcase, GraduationCap, Monitor, Music, Plane, Dumbbell, Wine, Baby, Gamepad2, Wrench
  };

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const confirmDelete = async () => {
    if (!categoryToDelete) return;
    try {
      await runMutation(() => deleteUserCustomCategory(categoryToDelete.id));
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar la categoría.');
    }
    setCategoryToDelete(null);
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in pb-20">
      <div className="hidden md:flex justify-between items-center w-full">
        <PageHeader title="Categorías Personalizadas" showBack backUrl="/settings" />
      </div>


      <div className="flex flex-col gap-6">
        {/* Banner Ilustrativo */}
        <div className="bg-gradient-to-br from-[#f5a524] to-[#c4841d] rounded-3xl p-6 text-white shadow-lg shadow-[#f5a524]/20 relative overflow-hidden flex flex-col items-center justify-center text-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center mb-2">
            <Tag size={32} />
          </div>

          <p className="text-white/80 text-sm max-w-[280px]">
            Clasifica tus finanzas de la forma que mejor se adapte a tu estilo de vida.
          </p>
        </div>

        {error && <p role="alert" className="text-danger">{error}</p>}
        {loading ? (
          <div className="text-center py-20 text-[#5a5a72]">Cargando categorías...</div>
        ) : (
          <>
            <div className="flex justify-between items-center bg-default-50 dark:bg-surface-card p-4 rounded-2xl border border-transparent dark:border-border-subtle">
              <div className="flex items-center gap-2">
                <Tag size={18} className="text-[#6d28d9]" />
                <span className="font-bold text-foreground">Categorías</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-foreground">{categories.length} / 8</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {categories.map(cat => {
                const IconComponent = iconMap[cat.icon_name] || Tag;
                return (
                  <div key={cat.id} className="bg-white dark:bg-surface-card border border-transparent dark:border-border-subtle rounded-3xl p-5 shadow-sm flex items-center justify-between group transition-colors hover:border-[#6d28d9]">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-sm" style={{ backgroundColor: '#a0a0b820', color: '#a0a0b8' }}>
                        <IconComponent size={24} strokeWidth={2.5} />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-[15px] text-foreground">{cat.name}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider w-fit mt-1 ${cat.type === 'income' ? 'bg-[#17c964]/10 text-[#17c964]' : 'bg-[#f31260]/10 text-[#f31260]'}`}>
                          {cat.type === 'income' ? 'Ingreso' : 'Gasto'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => navigate(`/settings/custom-categories/form?id=${cat.id}`)}
                        className="p-2 text-default-400 hover:text-[#006FEE] hover:bg-default-100 dark:hover:bg-surface-card rounded-full transition-colors"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => setCategoryToDelete(cat)}
                        className="p-2 text-default-400 hover:text-danger hover:bg-default-100 dark:hover:bg-surface-card rounded-full transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}



              {categories.length < 8 && (
                <button type="button"
                  onClick={() => setCreatingCategory(true)}
                  className="flex flex-col items-center justify-center h-full min-h-28 rounded-3xl border-2 border-dashed border-default-200 dark:border-border-subtle hover:bg-default-50 dark:hover:bg-surface-card cursor-pointer transition-colors group w-full"
                >
                  <Plus size={24} className="text-foreground mb-2 group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-bold text-foreground">Añadir Categoría</span>
                </button>
              )}
            </div>

            <DeleteConfirmModal
              isOpen={!!categoryToDelete}
              onClose={() => setCategoryToDelete(null)}
              onConfirm={confirmDelete}
              title="¿Eliminar Categoría?"
              description={
                <>
                  Estás a punto de eliminar la categoría <strong>{categoryToDelete?.name}</strong>. Solo se pueden eliminar categorías sin movimientos, presupuestos ni compromisos asociados.
                </>
              }
            />
          </>
        )}
      </div>
      {creatingCategory && <CategoryCreationModal onClose={()=>setCreatingCategory(false)} onCreated={()=>{setCreatingCategory(false);void loadData();}}/>}
    </div>
  );
}
