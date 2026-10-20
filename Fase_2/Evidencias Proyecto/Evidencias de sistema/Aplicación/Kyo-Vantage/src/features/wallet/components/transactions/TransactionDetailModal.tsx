import { useState } from "react";
import { Button, Spinner } from "@heroui/react";
import { Transaction, Category, Account } from "@/types";
import { updateTransaction, deleteTransaction } from "@/features/wallet/api/transactionRepository";
import { X, Edit2, Trash2, Landmark, ShoppingCart, Target, ArrowRightLeft, ChevronDown } from "lucide-react";
import * as LucideIcons from 'lucide-react';
import { usePrivateMutation } from '@/features/app-shell/hooks/usePrivateMutation';

interface TransactionDetailModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction;
  categories: Category[];
  accounts: Account[];
}

export function TransactionDetailModal({ isOpen, onOpenChange, transaction, categories, accounts }: TransactionDetailModalProps) {
  const { runMutation } = usePrivateMutation();
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [actionError, setActionError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);

  const [name, setName] = useState(transaction.name || '');
  const [amount, setAmount] = useState(transaction.amount.toString());
  const [categoryId, setCategoryId] = useState(transaction.category_id || 'otros');
  const [accountId, setAccountId] = useState(transaction.account_id || '');
  const [destAccountId, setDestAccountId] = useState(transaction.destination_account_id || (transaction.destination_transaction_id ? accounts.find(a => a.id !== transaction.account_id)?.id || '' : ''));
  const [note, setNote] = useState(transaction.note || '');

  // Fixed date
  const dateStr = transaction.date.split('T')[0];

  if (!isOpen) return null;

  const isGrouped = (transaction as any).isGroupedTransfer;
  const isTransfer = transaction.name?.toLowerCase().includes('transferencia') || transaction.type === 'transfer' || isGrouped;
  const category = categories.find(c => c.id === transaction.category_id);
  const account = accounts.find(a => a.id === transaction.account_id);
  const IconComponent = category && !isTransfer ? ((LucideIcons as any)[category.icon_name] || ShoppingCart) : null;

  const handleSave = async () => {
    setActionError('');
    if ((transaction.agenda_payment || transaction.billing_payment)) return;
    if (!name || !amount) return;
    setIsSubmitting(true);
    try {
      const parsedAmount = parseInt(amount.replace(/\D/g, ''), 10) || 0;

      await runMutation(async () => {
        if (isTransfer && transaction.origin_transaction_id && transaction.destination_transaction_id) {
          if (!transaction.transfer_group_id) throw new Error('Esta transferencia antigua necesita revisar su vínculo antes de editarse.');
          await updateTransaction(transaction.origin_transaction_id, {
            name, amount: parsedAmount, note, account_id: accountId, destination_account_id: destAccountId,
          });
        } else {
          await updateTransaction(transaction.id, {
            name,
            amount: parsedAmount,
            category_id: categoryId,
            note,
            account_id: accountId
          });
        }
      });

      setActionError('');
      onOpenChange(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudo confirmar el cambio.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if ((transaction.agenda_payment || transaction.billing_payment)) return;
    setIsDeleting(true);
    try {
      await runMutation(() => deleteTransaction(transaction.origin_transaction_id || transaction.id));
      setActionError('');
      onOpenChange(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudo confirmar el cambio.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={(e) => e.target === e.currentTarget && onOpenChange(false)}>
      <div className="bg-white dark:bg-surface-card border border-transparent dark:border-border-subtle rounded-2xl shadow-2xl w-full max-w-[480px] max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">

        <div className="flex items-center justify-between p-4 border-b border-default-100 dark:border-border-subtle">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-medium text-foreground">
              {isEditing ? 'Editar Movimiento' : 'Detalle del Movimiento'}
            </h2>
          </div>
          <button onClick={() => onOpenChange(false)} className="text-default-400 hover:text-foreground transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex flex-col">
          {actionError && <p role="alert" className="mb-4 text-sm text-danger">{actionError}</p>}
          {!isEditing ? (
            // --- MODO LECTURA ---
            <>
              <div className="bg-default-50 dark:bg-surface-card rounded-2xl p-6 flex flex-col items-center mb-6">
                {isTransfer ? (
                  <div className="w-12 h-12 rounded-full bg-brand-primary/10 text-[#6d28d9] flex items-center justify-center mb-4">
                    <ArrowRightLeft size={24} />
                  </div>
                ) : (
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
                    style={{
                      backgroundColor: category ? '#a0a0b820' : '#F0F0F2',
                      color: '#a0a0b8'
                    }}
                  >
                    {IconComponent ? <IconComponent size={24} /> : <ShoppingCart size={24} />}
                  </div>
                )}

                <div className={`text-3xl font-light text-center mb-2 tracking-tight ${isTransfer ? 'text-foreground' : transaction.type === 'income' ? 'text-success' : 'text-danger'}`}>
                  {isTransfer ? '' : transaction.type === 'income' ? '+' : '-'}${transaction.amount.toLocaleString('es-CL')}
                </div>
                <div className="text-base font-medium text-foreground text-center">
                  {transaction.name || category?.name || 'Transacción'}
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-default-500 font-medium">Fecha</span>
                  <span className="text-foreground font-semibold">
                    {new Date(transaction.date).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                </div>

                {!isTransfer && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-default-500 font-medium">Categoría</span>
                    <span className="text-foreground font-semibold">{category?.name || 'Otros'}</span>
                  </div>
                )}

                {account && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-default-500 font-medium">Cuenta</span>
                    <span className="text-foreground font-semibold flex items-center gap-1.5">
                      <Landmark size={14} className="text-default-400" /> {account.name}
                    </span>
                  </div>
                )}

                {transaction.note && (
                  <div className="flex justify-between items-center text-sm mt-2">
                    <span className="text-default-500 font-medium">Nota</span>
                    <span className="text-default-600 font-medium">{transaction.note}</span>
                  </div>
                )}
              </div>

              {showDeleteConfirm ? (
                <div className="p-5 rounded-2xl bg-danger/10 border border-danger/20 text-center animate-in fade-in mt-8">
                  <div className="text-sm text-danger font-medium mb-4">
                    ¿Estás seguro de eliminar este movimiento por <b>${transaction.amount.toLocaleString('es-CL')}</b>?
                  </div>

                  <p className="mb-4 text-sm text-danger">El saldo se ajustará automáticamente al eliminar el movimiento.</p>

                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      onPress={() => setShowDeleteConfirm(false)}
                      className="flex-1 font-bold border-transparent rounded-2xl"
                    >
                      Cancelar
                    </Button>
                    <Button
                      className="flex-1 font-bold bg-danger text-white rounded-2xl"
                      onPress={handleDelete}
                      isDisabled={isSubmitting}
                    >
                      {isSubmitting ? <Spinner size="sm" color="current"/> : 'Sí, eliminar'}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-8">
                  {(transaction.agenda_payment || transaction.billing_payment) && <p className="mb-3 text-sm text-default-500">Pago de Agenda confirmado. Su modificación requiere una reversión contable.</p>}
                  <div className="flex gap-3">
                  <Button
                    className="flex-1 bg-default-100 dark:bg-surface-card text-foreground font-bold border-transparent rounded-2xl"
                    variant="ghost"
                    isDisabled={(transaction.agenda_payment || transaction.billing_payment)}
                    onPress={() => setIsEditing(true)}
                  >
                    <Edit2 size={16} /> Editar
                  </Button>
                  <Button
                    className="flex-1 bg-danger/10 text-danger font-bold border-transparent hover:bg-danger/20 rounded-2xl"
                    variant="ghost"
                    isDisabled={(transaction.agenda_payment || transaction.billing_payment)}
                    onPress={() => setShowDeleteConfirm(true)}
                  >
                    <Trash2 size={16} /> Eliminar
                  </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            // --- MODO EDICIÓN ---
            <div className="flex flex-col gap-4 animate-in fade-in">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-default-500">Monto</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-default-400">$</span>
                  <input
                    type="text"
                    className={`w-full p-3 pl-8 bg-default-50 dark:bg-surface-card border-none rounded-xl outline-none text-xl font-bold ${transaction.type === 'income' ? 'text-success' : 'text-danger'}`}
                    value={amount === '0' ? '' : amount}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, '');
                      setAmount(raw ? parseInt(raw, 10).toLocaleString('es-CL') : '0');
                    }}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-default-500">Nombre de la Transacción</label>
                <input
                  type="text"
                  className="w-full p-3 bg-default-50 dark:bg-surface-card border-none rounded-xl text-sm outline-none text-foreground"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              {!isTransfer && (
                <div className="flex flex-col gap-1.5 relative">
                  <label className="text-xs font-semibold text-default-500">Categoría</label>

                  <div
                    className="w-full p-3 bg-default-50 dark:bg-surface-card border-none rounded-xl text-sm outline-none text-foreground flex items-center justify-between cursor-pointer"
                    onClick={() => setIsCategoryOpen(!isCategoryOpen)}
                  >
                    <div className="flex items-center gap-3">
                      {(() => {
                        const selCat = categories.find(c => c.id === categoryId);
                        const SelIcon = selCat ? ((LucideIcons as any)[selCat.icon_name] || ShoppingCart) : ShoppingCart;
                        return (
                          <>
                            <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: selCat ? '#a0a0b820' : '#F0F0F2', color: '#a0a0b8' }}>
                              <SelIcon size={12} />
                            </div>
                            <span className="font-medium">{selCat?.name || 'Otros'}</span>
                          </>
                        );
                      })()}
                    </div>
                    <ChevronDown size={16} className={`text-default-400 transition-transform ${isCategoryOpen ? 'rotate-180' : ''}`} />
                  </div>

                  {isCategoryOpen && (
                    <div className="absolute top-[68px] left-0 right-0 bg-white dark:bg-surface-card border border-default-100 dark:border-border-subtle rounded-xl shadow-xl z-[60] max-h-48 overflow-y-auto p-2 flex flex-col gap-1">
                      {categories.filter(c => c.type === transaction.type).map(c => {
                        const CIcon = (LucideIcons as any)[c.icon_name] || ShoppingCart;
                        return (
                          <div
                            key={c.id}
                            className="flex items-center gap-3 p-2 hover:bg-default-100 dark:hover:bg-surface-card rounded-lg cursor-pointer transition-colors"
                            onClick={() => {
                              setCategoryId(c.id);
                              setIsCategoryOpen(false);
                            }}
                          >
                            <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: '#a0a0b820', color: '#a0a0b8' }}>
                              <CIcon size={12} />
                            </div>
                            <span className="font-medium text-sm text-foreground">{c.name}</span>
                          </div>
                        );
                      })}
                      <div
                        className="flex items-center gap-3 p-2 hover:bg-default-100 dark:hover:bg-surface-card rounded-lg cursor-pointer transition-colors"
                        onClick={() => {
                          setCategoryId('otros');
                          setIsCategoryOpen(false);
                        }}
                      >
                        <div className="w-6 h-6 rounded-full flex items-center justify-center bg-default-100 text-default-500">
                          <ShoppingCart size={12} />
                        </div>
                        <span className="font-medium text-sm text-foreground">Otros</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

                {isTransfer && (
                  <div className="flex flex-col gap-3 mt-2">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-default-500">Cuenta Origen</label>
                      <select
                        className="w-full p-3 bg-default-50 dark:bg-surface-card border-none rounded-xl text-sm outline-none text-foreground cursor-pointer"
                        value={accountId}
                        onChange={(e) => setAccountId(e.target.value)}
                      >
                        {accounts.filter(a => !a.is_archived).map(acc => (
                          <option key={acc.id} value={acc.id}>{acc.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-default-500">Cuenta Destino</label>
                      <select
                        className="w-full p-3 bg-default-50 dark:bg-surface-card border-none rounded-xl text-sm outline-none text-foreground cursor-pointer"
                        value={destAccountId}
                        onChange={(e) => setDestAccountId(e.target.value)}
                      >
                        <option value="">Selecciona cuenta destino...</option>
                        {accounts.filter(a => !a.is_archived && a.id !== accountId).map(acc => (
                          <option key={acc.id} value={acc.id}>{acc.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-default-500">Nota (Opcional)</label>
                <input
                  type="text"
                  className="w-full p-3 bg-default-50 dark:bg-surface-card border-none rounded-xl text-sm outline-none text-foreground"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Escribe una nota..."
                />
              </div>

              <div className="flex flex-col gap-1.5 opacity-60">
                <label className="text-xs font-semibold text-default-500">Fecha (No editable)</label>
                <input
                  type="date"
                  className="w-full p-3 bg-default-50 dark:bg-surface-card border-none rounded-xl text-sm outline-none text-foreground cursor-not-allowed"
                  value={dateStr}
                  readOnly
                />
              </div>

              <div className="flex gap-2 mt-4 pt-4 border-t border-default-100 dark:border-border-subtle">
                <Button
                  variant="ghost"
                  onPress={() => setIsEditing(false)}
                  className="flex-1 font-bold border-transparent rounded-2xl"
                >
                  Cancelar
                </Button>
                <Button
                  onPress={handleSave}
                  isDisabled={!name || !amount || isSubmitting || amount === '0'}
                  className="flex-1 bg-brand-primary text-white font-bold rounded-2xl"
                >
                  {isSubmitting ? <Spinner size="sm" color="current"/> : 'Guardar Cambios'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
