import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { User, Warehouse } from '../types';
import { 
  Crown, 
  ShieldAlert, 
  Power, 
  Users, 
  Building2, 
  CheckCircle2, 
  XCircle, 
  Save, 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  RefreshCw, 
  Server, 
  MessageSquare, 
  ArrowLeft,
  X,
  AlertTriangle,
  Lock,
  Mail,
  ShieldCheck,
  LogOut,
  User as UserIcon
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export const PlatformAdminPage: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };
  
  // Platform Settings State
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState(false);

  // Companies State
  const [companies, setCompanies] = useState<any[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyPhone, setNewCompanyPhone] = useState('');
  const [newCompanyEmail, setNewCompanyEmail] = useState('');
  const [newCompanyAddress, setNewCompanyAddress] = useState('');
  const [newCompanyCurrency, setNewCompanyCurrency] = useState('FCFA');
  const [submittingCompany, setSubmittingCompany] = useState(false);

  // Users State
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // WhatsApp Gateway Status
  const [waStatus, setWaStatus] = useState<any>(null);

  // Create User Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('admin');
  const [selectedCompanyId, setSelectedCompanyId] = useState<number>(1);
  const [submittingUser, setSubmittingUser] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit User Modal State
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState('logistics');
  const [editCompanyId, setEditCompanyId] = useState<number>(1);
  const [editIsActive, setEditIsActive] = useState<boolean>(true);
  const [editPassword, setEditPassword] = useState('');
  const [submittingEdit, setSubmittingEdit] = useState(false);

  const loadData = async () => {
    try {
      const [settingsRes, usersRes, waRes, companiesRes] = await Promise.all([
        api.get('/settings/company'),
        api.get('/users'),
        api.get('/whatsapp/status').catch(() => ({ data: { isConnected: false } })),
        api.get('/companies').catch(() => ({ data: { companies: [] } }))
      ]);

      if (settingsRes.data.settings) {
        const s = settingsRes.data.settings;
        setMaintenanceMode(s.maintenance_mode || false);
        setMaintenanceMessage(s.maintenance_message || 'CargoNotify est actuellement en maintenance programmée par l\'administrateur.');
        setCompanyName(s.company_name);
        setCompanyPhone(s.phone);
        setCompanyEmail(s.email);
      }

      setUsers(usersRes.data.users);
      setWaStatus(waRes.data);
      setCompanies(companiesRes.data.companies || []);
    } catch (err) {
      console.error('Erreur chargement Console SaaS Super Admin:', err);
    } finally {
      setLoadingUsers(false);
      setLoadingCompanies(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Form state for combined Company + Admin registration
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [companyError, setCompanyError] = useState<string | null>(null);

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setCompanyError(null);
    if (!newCompanyName || !newCompanyPhone || !newCompanyEmail || !adminEmail || !adminPassword) {
      setCompanyError('Veuillez remplir tous les champs obligatoires (*).');
      return;
    }
    setSubmittingCompany(true);

    try {
      // 1. Créer la société cliente
      const compRes = await api.post('/companies', {
        name: newCompanyName,
        phone: newCompanyPhone,
        email: newCompanyEmail,
        address: newCompanyAddress,
        currency: newCompanyCurrency
      });

      const companyId = compRes.data.company.id;

      // 2. Créer le compte Administrateur Client rattaché
      await api.post('/users', {
        name: adminName || `Directeur ${newCompanyName}`,
        email: adminEmail,
        password: adminPassword,
        role: 'admin',
        company_id: companyId
      });

      setIsCompanyModalOpen(false);
      setNewCompanyName('');
      setNewCompanyPhone('');
      setNewCompanyEmail('');
      setNewCompanyAddress('');
      setAdminName('');
      setAdminEmail('');
      setAdminPassword('');
      loadData();
    } catch (err: any) {
      setCompanyError(err.response?.data?.error || 'Erreur lors de la création du compte société.');
    } finally {
      setSubmittingCompany(false);
    }
  };

  const handleSaveSystemConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsSuccess(false);

    try {
      await api.put('/settings/company', {
        company_name: companyName,
        phone: companyPhone,
        email: companyEmail,
        maintenance_mode: maintenanceMode,
        maintenance_message: maintenanceMessage
      });

      setSettingsSuccess(true);
      setTimeout(() => setSettingsSuccess(false), 4000);
    } catch (err) {
      console.error('Erreur sauvegarde configuration système:', err);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleToggleUserActive = async (u: User) => {
    try {
      await api.put(`/users/${u.id}`, {
        is_active: !u.is_active
      });
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erreur modification statut.');
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    if (!newName || !newEmail || !newPassword) return;
    setSubmittingUser(true);

    try {
      await api.post('/users', {
        name: newName,
        email: newEmail,
        password: newPassword,
        role: newRole,
        company_id: selectedCompanyId
      });

      setIsCreateModalOpen(false);
      setNewName('');
      setNewEmail('');
      setNewPassword('');
      setNewRole('admin');
      loadData();
    } catch (err: any) {
      setCreateError(err.response?.data?.error || 'Erreur création compte.');
    } finally {
      setSubmittingUser(false);
    }
  };

  const handleOpenEdit = (u: User) => {
    setEditingUser(u);
    setEditName(u.name);
    setEditEmail(u.email);
    setEditRole(u.role || 'logistics');
    setEditCompanyId((u as any).company_id || 1);
    setEditIsActive(u.is_active !== undefined ? (u.is_active as any) : true);
    setEditPassword('');
  };

  const handleSaveEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setSubmittingEdit(true);

    try {
      await api.put(`/users/${editingUser.id}`, {
        name: editName,
        email: editEmail,
        role: editRole,
        company_id: editCompanyId,
        is_active: editIsActive,
        password: editPassword !== '' ? editPassword : undefined
      });

      setEditingUser(null);
      loadData();
    } catch (err) {
      console.error('Erreur modification utilisateur:', err);
    } finally {
      setSubmittingEdit(false);
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!window.confirm('Voulez-vous supprimer définitivement ce compte de la plateforme ?')) return;
    try {
      await api.delete(`/users/${userId}`);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erreur suppression.');
    }
  };

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background text-foreground p-3.5 sm:p-6 md:p-8 space-y-6 sm:space-y-8 font-sans">
      {/* Super Admin Console Header */}
      <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-card border border-border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3 sm:gap-4">
          <div className="p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-xl shadow-blue-500/20 shrink-0 mt-0.5 sm:mt-0">
            <Crown className="w-6 h-6 sm:w-8 sm:h-8" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg sm:text-2xl font-extrabold tracking-tight text-foreground">Console de Gestion SaaS</h1>
              <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-[10px] font-extrabold uppercase">
                Éditeur / Propriétaire
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">Espace réservé au Gestionnaire de l'Application pour piloter le système et valider les entreprises clientes.</p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 w-full md:w-auto justify-end border-t md:border-t-0 pt-3 md:pt-0 border-border">
          <button
            onClick={loadData}
            className="p-2.5 rounded-xl bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground border border-border transition-colors flex items-center gap-2 text-xs font-bold"
            title="Rafraîchir les métriques"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">Actualiser</span>
          </button>

          <button
            onClick={handleLogout}
            className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-600 text-red-600 hover:text-white font-extrabold text-xs border border-red-500/20 shadow-sm transition-all"
          >
            <LogOut className="w-4 h-4" />
            <span>Déconnexion</span>
          </button>
        </div>
      </div>

      {/* Chiffres Clés de la Plateforme SaaS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-card border border-border shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-bold uppercase tracking-wider">Total Sociétés & Comptes</span>
            <Users className="w-5 h-5 text-primary" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-foreground">{users.length}</p>
          <div className="flex items-center gap-2 text-xs text-emerald-600 font-medium">
            <span>{users.filter(u => u.is_active !== false).length} Comptes Actifs</span>
          </div>
        </div>

        <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-card border border-border shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-bold uppercase tracking-wider">Statut Général du Site</span>
            <Server className="w-5 h-5 text-blue-500" />
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full animate-pulse shrink-0 ${maintenanceMode ? 'bg-red-500' : 'bg-emerald-500'}`} />
            <p className={`text-base sm:text-xl font-extrabold truncate ${maintenanceMode ? 'text-red-500' : 'text-emerald-600'}`}>
              {maintenanceMode ? 'Mode Maintenance' : 'Plateforme En Ligne'}
            </p>
          </div>
          <p className="text-[11px] text-muted-foreground leading-tight">
            {maintenanceMode ? 'Accès restreint aux administrateurs' : 'Accès ouvert à l\'ensemble des utilisateurs'}
          </p>
        </div>

        <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-card border border-border shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-bold uppercase tracking-wider">Passerelle WhatsApp</span>
            <MessageSquare className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full shrink-0 ${waStatus?.isConnected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            <p className="text-base sm:text-xl font-extrabold text-foreground truncate">
              {waStatus?.isConnected ? 'Connecté (Baileys)' : 'En Attente'}
            </p>
          </div>
          <p className="text-[11px] text-muted-foreground">Passerelle Multi-Session Active</p>
        </div>

        <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-card border border-border shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-bold uppercase tracking-wider">Identifiant Gestionnaire</span>
            <Crown className="w-5 h-5 text-amber-500" />
          </div>
          <p className="text-xs sm:text-sm font-extrabold text-primary truncate max-w-[200px] sm:max-w-none">{user?.email}</p>
          <span className="inline-block px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-extrabold uppercase">
            Rôle: {user?.role}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        {/* SECTION 1: Interrupteur Mode Maintenance & Contrôle Global */}
        <div className="lg:col-span-1 space-y-6">
          <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-card border border-border shadow-sm space-y-5">
            <h2 className="text-base font-extrabold text-foreground flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-500" />
              <span>Contrôle Système & Maintenance</span>
            </h2>

            {settingsSuccess && (
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 font-bold text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>Modifications enregistrées avec succès !</span>
              </div>
            )}

            {/* Main Switch Card */}
            <div className={`p-4 sm:p-5 rounded-2xl border space-y-4 ${
              maintenanceMode 
                ? 'bg-red-500/10 border-red-500/30' 
                : 'bg-emerald-500/10 border-emerald-500/30'
            }`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase text-muted-foreground">Interrupteur d'Accès</span>
                <button
                  type="button"
                  onClick={() => setMaintenanceMode(!maintenanceMode)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-extrabold shadow transition-all ${
                    maintenanceMode 
                      ? 'bg-red-600 text-white shadow-red-600/30' 
                      : 'bg-emerald-600 text-white shadow-emerald-600/30'
                  }`}
                >
                  <Power className="w-4 h-4" />
                  <span>{maintenanceMode ? 'Site Bloqué' : 'Site En Ligne'}</span>
                </button>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                {maintenanceMode 
                  ? '🛑 Le site est actuellement verrouillé pour tous les collaborateurs clients.'
                  : '🟢 Le site est ouvert à l\'ensemble des utilisateurs autorisés.'}
              </p>
            </div>

            <form onSubmit={handleSaveSystemConfig} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-muted-foreground mb-1">Message d'Interruption (affiché aux utilisateurs)</label>
                <textarea
                  rows={3}
                  value={maintenanceMessage}
                  onChange={(e) => setMaintenanceMessage(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-secondary border border-border rounded-xl text-foreground font-medium focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block font-semibold text-muted-foreground mb-1">Nom Officiel du Service SaaS</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-secondary border border-border rounded-xl text-foreground font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-muted-foreground mb-1">Contact Support Gestionnaire</label>
                <input
                  type="text"
                  value={companyPhone}
                  onChange={(e) => setCompanyPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-secondary border border-border rounded-xl text-foreground font-bold"
                />
              </div>

              <button
                type="submit"
                disabled={savingSettings}
                className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs shadow hover:bg-primary/90 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{savingSettings ? 'Sauvegarde...' : 'Sauvegarder les Paramètres Système'}</span>
              </button>
            </form>
          </div>
        </div>

        {/* SECTION 2: Console de Gestion des Utilisateurs & Accès */}
        <div className="lg:col-span-2 space-y-6">
          <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-card border border-border shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-extrabold text-foreground flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  <span>Validation & Contrôle des Sociétés et Comptes</span>
                </h2>
                <p className="text-xs text-muted-foreground">Inscrivez de nouvelles entreprises de transit et gérez les autorisations de tous les comptes.</p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={() => setIsCompanyModalOpen(true)}
                  className="flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-primary text-primary-foreground font-bold text-xs shadow hover:bg-primary/90 transition-all w-full sm:w-auto"
                >
                  <Building2 className="w-4 h-4" />
                  <span>Inscrire une Entreprise Cliente</span>
                </button>

                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground font-bold text-xs border border-border transition-all w-full sm:w-auto"
                >
                  <Plus className="w-4 h-4 text-primary" />
                  <span>Ajouter un Collaborateur</span>
                </button>
              </div>
            </div>

            {/* Barre de Recherche */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Rechercher par nom ou email..."
                className="w-full pl-10 pr-4 py-2.5 bg-secondary border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary font-bold"
              />
            </div>

            {/* Vue Table pour Desktops / Tablettes (md et +) */}
            <div className="hidden md:block overflow-x-auto border border-border rounded-2xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-secondary/60 text-muted-foreground font-bold uppercase tracking-wider border-b border-border">
                  <tr>
                    <th className="px-4 py-3">Utilisateur</th>
                    <th className="px-4 py-3">Rôle / Droits</th>
                    <th className="px-4 py-3">Statut Accès</th>
                    <th className="px-4 py-3 text-right">Actions 1-Clic</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-medium">
                  {filteredUsers.map((u) => {
                    const isActive = u.is_active !== false;
                    const isSuper = u.role === 'super_admin';

                    return (
                      <tr key={u.id} className={`hover:bg-secondary/30 transition-colors ${!isActive ? 'bg-red-500/5' : ''}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-8 h-8 rounded-xl font-extrabold flex items-center justify-center text-xs shrink-0 ${
                              isSuper ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground border border-border'
                            }`}>
                              {u.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="font-extrabold text-foreground truncate">{u.name}</p>
                              <p className="text-[11px] text-muted-foreground truncate">{u.email}</p>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase shrink-0 ${
                            isSuper 
                              ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20' 
                              : u.role === 'admin'
                              ? 'bg-primary/10 text-primary border border-primary/20'
                              : 'bg-secondary text-muted-foreground border border-border'
                          }`}>
                            {isSuper ? '👑 Super Admin' : u.role === 'admin' ? '⭐ Admin Client' : u.role}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <span className={`font-bold flex items-center gap-1 ${isActive ? 'text-emerald-600' : 'text-red-500'}`}>
                            {isActive ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                            <span>{isActive ? 'Actif' : 'Suspendu'}</span>
                          </span>
                        </td>

                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {u.id !== user?.id && (
                              <button
                                onClick={() => handleToggleUserActive(u)}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase transition-colors ${
                                  isActive
                                    ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20'
                                    : 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border border-emerald-500/20'
                                }`}
                              >
                                {isActive ? 'Bloquer' : 'Débloquer'}
                              </button>
                            )}

                            <button
                              onClick={() => handleOpenEdit(u)}
                              className="p-1.5 rounded-lg bg-secondary hover:bg-primary hover:text-white text-muted-foreground transition-colors"
                              title="Modifier"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            {u.id !== user?.id && (
                              <button
                                onClick={() => handleDeleteUser(u.id)}
                                className="p-1.5 rounded-lg bg-secondary hover:bg-red-600 hover:text-white text-red-500 transition-colors"
                                title="Supprimer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Vue Cartes pour Smartphones (< md) */}
            <div className="block md:hidden space-y-3">
              {filteredUsers.map((u) => {
                const isActive = u.is_active !== false;
                const isSuper = u.role === 'super_admin';

                return (
                  <div key={u.id} className={`p-4 rounded-2xl bg-card border border-border shadow-sm space-y-3 ${!isActive ? 'border-red-500/30 bg-red-500/5' : ''}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-9 h-9 rounded-xl font-extrabold flex items-center justify-center text-xs shrink-0 ${
                          isSuper ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground border border-border'
                        }`}>
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-extrabold text-foreground text-xs truncate">{u.name}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{u.email}</p>
                        </div>
                      </div>

                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase shrink-0 ${
                        isSuper 
                          ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20' 
                          : u.role === 'admin'
                          ? 'bg-primary/10 text-primary border border-primary/20'
                          : 'bg-secondary text-muted-foreground border border-border'
                      }`}>
                        {isSuper ? '👑 Super Admin' : u.role === 'admin' ? '⭐ Admin' : u.role}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2.5 border-t border-border/60 text-xs gap-2">
                      <span className={`font-bold flex items-center gap-1.5 shrink-0 ${isActive ? 'text-emerald-600' : 'text-red-500'}`}>
                        {isActive ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                        <span>{isActive ? 'Actif' : 'Suspendu'}</span>
                      </span>

                      <div className="flex items-center gap-1.5">
                        {u.id !== user?.id && (
                          <button
                            onClick={() => handleToggleUserActive(u)}
                            className={`px-2.5 py-1.5 rounded-lg text-[10px] font-extrabold uppercase transition-colors ${
                              isActive
                                ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20'
                                : 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border border-emerald-500/20'
                            }`}
                          >
                            {isActive ? 'Bloquer' : 'Débloquer'}
                          </button>
                        )}

                        <button
                          onClick={() => handleOpenEdit(u)}
                          className="p-1.5 rounded-lg bg-secondary hover:bg-primary hover:text-white text-muted-foreground transition-colors"
                          title="Modifier"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        {u.id !== user?.id && (
                          <button
                            onClick={() => handleDeleteUser(u.id)}
                            className="p-1.5 rounded-lg bg-secondary hover:bg-red-600 hover:text-white text-red-500 transition-colors"
                            title="Supprimer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Modal Inscription Nouvelle Entreprise Cliente & Compte Admin */}
      {isCompanyModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-card border border-border rounded-2xl sm:rounded-3xl max-w-xl w-full p-4 sm:p-6 shadow-2xl space-y-4 text-foreground my-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base sm:text-lg font-extrabold flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary" />
                <span>Inscrire une Nouvelle Société Cliente</span>
              </h3>
              <button
                onClick={() => setIsCompanyModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-secondary text-muted-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {companyError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-semibold">
                {companyError}
              </div>
            )}

            <form onSubmit={handleCreateCompany} className="space-y-4 text-xs max-h-[75vh] overflow-y-auto pr-1">
              {/* SECTION 1: PROFIL SOCIÉTÉ */}
              <div className="p-3.5 sm:p-4 rounded-2xl bg-secondary/50 border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-primary text-xs flex items-center gap-1.5">
                    <Building2 className="w-4 h-4" />
                    <span>1. Profil de la Société</span>
                  </h4>
                </div>

                <div>
                  <label className="block font-semibold mb-1">Nom de la Société *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Senegal Fret Express"
                    value={newCompanyName}
                    onChange={(e) => setNewCompanyName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-card border border-border rounded-xl font-bold"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold mb-1">Téléphone Principal *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: +221 77 123 45 67"
                      value={newCompanyPhone}
                      onChange={(e) => setNewCompanyPhone(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-card border border-border rounded-xl font-bold"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold mb-1">Email Officiel *</label>
                    <input
                      type="email"
                      required
                      placeholder="Ex: contact@senegalfret.sn"
                      value={newCompanyEmail}
                      onChange={(e) => setNewCompanyEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-card border border-border rounded-xl font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold mb-1">Adresse du Siège *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Dakar Plateau"
                      value={newCompanyAddress}
                      onChange={(e) => setNewCompanyAddress(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-card border border-border rounded-xl font-bold"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold mb-1">Devise Principale</label>
                    <input
                      type="text"
                      required
                      placeholder="FCFA"
                      value={newCompanyCurrency}
                      onChange={(e) => setNewCompanyCurrency(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-card border border-border rounded-xl text-primary font-black"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 2: IDENTIFIANTS COMPTE ADMIN CLIENT */}
              <div className="p-3.5 sm:p-4 rounded-2xl bg-secondary/50 border border-border space-y-3">
                <h4 className="font-extrabold text-primary text-xs flex items-center gap-1.5">
                  <UserIcon className="w-4 h-4" />
                  <span>2. Identifiants du Compte Administrateur Client</span>
                </h4>

                <div>
                  <label className="block font-semibold mb-1">Nom Complet du Responsable *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Cheikh Ndiaye (Directeur)"
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-card border border-border rounded-xl font-bold"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold mb-1">Email de Connexion *</label>
                    <input
                      type="email"
                      required
                      placeholder="admin@senegalfret.sn"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-card border border-border rounded-xl font-bold"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold mb-1">Mot de Passe Initial *</label>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-card border border-border rounded-xl font-bold"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsCompanyModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs hover:bg-secondary font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submittingCompany}
                  className="px-5 py-2 rounded-xl bg-primary text-primary-foreground font-bold shadow hover:bg-primary/90 disabled:opacity-50"
                >
                  {submittingCompany ? 'Inscription en cours...' : 'Inscrire la Société & l\'Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Création Utilisateur avec React Portal */}
      {isCreateModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-card border border-border rounded-2xl sm:rounded-3xl max-w-md w-full p-4 sm:p-6 shadow-2xl space-y-4 text-foreground my-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base sm:text-lg font-extrabold flex items-center gap-2">
                <Crown className="w-5 h-5 text-primary" />
                <span>Créer un Compte Collaborateur</span>
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-secondary text-muted-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {createError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-semibold">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-3.5 text-xs max-h-[75vh] overflow-y-auto pr-1">
              <div>
                <label className="block font-semibold mb-1">Nom Complet *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Mamadou Diallo"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-secondary border border-border rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Email *</label>
                <input
                  type="email"
                  required
                  placeholder="Ex: mamadou@cargonotify.sn"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-secondary border border-border rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Mot de passe *</label>
                <input
                  type="password"
                  required
                  placeholder="Minimum 6 caractères"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-secondary border border-border rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Société Cliente (Multi-Tenant) *</label>
                <select
                  value={selectedCompanyId}
                  onChange={(e) => setSelectedCompanyId(parseInt(e.target.value, 10))}
                  className="w-full px-3.5 py-2.5 bg-secondary border border-border rounded-xl font-bold"
                >
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} (ID: {c.id})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">Rôle sur la Plateforme *</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-secondary border border-border rounded-xl font-bold"
                >
                  <option value="admin">⭐ Administrateur de l'Entreprise Client</option>
                  <option value="logistics">📦 Gestionnaire Logistique & Entrepôt</option>
                  <option value="cashier">💳 Agent de Caisse & Règlements</option>
                  <option value="agent">📱 Agent WhatsApp</option>
                  <option value="super_admin">👑 Super Administrateur (Gestionnaire Plateforme)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs hover:bg-secondary font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submittingUser}
                  className="px-5 py-2 rounded-xl bg-primary text-primary-foreground font-bold shadow hover:bg-primary/90 disabled:opacity-50"
                >
                  {submittingUser ? 'Création...' : 'Valider'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Modification Utilisateur avec React Portal */}
      {editingUser && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-card border border-border rounded-2xl sm:rounded-3xl max-w-md w-full p-4 sm:p-6 shadow-2xl space-y-4 text-foreground my-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base sm:text-lg font-extrabold flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-primary" />
                <span>Modifier le Compte</span>
              </h3>
              <button
                onClick={() => setEditingUser(null)}
                className="p-1.5 rounded-xl hover:bg-secondary text-muted-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditUser} className="space-y-3.5 text-xs max-h-[75vh] overflow-y-auto pr-1">
              <div>
                <label className="block font-semibold mb-1">Nom Complet *</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-secondary border border-border rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Email *</label>
                <input
                  type="email"
                  required
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-secondary border border-border rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Rôle d'Accès</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-secondary border border-border rounded-xl font-bold"
                >
                  <option value="super_admin">👑 Super Administrateur (Gestionnaire Plateforme)</option>
                  <option value="admin">⭐ Administrateur de l'Entreprise Client</option>
                  <option value="logistics">📦 Gestionnaire Logistique & Entrepôt</option>
                  <option value="cashier">💳 Agent de Caisse & Règlements</option>
                  <option value="agent">📱 Agent WhatsApp</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">Statut du Compte</label>
                <select
                  value={editIsActive ? 'true' : 'false'}
                  onChange={(e) => setEditIsActive(e.target.value === 'true')}
                  className="w-full px-3.5 py-2.5 bg-secondary border border-border rounded-xl font-bold"
                >
                  <option value="true">🟢 Compte Actif (Accès Autorisé)</option>
                  <option value="false">🔴 Compte Suspendu (Accès Bloqué)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">Nouveau mot de passe (Optionnel)</label>
                <input
                  type="password"
                  placeholder="Laisser vide si aucun changement"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-secondary border border-border rounded-xl font-bold"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 rounded-xl text-xs hover:bg-secondary font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submittingEdit}
                  className="px-5 py-2 rounded-xl bg-primary text-primary-foreground font-bold shadow hover:bg-primary/90 disabled:opacity-50"
                >
                  {submittingEdit ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
