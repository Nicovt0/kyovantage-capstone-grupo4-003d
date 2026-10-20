import { useQueryClient } from '@tanstack/react-query';
import React, { useEffect, useState, useMemo } from 'react';
import {
  getAllBanksAdmin,
  createBankAdmin,
  updateBankAdmin,
  deleteBankAdmin,
  uploadBankLogoAdmin,
  getAccountTemplatesAdmin,
  createAccountTemplateAdmin,
  updateAccountTemplateAdmin,
  deleteAccountTemplateAdmin,
  getCreditCardTemplatesAdmin,
  createCreditCardTemplateAdmin,
  updateCreditCardTemplateAdmin,
  deleteCreditCardTemplateAdmin,
  CreateBankDTO,
  CreateAccountTemplateDTO,
  CreateCreditCardTemplateDTO,
} from '../api/adminRepository';
import { Bank, AccountTemplate, CreditCardTemplate } from '@/types';
import {
  Building2,
  CreditCard,
  Landmark,
  Plus,
  Edit2,
  Trash2,
  Upload,
  CheckCircle2,
  XCircle,
  Loader2,
  Search,
  Filter,
} from 'lucide-react';
import { Button } from '@heroui/react';

export default function AdminBanksAndTemplatesTab() {
  const queryClient = useQueryClient();
  const [activeSubTab, setActiveSubTab] = useState<'banks' | 'account-templates' | 'card-templates'>('banks');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Data states
  const [banks, setBanks] = useState<Bank[]>([]);
  const [accountTemplates, setAccountTemplates] = useState<AccountTemplate[]>([]);
  const [cardTemplates, setCardTemplates] = useState<CreditCardTemplate[]>([]);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBankFilter, setSelectedBankFilter] = useState<string>('all');

  // Modal states
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [editingBank, setEditingBank] = useState<Bank | null>(null);
  const [bankFormData, setBankFormData] = useState<CreateBankDTO>({
    name: '',
    primary_color: '#534AB7',
    logo_url: '',
    is_active: true,
  });

  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [editingAccountTemplate, setEditingAccountTemplate] = useState<AccountTemplate | null>(null);
  const [accountFormData, setAccountFormData] = useState<CreateAccountTemplateDTO>({
    bank_id: '',
    name: '',
    type: 'checking',
    currency: 'CLP',
    maintenance_cost: 0,
    maintenance_currency: 'CLP',
  });

  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [editingCardTemplate, setEditingCardTemplate] = useState<CreditCardTemplate | null>(null);
  const [cardFormData, setCardFormData] = useState<CreateCreditCardTemplateDTO>({
    bank_id: '',
    name: '',
    card_network: 'visa',
    default_maintenance_cost: 0,
    maintenance_currency: 'CLP',
    default_monthly_interest_rate: 0,
    default_penalty_interest_rate: 0,
  });

  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Auto-dismiss messages
  useEffect(() => {
    if (successMsg) {
      void queryClient.invalidateQueries({ queryKey: ['admin'] });
      const timer = setTimeout(() => setSuccessMsg(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMsg, queryClient]);

  // Load Data
  const loadAllData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [fetchedBanks, fetchedAccounts, fetchedCards] = await Promise.all([
        getAllBanksAdmin(),
        getAccountTemplatesAdmin(),
        getCreditCardTemplatesAdmin(),
      ]);
      setBanks(fetchedBanks);
      setAccountTemplates(fetchedAccounts);
      setCardTemplates(fetchedCards);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al cargar los datos de bancos y plantillas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAllData();
  }, []);

  // Filtered collections
  const filteredBanks = useMemo(() => {
    return banks.filter(b => b.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [banks, searchQuery]);

  const filteredAccountTemplates = useMemo(() => {
    return accountTemplates.filter(t => {
      const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesBank = selectedBankFilter === 'all' || t.bank_id === selectedBankFilter;
      return matchesSearch && matchesBank;
    });
  }, [accountTemplates, searchQuery, selectedBankFilter]);

  const filteredCardTemplates = useMemo(() => {
    return cardTemplates.filter(t => {
      const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesBank = selectedBankFilter === 'all' || t.bank_id === selectedBankFilter;
      return matchesSearch && matchesBank;
    });
  }, [cardTemplates, searchQuery, selectedBankFilter]);

  // BANK HANDLERS
  const handleOpenBankModal = (bank?: Bank) => {
    if (bank) {
      setEditingBank(bank);
      setBankFormData({
        name: bank.name,
        primary_color: bank.color || bank.primary_color || '#534AB7',
        logo_url: bank.logo_url || '',
        is_active: bank.is_active ?? true,
      });
    } else {
      setEditingBank(null);
      setBankFormData({
        name: '',
        primary_color: '#534AB7',
        logo_url: '',
        is_active: true,
      });
    }
    setIsBankModalOpen(true);
  };

  const handleLogoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    try {
      const url = await uploadBankLogoAdmin(file);
      setBankFormData(prev => ({ ...prev, logo_url: url }));
      setSuccessMsg('Logo subido exitosamente a Supabase Storage');
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al subir la imagen del logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSaveBank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankFormData.name.trim()) {
      setErrorMsg('El nombre del banco es obligatorio.');
      return;
    }

    setLoading(true);
    try {
      if (editingBank) {
        await updateBankAdmin(editingBank.id, bankFormData);
        setSuccessMsg(`Banco "${bankFormData.name}" actualizado.`);
      } else {
        await createBankAdmin(bankFormData);
        setSuccessMsg(`Banco "${bankFormData.name}" creado con éxito.`);
      }
      setIsBankModalOpen(false);
      await loadAllData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al guardar el banco.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBank = async (bank: Bank) => {
    if (!confirm(`¿Estás seguro de eliminar el banco "${bank.name}"? Esto puede afectar a las plantillas asociadas.`)) {
      return;
    }
    setLoading(true);
    try {
      await deleteBankAdmin(bank.id);
      setSuccessMsg(`Banco "${bank.name}" eliminado.`);
      await loadAllData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al eliminar el banco.');
    } finally {
      setLoading(false);
    }
  };

  // ACCOUNT TEMPLATE HANDLERS
  const handleOpenAccountModal = (tpl?: AccountTemplate) => {
    if (tpl) {
      setEditingAccountTemplate(tpl);
      setAccountFormData({
        bank_id: tpl.bank_id,
        name: tpl.name,
        type: tpl.type,
        currency: tpl.currency || 'CLP',
        maintenance_cost: tpl.maintenance_cost || 0,
        maintenance_currency: (tpl.maintenance_currency as any) || 'CLP',
      });
    } else {
      setEditingAccountTemplate(null);
      setAccountFormData({
        bank_id: banks[0]?.id || '',
        name: '',
        type: 'checking',
        currency: 'CLP',
        maintenance_cost: 0,
        maintenance_currency: 'CLP',
      });
    }
    setIsAccountModalOpen(true);
  };

  const handleSaveAccountTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountFormData.bank_id || !accountFormData.name.trim()) {
      setErrorMsg('Selecciona un banco y especifica el nombre de la plantilla.');
      return;
    }

    setLoading(true);
    try {
      if (editingAccountTemplate) {
        await updateAccountTemplateAdmin(editingAccountTemplate.id, accountFormData);
        setSuccessMsg(`Plantilla "${accountFormData.name}" actualizada.`);
      } else {
        await createAccountTemplateAdmin(accountFormData);
        setSuccessMsg(`Plantilla "${accountFormData.name}" creada.`);
      }
      setIsAccountModalOpen(false);
      await loadAllData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al guardar plantilla de cuenta.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccountTemplate = async (tpl: AccountTemplate) => {
    if (!confirm(`¿Eliminar la plantilla de cuenta "${tpl.name}"?`)) return;
    setLoading(true);
    try {
      await deleteAccountTemplateAdmin(tpl.id);
      setSuccessMsg(`Plantilla "${tpl.name}" eliminada.`);
      await loadAllData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al eliminar la plantilla.');
    } finally {
      setLoading(false);
    }
  };

  // CARD TEMPLATE HANDLERS
  const handleOpenCardModal = (tpl?: CreditCardTemplate) => {
    if (tpl) {
      setEditingCardTemplate(tpl);
      setCardFormData({
        bank_id: tpl.bank_id,
        name: tpl.name,
        card_network: tpl.card_network,
        default_maintenance_cost: tpl.default_maintenance_cost || 0,
        maintenance_currency: (tpl.maintenance_currency as any) || 'CLP',
        default_monthly_interest_rate: tpl.default_monthly_interest_rate || 0,
        default_penalty_interest_rate: tpl.default_penalty_interest_rate || 0,
      });
    } else {
      setEditingCardTemplate(null);
      setCardFormData({
        bank_id: banks[0]?.id || '',
        name: '',
        card_network: 'visa',
        default_maintenance_cost: 0,
        maintenance_currency: 'CLP',
        default_monthly_interest_rate: 0,
        default_penalty_interest_rate: 0,
      });
    }
    setIsCardModalOpen(true);
  };

  const handleSaveCardTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardFormData.bank_id || !cardFormData.name.trim()) {
      setErrorMsg('Selecciona un banco y especifica el nombre de la tarjeta.');
      return;
    }

    setLoading(true);
    try {
      if (editingCardTemplate) {
        await updateCreditCardTemplateAdmin(editingCardTemplate.id, cardFormData);
        setSuccessMsg(`Plantilla de tarjeta "${cardFormData.name}" actualizada.`);
      } else {
        await createCreditCardTemplateAdmin(cardFormData);
        setSuccessMsg(`Plantilla de tarjeta "${cardFormData.name}" creada.`);
      }
      setIsCardModalOpen(false);
      await loadAllData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al guardar plantilla de tarjeta.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCardTemplate = async (tpl: CreditCardTemplate) => {
    if (!confirm(`¿Eliminar la plantilla de tarjeta "${tpl.name}"?`)) return;
    setLoading(true);
    try {
      await deleteCreditCardTemplateAdmin(tpl.id);
      setSuccessMsg(`Plantilla de tarjeta "${tpl.name}" eliminada.`);
      await loadAllData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al eliminar la plantilla de tarjeta.');
    } finally {
      setLoading(false);
    }
  };

  const getBankNameById = (bankId: string) => {
    return banks.find(b => b.id === bankId)?.name || 'Banco Desconocido';
  };

  return (
    <div className="space-y-6">
      {/* Top action bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-surface-card p-5 rounded-2xl border border-border-subtle">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Landmark className="text-kyo-lightPurple" size={24} />
            Bancos y Plantillas Financieras
          </h2>
          <p className="text-on-surface-card-secondary text-xs mt-1">
            Gestiona el catálogo oficial de instituciones financieras y sus plantillas de cuentas y tarjetas.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeSubTab === 'banks' && (
            <Button
              onPress={() => handleOpenBankModal()}
              className="bg-brand-primary hover:bg-kyo-lightPurple/90 text-white font-semibold rounded-xl"
            >
              <Plus size={18} />
              Añadir Banco
            </Button>
          )}

          {activeSubTab === 'account-templates' && (
            <Button
              onPress={() => handleOpenAccountModal()}
              className="bg-brand-primary hover:bg-kyo-lightPurple/90 text-white font-semibold rounded-xl"
            >
              <Plus size={18} />
              Añadir Plantilla Cuenta
            </Button>
          )}

          {activeSubTab === 'card-templates' && (
            <Button
              onPress={() => handleOpenCardModal()}
              className="bg-brand-primary hover:bg-kyo-lightPurple/90 text-white font-semibold rounded-xl"
            >
              <Plus size={18} />
              Añadir Plantilla Tarjeta
            </Button>
          )}
        </div>
      </div>

      {/* Toast Alerts */}
      {errorMsg && (
        <div className="flex items-center justify-between p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-rose-700 dark:text-rose-300 text-sm">
          <div className="flex items-center gap-2">
            <XCircle size={18} className="text-red-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-foreground font-bold">×</button>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center justify-between p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-foreground font-bold">×</button>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-border-subtle pb-4">
        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          <button
            onClick={() => setActiveSubTab('banks')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition whitespace-nowrap ${
              activeSubTab === 'banks'
                ? 'bg-brand-primary text-white shadow-lg shadow-kyo-lightPurple/20'
                : 'text-on-surface-card-secondary hover:bg-surface-card hover:text-foreground'
            }`}
          >
            <Landmark size={18} />
            Catálogo de Bancos ({banks.length})
          </button>

          <button
            onClick={() => setActiveSubTab('account-templates')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition whitespace-nowrap ${
              activeSubTab === 'account-templates'
                ? 'bg-brand-primary text-white shadow-lg shadow-kyo-lightPurple/20'
                : 'text-on-surface-card-secondary hover:bg-surface-card hover:text-foreground'
            }`}
          >
            <Building2 size={18} />
            Plantillas de Cuentas ({accountTemplates.length})
          </button>

          <button
            onClick={() => setActiveSubTab('card-templates')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition whitespace-nowrap ${
              activeSubTab === 'card-templates'
                ? 'bg-brand-primary text-white shadow-lg shadow-kyo-lightPurple/20'
                : 'text-on-surface-card-secondary hover:bg-surface-card hover:text-foreground'
            }`}
          >
            <CreditCard size={18} />
            Plantillas de Tarjetas ({cardTemplates.length})
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-card-secondary" />
            <input
              type="text"
              placeholder="Buscar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-surface-card border border-border-subtle rounded-xl text-foreground text-sm focus:outline-none focus:border-kyo-lightPurple placeholder:text-on-surface-card-secondary"
            />
          </div>

          {(activeSubTab === 'account-templates' || activeSubTab === 'card-templates') && (
            <select
              value={selectedBankFilter}
              onChange={(e) => setSelectedBankFilter(e.target.value)}
              className="py-1.5 px-3 bg-surface-card border border-border-subtle rounded-xl text-foreground text-sm focus:outline-none focus:border-kyo-lightPurple"
            >
              <option value="all">Todos los Bancos</option>
              {banks.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-10 text-on-surface-card-secondary gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-kyo-lightPurple" />
          <span>Cargando datos...</span>
        </div>
      )}

      {/* TAB CONTENT: BANKS */}
      {!loading && activeSubTab === 'banks' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBanks.map((bank) => (
            <div
              key={bank.id}
              className="bg-surface-card border border-border-subtle rounded-2xl p-5 hover:border-purple-500/40 transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {bank.logo_url ? (
                      <img
                        src={bank.logo_url}
                        alt={bank.name}
                        className="w-10 h-10 object-contain rounded-xl bg-surface-raised/50 p-1 border border-border-subtle"
                      />
                    ) : (
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-foreground shadow"
                        style={{ backgroundColor: bank.color || bank.primary_color || '#534AB7' }}
                      >
                        {bank.name.substring(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <h3 className="text-foreground font-bold text-base">{bank.name}</h3>
                      <span className="text-xs text-on-surface-card-secondary font-mono">ID: {bank.id.substring(0, 8)}...</span>
                    </div>
                  </div>

                  <span
                    className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                      bank.is_active !== false
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-gray-500/20 text-on-surface-card-secondary border border-gray-500/30'
                    }`}
                  >
                    {bank.is_active !== false ? 'Activo' : 'Inactivo'}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs text-on-surface-card-secondary mb-2">
                  <span>Color Primario:</span>
                  <div
                    className="w-4 h-4 rounded-full border border-border-subtle"
                    style={{ backgroundColor: bank.color || bank.primary_color || '#534AB7' }}
                  />
                  <span className="font-mono text-on-surface-card-body">{bank.color || bank.primary_color || '#534AB7'}</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-border-subtle mt-4">
                <Button
                  size="sm"
                  variant="flat"
                  onPress={() => handleOpenBankModal(bank)}
                  className="text-purple-300 hover:bg-purple-500/10"
                >
                  <Edit2 size={14} /> Editar
                </Button>
                <Button
                  size="sm"
                  variant="flat"
                  onPress={() => handleDeleteBank(bank)}
                  className="text-red-400 hover:bg-red-500/10"
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
          ))}

          {filteredBanks.length === 0 && (
            <div className="col-span-full text-center py-12 bg-surface-card border border-border-subtle rounded-2xl text-on-surface-card-secondary">
              No se encontraron bancos en la consulta.
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: ACCOUNT TEMPLATES */}
      {!loading && activeSubTab === 'account-templates' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAccountTemplates.map((tpl) => (
            <div
              key={tpl.id}
              className="bg-surface-card border border-border-subtle rounded-2xl p-5 hover:border-purple-500/40 transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20 mb-2 inline-block">
                      {getBankNameById(tpl.bank_id)}
                    </span>
                    <h3 className="text-foreground font-bold text-base">{tpl.name}</h3>
                  </div>

                  <span className="px-2 py-0.5 text-xs rounded-full font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30 capitalize">
                    {tpl.type}
                  </span>
                </div>

                <div className="space-y-1 text-xs text-on-surface-card-secondary mt-3 pt-3 border-t border-border-subtle">
                  <div className="flex justify-between">
                    <span>Moneda:</span>
                    <span className="text-gray-200 font-medium">{tpl.currency || 'CLP'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Mantención:</span>
                    <span className="text-gray-200 font-medium">
                      ${tpl.maintenance_cost || 0} {tpl.maintenance_currency || 'CLP'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-border-subtle mt-4">
                <Button
                  size="sm"
                  variant="flat"
                  onPress={() => handleOpenAccountModal(tpl)}
                  className="text-purple-300 hover:bg-purple-500/10"
                >
                  <Edit2 size={14} /> Editar
                </Button>
                <Button
                  size="sm"
                  variant="flat"
                  onPress={() => handleDeleteAccountTemplate(tpl)}
                  className="text-red-400 hover:bg-red-500/10"
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
          ))}

          {filteredAccountTemplates.length === 0 && (
            <div className="col-span-full text-center py-12 bg-surface-card border border-border-subtle rounded-2xl text-on-surface-card-secondary">
              No se encontraron plantillas de cuentas.
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: CARD TEMPLATES */}
      {!loading && activeSubTab === 'card-templates' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCardTemplates.map((tpl) => (
            <div
              key={tpl.id}
              className="bg-surface-card border border-border-subtle rounded-2xl p-5 hover:border-purple-500/40 transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20 mb-2 inline-block">
                      {getBankNameById(tpl.bank_id)}
                    </span>
                    <h3 className="text-foreground font-bold text-base">{tpl.name}</h3>
                  </div>

                  <span className="px-2 py-0.5 text-xs rounded-full font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase">
                    {tpl.card_network}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-on-surface-card-secondary mt-3 pt-3 border-t border-border-subtle">
                  <div className="flex justify-between">
                    <span>Mantención:</span>
                    <span className="text-gray-200 font-medium">
                      ${tpl.default_maintenance_cost || 0} {tpl.maintenance_currency || 'CLP'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tasa Interés:</span>
                    <span className="text-gray-200 font-medium">{tpl.default_monthly_interest_rate || 0}% / mes</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tasa Mora:</span>
                    <span className="text-gray-200 font-medium">{tpl.default_penalty_interest_rate || 0}%</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-border-subtle mt-4">
                <Button
                  size="sm"
                  variant="flat"
                  onPress={() => handleOpenCardModal(tpl)}
                  className="text-purple-300 hover:bg-purple-500/10"
                >
                  <Edit2 size={14} /> Editar
                </Button>
                <Button
                  size="sm"
                  variant="flat"
                  onPress={() => handleDeleteCardTemplate(tpl)}
                  className="text-red-400 hover:bg-red-500/10"
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
          ))}

          {filteredCardTemplates.length === 0 && (
            <div className="col-span-full text-center py-12 bg-surface-card border border-border-subtle rounded-2xl text-on-surface-card-secondary">
              No se encontraron plantillas de tarjetas.
            </div>
          )}
        </div>
      )}

      {/* BANK MODAL */}
      {isBankModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 animate-in fade-in">
          <div className="bg-surface-card border border-border-subtle rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h2 className="text-lg font-bold text-foreground">
              {editingBank ? 'Editar Banco' : 'Nuevo Banco'}
            </h2>

            <form onSubmit={handleSaveBank} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-on-surface-card-secondary mb-1">Nombre del Banco</label>
                <input
                  type="text"
                  required
                  value={bankFormData.name}
                  onChange={(e) => setBankFormData({ ...bankFormData, name: e.target.value })}
                  placeholder="Ej: Banco de Chile, Santander, BCI..."
                  className="w-full px-3 py-2 bg-surface-card border border-border-subtle rounded-xl text-foreground text-sm focus:outline-none focus:border-kyo-lightPurple"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface-card-secondary mb-1">Color Primario (Hex)</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={bankFormData.primary_color || '#534AB7'}
                    onChange={(e) => setBankFormData({ ...bankFormData, primary_color: e.target.value })}
                    className="w-10 h-10 rounded-xl bg-transparent border-0 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={bankFormData.primary_color || '#534AB7'}
                    onChange={(e) => setBankFormData({ ...bankFormData, primary_color: e.target.value })}
                    className="flex-1 px-3 py-2 bg-surface-card border border-border-subtle rounded-xl text-foreground font-mono text-sm focus:outline-none focus:border-kyo-lightPurple"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface-card-secondary mb-1">Logo Institucional</label>
                <div className="space-y-2">
                  {bankFormData.logo_url && (
                    <div className="flex items-center gap-3 p-2 bg-surface-card rounded-xl border border-border-subtle">
                      <img src={bankFormData.logo_url} alt="Preview" className="w-8 h-8 object-contain rounded" />
                      <span className="text-xs text-on-surface-card-secondary truncate flex-1">{bankFormData.logo_url}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 px-3 py-2 bg-surface-card border border-border-subtle rounded-xl text-xs font-semibold text-purple-300 hover:bg-surface-raised cursor-pointer transition">
                      <Upload size={14} />
                      {uploadingLogo ? 'Subiendo...' : 'Subir archivo'}
                      <input
                        type="file"
                        accept="image/*"
                        disabled={uploadingLogo}
                        onChange={handleLogoFileUpload}
                        className="hidden"
                      />
                    </label>

                    <input
                      type="url"
                      placeholder="O pega una URL..."
                      value={bankFormData.logo_url || ''}
                      onChange={(e) => setBankFormData({ ...bankFormData, logo_url: e.target.value })}
                      className="flex-1 px-3 py-2 bg-surface-card border border-border-subtle rounded-xl text-foreground text-xs focus:outline-none focus:border-kyo-lightPurple"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="bank_active"
                  checked={bankFormData.is_active}
                  onChange={(e) => setBankFormData({ ...bankFormData, is_active: e.target.checked })}
                  className="rounded bg-surface-card border-border-subtle text-kyo-lightPurple focus:ring-0"
                />
                <label htmlFor="bank_active" className="text-xs text-on-surface-card-body">
                  Banco Activo en la Plataforma
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border-subtle">
                <Button
                  variant="flat"
                  onPress={() => setIsBankModalOpen(false)}
                  className="text-on-surface-card-secondary"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  isDisabled={loading || uploadingLogo}
                  className="bg-brand-primary hover:bg-kyo-lightPurple/90 text-white font-semibold"
                >
                  {loading ? 'Guardando...' : 'Guardar Banco'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ACCOUNT TEMPLATE MODAL */}
      {isAccountModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 animate-in fade-in">
          <div className="bg-surface-card border border-border-subtle rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h2 className="text-lg font-bold text-foreground">
              {editingAccountTemplate ? 'Editar Plantilla de Cuenta' : 'Nueva Plantilla de Cuenta'}
            </h2>

            <form onSubmit={handleSaveAccountTemplate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-on-surface-card-secondary mb-1">Banco Asociado</label>
                <select
                  required
                  value={accountFormData.bank_id}
                  onChange={(e) => setAccountFormData({ ...accountFormData, bank_id: e.target.value })}
                  className="w-full px-3 py-2 bg-surface-card border border-border-subtle rounded-xl text-foreground text-sm focus:outline-none focus:border-kyo-lightPurple"
                >
                  <option value="">Selecciona un Banco</option>
                  {banks.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface-card-secondary mb-1">Nombre de la Plantilla</label>
                <input
                  type="text"
                  required
                  value={accountFormData.name}
                  onChange={(e) => setAccountFormData({ ...accountFormData, name: e.target.value })}
                  placeholder="Ej: Cuenta Corriente Prime, Cuenta Vista Fan..."
                  className="w-full px-3 py-2 bg-surface-card border border-border-subtle rounded-xl text-foreground text-sm focus:outline-none focus:border-kyo-lightPurple"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-on-surface-card-secondary mb-1">Tipo de Cuenta</label>
                  <select
                    value={accountFormData.type}
                    onChange={(e) => setAccountFormData({ ...accountFormData, type: e.target.value as any })}
                    className="w-full px-3 py-2 bg-surface-card border border-border-subtle rounded-xl text-foreground text-sm"
                  >
                    <option value="checking">Corriente</option>
                    <option value="sight">Vista</option>
                    <option value="savings">Ahorro</option>
                    <option value="investment">Inversión</option>
                    <option value="cash">Efectivo</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-on-surface-card-secondary mb-1">Moneda</label>
                  <select
                    value={accountFormData.currency}
                    onChange={(e) => setAccountFormData({ ...accountFormData, currency: e.target.value })}
                    className="w-full px-3 py-2 bg-surface-card border border-border-subtle rounded-xl text-foreground text-sm"
                  >
                    <option value="CLP">CLP</option>
                    <option value="UF">UF</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-on-surface-card-secondary mb-1">Costo Mantención Base</label>
                  <input
                    type="number"
                    step="any"
                    value={accountFormData.maintenance_cost}
                    onChange={(e) => setAccountFormData({ ...accountFormData, maintenance_cost: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-surface-card border border-border-subtle rounded-xl text-foreground text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-on-surface-card-secondary mb-1">Moneda Mantención</label>
                  <select
                    value={accountFormData.maintenance_currency}
                    onChange={(e) => setAccountFormData({ ...accountFormData, maintenance_currency: e.target.value as any })}
                    className="w-full px-3 py-2 bg-surface-card border border-border-subtle rounded-xl text-foreground text-sm"
                  >
                    <option value="CLP">CLP</option>
                    <option value="UF">UF</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border-subtle">
                <Button variant="flat" onPress={() => setIsAccountModalOpen(false)} className="text-on-surface-card-secondary">
                  Cancelar
                </Button>
                <Button type="submit" isDisabled={loading} className="bg-brand-primary text-white font-semibold">
                  {loading ? 'Guardando...' : 'Guardar Plantilla'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CARD TEMPLATE MODAL */}
      {isCardModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 animate-in fade-in">
          <div className="bg-surface-card border border-border-subtle rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h2 className="text-lg font-bold text-foreground">
              {editingCardTemplate ? 'Editar Plantilla de Tarjeta' : 'Nueva Plantilla de Tarjeta'}
            </h2>

            <form onSubmit={handleSaveCardTemplate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-on-surface-card-secondary mb-1">Banco Asociado</label>
                <select
                  required
                  value={cardFormData.bank_id}
                  onChange={(e) => setCardFormData({ ...cardFormData, bank_id: e.target.value })}
                  className="w-full px-3 py-2 bg-surface-card border border-border-subtle rounded-xl text-foreground text-sm focus:outline-none focus:border-kyo-lightPurple"
                >
                  <option value="">Selecciona un Banco</option>
                  {banks.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface-card-secondary mb-1">Nombre de la Tarjeta</label>
                <input
                  type="text"
                  required
                  value={cardFormData.name}
                  onChange={(e) => setCardFormData({ ...cardFormData, name: e.target.value })}
                  placeholder="Ej: Visa Black, Mastercard Black, Signature..."
                  className="w-full px-3 py-2 bg-surface-card border border-border-subtle rounded-xl text-foreground text-sm focus:outline-none focus:border-kyo-lightPurple"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface-card-secondary mb-1">Red / Franquicia</label>
                <select
                  value={cardFormData.card_network}
                  onChange={(e) => setCardFormData({ ...cardFormData, card_network: e.target.value as any })}
                  className="w-full px-3 py-2 bg-surface-card border border-border-subtle rounded-xl text-foreground text-sm"
                >
                  <option value="visa">Visa</option>
                  <option value="mastercard">Mastercard</option>
                  <option value="amex">American Express</option>
                  <option value="other">Otra</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-on-surface-card-secondary mb-1">Costo Mantención</label>
                  <input
                    type="number"
                    step="any"
                    value={cardFormData.default_maintenance_cost}
                    onChange={(e) => setCardFormData({ ...cardFormData, default_maintenance_cost: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-surface-card border border-border-subtle rounded-xl text-foreground text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-on-surface-card-secondary mb-1">Moneda Mantención</label>
                  <select
                    value={cardFormData.maintenance_currency}
                    onChange={(e) => setCardFormData({ ...cardFormData, maintenance_currency: e.target.value as any })}
                    className="w-full px-3 py-2 bg-surface-card border border-border-subtle rounded-xl text-foreground text-sm"
                  >
                    <option value="CLP">CLP</option>
                    <option value="UF">UF</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-on-surface-card-secondary mb-1">Tasa Interés Mensual (%)</label>
                  <input
                    type="number"
                    step="any"
                    value={cardFormData.default_monthly_interest_rate}
                    onChange={(e) => setCardFormData({ ...cardFormData, default_monthly_interest_rate: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-surface-card border border-border-subtle rounded-xl text-foreground text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-on-surface-card-secondary mb-1">Tasa Interés Mora (%)</label>
                  <input
                    type="number"
                    step="any"
                    value={cardFormData.default_penalty_interest_rate}
                    onChange={(e) => setCardFormData({ ...cardFormData, default_penalty_interest_rate: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-surface-card border border-border-subtle rounded-xl text-foreground text-sm"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border-subtle">
                <Button variant="flat" onPress={() => setIsCardModalOpen(false)} className="text-on-surface-card-secondary">
                  Cancelar
                </Button>
                <Button type="submit" isDisabled={loading} className="bg-brand-primary text-white font-semibold">
                  {loading ? 'Guardando...' : 'Guardar Plantilla'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
