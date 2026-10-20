import { PageHeader } from "@/shared/ui/PageHeader";
import { Button } from "@heroui/react";
import { Plus, Trash2, Edit2, Landmark } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { CustomBank, getUserCustomBanks, deleteUserCustomBank } from "@/features/settings/api/customEntitiesRepository";
import { useNavigate } from 'react-router-dom';
import { DeleteConfirmModal } from '@/features/settings/components/DeleteConfirmModal';
import { usePrivateMutation } from "@/features/app-shell/hooks/usePrivateMutation";

export default function CustomBanksPage() {
  const navigate = useNavigate();
  const { runMutation } = usePrivateMutation();
  const [banks, setBanks] = useState<CustomBank[]>([]);
  const [loading, setLoading] = useState(true);
  const [bankToDelete, setBankToDelete] = useState<CustomBank | null>(null);

  const loadData = useCallback(async () => {
    try {
      const data = await getUserCustomBanks();
      setBanks(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const confirmDelete = async () => {
    if (!bankToDelete) return;
    await runMutation(() => deleteUserCustomBank(bankToDelete.id));
    await loadData();
    setBankToDelete(null);
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in pb-20">
      <div className="hidden md:flex justify-between items-center w-full">
        <PageHeader title="Bancos Personalizados" showBack backUrl="/settings" />

      </div>


      <div className="flex flex-col gap-6">
        {/* Banner Ilustrativo */}
        <div className="bg-gradient-to-br from-[#006FEE] to-[#005bc4] rounded-3xl p-6 text-white shadow-lg shadow-[#006FEE]/20 relative overflow-hidden flex flex-col items-center justify-center text-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center mb-2">
            <Landmark size={32} />
          </div>

          <p className="text-white/80 text-sm max-w-[280px]">
            Agrega los bancos o instituciones donde guardas tu dinero.
          </p>
        </div>

        {loading ? (
          <div className="text-center py-20 text-[#5a5a72]">Cargando bancos...</div>
        ) : (
          <>
            <div className="flex justify-between items-center bg-default-50 dark:bg-surface-card p-4 rounded-2xl border border-transparent dark:border-border-subtle">
              <div className="flex items-center gap-2">
                <Landmark size={18} className="text-[#6d28d9]" />
                <span className="font-bold text-foreground">Bancos</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-foreground">{banks.length} / 5</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {banks.map(bank => (
                <div key={bank.id} className="bg-white dark:bg-surface-card border border-transparent dark:border-border-subtle rounded-3xl p-5 shadow-sm flex items-center justify-between group transition-colors hover:border-[#6d28d9]">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-sm" style={{ backgroundColor: `${bank.color}20`, color: bank.color }}>
                      <Landmark size={24} strokeWidth={2.5} />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-bold text-[15px] text-foreground">{bank.name}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider w-fit mt-1 bg-default-100 dark:bg-surface-raised text-[#5a5a72]">
                        Personalizado
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => navigate(`/settings/custom-banks/form?id=${bank.id}`)}
                      className="p-2 text-default-400 hover:text-[#6d28d9] hover:bg-default-100 dark:hover:bg-surface-card rounded-full transition-colors"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => setBankToDelete(bank)}
                      className="p-2 text-default-400 hover:text-danger hover:bg-default-100 dark:hover:bg-surface-card rounded-full transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}



              {banks.length < 5 && (
                <div
                  onClick={() => navigate('/settings/custom-banks/form')}
                  className="flex flex-col items-center justify-center h-full min-h-28 rounded-3xl border-2 border-dashed border-default-200 dark:border-border-subtle hover:bg-default-50 dark:hover:bg-surface-card cursor-pointer transition-colors group w-full"
                >
                  <Plus size={24} className="text-foreground mb-2 group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-bold text-foreground">Añadir Banco</span>
                </div>
              )}
            </div>

            <DeleteConfirmModal
              isOpen={!!bankToDelete}
              onClose={() => setBankToDelete(null)}
              onConfirm={confirmDelete}
              title="¿Eliminar Banco?"
              description={
                <>
                  Estás a punto de eliminar el banco <strong>{bankToDelete?.name}</strong>. Esta acción no se puede deshacer.
                </>
              }
            />
          </>
        )}
      </div>
    </div>
  );
}
