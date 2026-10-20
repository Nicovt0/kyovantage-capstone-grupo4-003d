import { useState, useEffect } from "react";
import { Plus, Trash2, Edit2, Wallet, Coins, CalendarDays, ArrowUpRight, ArrowDownRight, Tag, CreditCard } from "lucide-react";
import { RecurringTemplate, Account, Category } from "@/types";
import { getRecurringTemplates, addRecurringTemplate, updateRecurringTemplate, deleteRecurringTemplate } from "@/features/settings/api/recurringRepository";
import { getAccounts } from "@/features/wallet/api/accountRepository";
import { getCategories } from "@/features/budget/api/categoryRepository";
import { getCreditCards } from "@/features/credit-cards/api/creditCardRepository";
import { Button } from "@heroui/react";
import { PageHeader } from "@/shared/ui/PageHeader";
import { useNavigate } from 'react-router-dom';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { usePrivateMutation } from '@/features/app-shell/hooks/usePrivateMutation';

interface FixedItemsManagerV3Props {
  type: 'income' | 'expense';
  title: string;
  subtitle: string;
}

export function FixedItemsManagerV3({ type, title, subtitle }: FixedItemsManagerV3Props) {
  const navigate = useNavigate();
  const { runMutation } = usePrivateMutation();
  const [dbItems, setDbItems] = useState<RecurringTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [itemToDelete, setItemToDelete] = useState<RecurringTemplate | null>(null);

  useEffect(() => {
    loadData();
  }, [type]);

  const loadData = async () => {
    try {
      const allTemplates = await getRecurringTemplates();
      setDbItems(allTemplates.filter(t => t.type === type));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    await runMutation(() => deleteRecurringTemplate(itemToDelete.id));
    await loadData();
    setItemToDelete(null);
  };

  const total = dbItems.reduce((sum, item) => sum + (item.expected_amount || 0), 0);
  const isIncome = type === 'income';

  return (
    <div className="flex flex-col gap-6 animate-in fade-in pb-20">

      <div className="hidden md:flex flex-col w-full">
        <PageHeader title={title} showBack backUrl="/settings" />
      </div>

      <div className="flex flex-col gap-6 mt-4 md:mt-0">
        {/* Banner Ilustrativo */}
        <div className={`bg-gradient-to-br ${isIncome ? 'from-[#17c964] to-[#12a150]' : 'from-[#f31260] to-[#c20e4d]'} rounded-3xl p-6 text-white shadow-lg ${isIncome ? 'shadow-[#17c964]/20' : 'shadow-[#f31260]/20'} relative overflow-hidden flex flex-col items-center justify-center text-center gap-3`}>
          <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center mb-2">
            {isIncome ? <Wallet size={32} /> : <Coins size={32} />}
          </div>
          <p className="text-white/80 text-sm max-w-[280px]">
            {isIncome
              ? 'Administra tus sueldos y entradas fijas de dinero mensual.'
              : 'Controla tus arriendos, suscripciones y cuentas fijas.'}
          </p>
        </div>

      {loading ? (
        <div className="flex justify-center py-20 text-[#5a5a72] dark:text-[#a0a0b8]">Cargando...</div>
      ) : (
        <div className="flex flex-col gap-4">

          {/* Tarjeta de Resumen */}
          <div className={`bg-white dark:bg-surface-card border border-transparent rounded-3xl p-6 shadow-sm flex flex-col gap-2 relative overflow-hidden ${isIncome ? 'dark:border-[#17c964]/30' : 'dark:border-[#f31260]/30'}`}>
             <div className={`absolute -right-10 -top-10 w-40 h-40 blur-3xl opacity-20 pointer-events-none rounded-full ${isIncome ? 'bg-[#17c964]' : 'bg-[#f31260]'}`} />
             <span className="text-xs font-bold uppercase tracking-widest text-[#5a5a72] dark:text-[#a0a0b8] relative z-10">Total Mensual Estimado</span>
             <span className={`text-4xl font-black relative z-10 ${isIncome ? 'text-[#17c964]' : 'text-[#f31260]'}`}>
               ${total.toLocaleString('es-CL')}
             </span>
          </div>

          {/* Header de la lista */}
          <div className="flex justify-between items-center bg-default-50 dark:bg-surface-card p-4 rounded-2xl border border-transparent dark:border-border-subtle">
            <div className="flex items-center gap-2">
              {isIncome ? <Wallet size={18} className="text-[#17c964]" /> : <Coins size={18} className="text-[#f31260]" />}
              <span className="font-bold text-foreground">{isIncome ? 'Ingresos' : 'Gastos'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-foreground">{dbItems.length} / 5</span>
            </div>
          </div>

          {/* Lista de Items (Grid 2 columnas) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {dbItems.map(item => (
              <div key={item.id} className="bg-white dark:bg-surface-card border border-transparent dark:border-border-subtle rounded-3xl p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row justify-between gap-2 sm:gap-4 group transition-colors hover:border-[#6d28d9]">

                {/* Izquierda: Icono y Textos */}
                <div className="flex items-center gap-4 overflow-hidden">
                  <div className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${isIncome ? 'bg-[#17c964]/10 text-[#17c964]' : 'bg-[#f31260]/10 text-[#f31260]'}`}>
                    {isIncome ? <ArrowUpRight size={24} strokeWidth={3} /> : <ArrowDownRight size={24} strokeWidth={3} />}
                  </div>
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="font-bold text-[15px] text-foreground truncate">{item.name}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs font-bold text-[#5a5a72] dark:text-[#a0a0b8] flex items-center gap-1 shrink-0">
                        <CalendarDays size={12} /> Día {item.day_of_month || '??'}
                      </span>
                      {item.is_essential === false && (
                        <span className="text-[10px] bg-default-100 dark:bg-surface-raised text-[#5a5a72] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider shrink-0">
                          Opcional
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Derecha: Monto y Acciones */}
                <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto pl-16 sm:pl-0">
                   <span className={`font-black text-lg ${isIncome ? 'text-[#17c964]' : 'text-foreground'}`}>
                     ${(item.expected_amount || 0).toLocaleString('es-CL')}
                   </span>
                   <div className="flex gap-2 sm:gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                     <Button size="sm" isIconOnly className="bg-default-100 dark:bg-surface-card text-[#5a5a72] hover:text-foreground" onPress={() => navigate(`/settings/recurring-items/form?id=${item.id}&type=${type}`)}>
                       <Edit2 size={16} />
                     </Button>
                     <Button size="sm" isIconOnly className="bg-danger/10 text-danger hover:bg-danger/20" onPress={() => setItemToDelete(item)}>
                       <Trash2 size={16} />
                     </Button>
                   </div>
                </div>
              </div>
            ))}

            {dbItems.length < 5 && (
              <div
                onClick={() => navigate(`/settings/recurring-items/form?type=${type}`)}
                className="flex flex-col items-center justify-center h-full min-h-28 rounded-3xl border-2 border-dashed border-default-200 dark:border-border-subtle hover:bg-default-50 dark:hover:bg-surface-card cursor-pointer transition-colors group w-full"
              >
                <Plus size={24} className="text-foreground mb-2 group-hover:scale-110 transition-transform" />
                <span className="text-sm font-bold text-foreground">Añadir {isIncome ? 'Ingreso Fijo' : 'Gasto Fijo'}</span>
              </div>
            )}
          </div>
        </div>
      )}

      <DeleteConfirmModal
        isOpen={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        onConfirm={confirmDelete}
        title={`¿Eliminar ${isIncome ? 'Ingreso' : 'Gasto'} Fijo?`}
        description={
          <>
            Estás a punto de eliminar <strong>{itemToDelete?.name}</strong>. Esta acción no se puede deshacer.
          </>
        }
      />
      </div>
    </div>
  );
}
