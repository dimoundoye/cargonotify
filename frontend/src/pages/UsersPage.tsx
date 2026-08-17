import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../lib/api';
import { User, Warehouse, AuditLog } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { formatDateTime } from '../lib/utils';
import { 
  UserCheck, 
  Plus, 
  Shield, 
  Building2, 
  Mail, 
  Lock, 
  Edit2, 
  Trash2, 
  Search, 
  ShieldAlert, 
  CheckCircle2, 
  X, 
  AlertTriangle,
  Key,
  Warehouse as WarehouseIcon,
  Crown,
  Package,
  CreditCard,
  MessageSquare,
  Power,
  LayoutDashboard,
  Container,
  Users,
  Sliders,
  Settings,
  CheckSquare,
  BarChart3,
  Wallet,
  History,
  Clock,
  FileText,
  Filter,
  QrCode
} from 'lucide-react';

const APP_TABS = [
  { id: '/dashboard', label: 'Tableau de bord', desc: 'Vue d\'ensemble & indicateurs clés', icon: LayoutDashboard },
  { id: '/containers', label: 'Conteneurs & Fret', desc: 'Suivi des arrivées et frais de conteneurs', icon: Container },
  { id: '/lots', label: 'Lots Clients & Colis', desc: 'Saisie des lots CBM et suivi des retraits', icon: Package },
  { id: '/clients', label: 'Répertoire Clients', desc: 'Fiches clients et historique des expéditions', icon: Users },
  { id: '/payments', label: 'Paiements & Reçus', desc: 'Encaissements et reçus PDF', icon: CreditCard },
  { id: '/expenses', label: 'Gestion des Dépenses', desc: 'Salaires, transports, manutention et imprévus', icon: Wallet },
  { id: '/collaborateurs', label: 'Collaborateurs & Accès', desc: 'Gestion des comptes et droits des employés', icon: UserCheck },
  { id: '/whatsapp', label: 'Notifications WhatsApp', desc: 'Alertes d\'arrivée et relances WhatsApp', icon: MessageSquare },
  { id: '/statistics', label: 'Statistiques & Bilans', desc: 'Analyses mensuelles, annuelles et bilans d\'activité', icon: BarChart3 },
  { id: '/scan-qr', label: 'Scanner & Valider QR', desc: 'Vérification d\'authenticité et anti-fraude des reçus', icon: QrCode },
  { id: '/pricing', label: 'Tarifs & Services CBM', desc: 'Barèmes tarifaires et prestations annexes', icon: Sliders },
  { id: '/settings', label: 'Paramètres Entreprise', desc: 'Profil de la société et paramètres généraux', icon: Settings }
];

const DEFAULT_COLLABORATOR_TABS = ['/dashboard', '/statistics', '/scan-qr', '/containers', '/lots', '/clients', '/payments', '/expenses'];

export const UsersPage: React.FC = () => {
  const { user: currentUser } = useAuth();

  // Sub-Tab Switcher State: 'users' | 'audit'
  const [activeSubTab, setActiveSubTab] = useState<'users' | 'audit'>('users');

  const [users, setUsers] = useState<User[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditSummary, setAuditSummary] = useState({
    total_logs: 0,
    create_count: 0,
    update_count: 0,
    delete_count: 0,
    auth_count: 0,
    comm_count: 0
  });
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditSearch, setAuditSearch] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState('all');
  const [auditUserFilter, setAuditUserFilter] = useState('all');

  // Create User Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [allowedTabs, setAllowedTabs] = useState<string[]>(DEFAULT_COLLABORATOR_TABS);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Edit User Modal State
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editAllowedTabs, setEditAllowedTabs] = useState<string[]>(DEFAULT_COLLABORATOR_TABS);
  const [editWarehouseId, setEditWarehouseId] = useState<string>('');
  const [editIsActive, setEditIsActive] = useState<boolean>(true);
  const [editPassword, setEditPassword] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Delete User Modal State
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [uRes, wRes] = await Promise.all([
        api.get('/users'),
        api.get('/warehouses')
      ]);
      setUsers(uRes.data.users || []);
      setWarehouses(wRes.data.warehouses || []);
    } catch (err) {
      console.error('Erreur chargement utilisateurs:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadAuditData = async () => {
    try {
      setAuditLoading(true);
      const res = await api.get(`/audit-logs?user_id=${auditUserFilter}&action_type=${auditActionFilter}&search=${encodeURIComponent(auditSearch)}`);
      setAuditLogs(res.data.logs || []);
      setAuditSummary(res.data.summary || {});
    } catch (err) {
      console.error('Erreur chargement audit logs:', err);
    } finally {
      setAuditLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (activeSubTab === 'audit') {
      loadAuditData();
    }
  }, [activeSubTab, auditActionFilter, auditUserFilter]);

  const handleToggleTabForCreate = (tabPath: string) => {
    if (allowedTabs.includes(tabPath)) {
      setAllowedTabs(allowedTabs.filter(t => t !== tabPath));
    } else {
      setAllowedTabs([...allowedTabs, tabPath]);
    }
  };

  const handleToggleTabForEdit = (tabPath: string) => {
    if (editAllowedTabs.includes(tabPath)) {
      setEditAllowedTabs(editAllowedTabs.filter(t => t !== tabPath));
    } else {
      setEditAllowedTabs([...editAllowedTabs, tabPath]);
    }
  };

  const handleToggleUserActive = async (u: User) => {
    try {
      await api.put(`/users/${u.id}`, {
        is_active: !u.is_active
      });
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erreur lors de la modification du statut.');
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!name || !email || !password) return;
    setSubmitting(true);

    try {
      await api.post('/users', {
        name,
        email,
        password,
        role: 'logistics',
        allowed_tabs: allowedTabs,
        warehouse_id: selectedWarehouseId ? parseInt(selectedWarehouseId, 10) : null
      });

      setIsCreateModalOpen(false);
      setName('');
      setEmail('');
      setPassword('');
      setAllowedTabs(DEFAULT_COLLABORATOR_TABS);
      setSelectedWarehouseId('');
      loadData();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || 'Erreur lors de la création du collaborateur.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEdit = (u: User) => {
    setEditingUser(u);
    setEditName(u.name);
    setEditEmail(u.email);
    
    // Initialiser les onglets cochés
    if (u.allowed_tabs && Array.isArray(u.allowed_tabs) && u.allowed_tabs.length > 0) {
      setEditAllowedTabs([...u.allowed_tabs]);
    } else {
      setEditAllowedTabs(DEFAULT_COLLABORATOR_TABS);
    }

    setEditWarehouseId(u.warehouse_id ? String(u.warehouse_id) : '');
    setEditIsActive(u.is_active !== undefined ? (u.is_active as any) : true);
    setEditPassword('');
  };

  const handleSaveEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setEditSubmitting(true);

    try {
      await api.put(`/users/${editingUser.id}`, {
        name: editName,
        email: editEmail,
        allowed_tabs: editAllowedTabs,
        warehouse_id: editWarehouseId ? parseInt(editWarehouseId, 10) : null,
        is_active: editIsActive,
        password: editPassword !== '' ? editPassword : undefined
      });

      setEditingUser(null);
      loadData();
    } catch (err) {
      console.error('Erreur modification collaborateur:', err);
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleConfirmDeleteUser = async () => {
    if (!deletingUser) return;
    setIsDeleting(true);

    try {
      await api.delete(`/users/${deletingUser.id}`);
      setDeletingUser(null);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erreur lors de la suppression.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Exclure les comptes Super Admin de la gestion interne des collaborateurs de la société
  const companyUsers = users.filter(u => u.role !== 'super_admin');
  const filteredUsers = companyUsers.filter(u =>
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
            <UserCheck className="w-7 h-7 text-primary" />
            <span>Collaborateurs, Accès & Sécurité</span>
          </h1>
          <p className="text-sm text-muted-foreground">Gérez les comptes employés, leurs onglets autorisés et consultez le journal d'audit des actions.</p>
        </div>

        {activeSubTab === 'users' && (
          <button
            onClick={() => {
              setAllowedTabs(DEFAULT_COLLABORATOR_TABS);
              setIsCreateModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm shadow-md hover:bg-primary/90 transition-all self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Nouveau Collaborateur</span>
          </button>
        )}
      </div>

      {/* Sub-Tab Navigation Bar */}
      <div className="flex items-center gap-2 p-1.5 bg-secondary/80 rounded-2xl w-fit border border-border">
        <button
          onClick={() => setActiveSubTab('users')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all ${
            activeSubTab === 'users'
              ? 'bg-card text-foreground shadow-sm border border-border'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <UserCheck className="w-4 h-4 text-primary" />
          <span>👥 Collaborateurs & Droits d'Accès</span>
        </button>

        <button
          onClick={() => setActiveSubTab('audit')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all ${
            activeSubTab === 'audit'
              ? 'bg-card text-foreground shadow-sm border border-border'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <History className="w-4 h-4 text-amber-500" />
          <span>📜 Journal d'Audit & Sécurité</span>
        </button>
      </div>

      {activeSubTab === 'users' ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-card border border-border">
              <span className="text-[10px] font-extrabold text-muted-foreground uppercase">Total Collaborateurs</span>
              <p className="text-xl font-black text-foreground mt-1">{companyUsers.length}</p>
            </div>
            <div className="p-4 rounded-2xl bg-card border border-border">
              <span className="text-[10px] font-extrabold text-emerald-600 uppercase">Comptes Actifs</span>
              <p className="text-xl font-black text-emerald-600 mt-1">{companyUsers.filter(u => u.is_active !== false).length}</p>
            </div>
            <div className="p-4 rounded-2xl bg-card border border-border">
              <span className="text-[10px] font-extrabold text-red-500 uppercase">Comptes Suspendus</span>
              <p className="text-xl font-black text-red-500 mt-1">{companyUsers.filter(u => u.is_active === false).length}</p>
            </div>
            <div className="p-4 rounded-2xl bg-card border border-border">
              <span className="text-[10px] font-extrabold text-amber-500 uppercase">Administrateurs</span>
              <p className="text-xl font-black text-amber-500 mt-1">{companyUsers.filter(u => u.role === 'admin').length}</p>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher un collaborateur par nom ou email..."
              className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Users List Grid */}
          {loading ? (
            <div className="flex items-center justify-center min-h-[40vh]">
              <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-card border border-border space-y-3">
              <Users className="w-12 h-12 text-muted-foreground mx-auto" />
              <h3 className="text-base font-bold text-foreground">Aucun collaborateur trouvé</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">Créez votre premier compte employé en cliquant sur le bouton "Nouveau Collaborateur".</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredUsers.map((u) => {
                const isAdmin = u.role === 'admin';
                const isActive = u.is_active !== false;
                const effectiveTabs = u.allowed_tabs && Array.isArray(u.allowed_tabs) ? u.allowed_tabs : DEFAULT_COLLABORATOR_TABS;

                return (
                  <div 
                    key={u.id}
                    className={`p-6 rounded-3xl bg-card border border-border shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-5 ${
                      !isActive ? 'opacity-60 bg-secondary/30' : ''
                    }`}
                  >
                    <div className="space-y-4">
                      {/* Top User Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg ${
                            isAdmin ? 'bg-amber-500/10 text-amber-600' : 'bg-primary/10 text-primary'
                          }`}>
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <h3 className="font-extrabold text-base text-foreground leading-tight">{u.name}</h3>
                            <p className="text-xs text-muted-foreground font-medium">{u.email}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleOpenEdit(u)}
                            className="p-2 rounded-xl bg-secondary hover:bg-primary hover:text-white text-muted-foreground transition-colors"
                            title="Modifier ce collaborateur"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          {u.id !== currentUser?.id && (
                            <button
                              onClick={() => setDeletingUser(u)}
                              className="p-2 rounded-xl bg-secondary hover:bg-red-600 hover:text-white text-red-500 transition-colors"
                              title="Supprimer ce collaborateur"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="p-3 rounded-2xl bg-secondary/50 space-y-2.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground font-medium">Statut Compte :</span>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                            isAdmin 
                              ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20' 
                              : 'bg-blue-500/10 text-blue-600 border border-blue-500/20'
                          }`}>
                            {isAdmin ? '⭐ Administrateur' : 'COLLABORATEUR'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground font-medium">Onglets Visibles :</span>
                          <span className="font-extrabold text-primary bg-primary/10 px-2 py-0.5 rounded-lg">
                            {isAdmin ? 'Tous les 10 onglets' : `${effectiveTabs.length} sur 10 onglets`}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground font-medium">Entrepôt Rattaché :</span>
                          <span className="font-bold text-foreground truncate max-w-[140px]">
                            {u.warehouse_name || 'Tous les entrepôts'}
                          </span>
                        </div>
                      </div>

                      {/* Badges des onglets cochés */}
                      {!isAdmin && (
                        <div className="space-y-1">
                          <span className="text-[10px] font-extrabold text-muted-foreground uppercase">Accès autorisés :</span>
                          <div className="flex flex-wrap gap-1">
                            {APP_TABS.map(tab => {
                              const hasAccess = effectiveTabs.includes(tab.id);
                              if (!hasAccess) return null;
                              return (
                                <span key={tab.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary border border-border text-[10px] font-bold text-foreground">
                                  <span>✓ {tab.label.split(' ')[0]}</span>
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Activation Toggle Row */}
                    <div className="pt-3 border-t border-border flex items-center justify-between">
                      <span className={`text-[11px] font-bold ${isActive ? 'text-emerald-600' : 'text-red-500'}`}>
                        {isActive ? '● Accès Autorisé' : '✕ Compte Suspendu'}
                      </span>

                      {u.id !== currentUser?.id && (
                        <button
                          onClick={() => handleToggleUserActive(u)}
                          className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                            isActive
                              ? 'bg-red-500/10 text-red-600 hover:bg-red-500/20 border border-red-500/20'
                              : 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border border-emerald-500/20'
                          }`}
                        >
                          <Power className="w-3.5 h-3.5" />
                          <span>{isActive ? 'Suspendre' : 'Activer'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        /* Journal d'Audit Sub-Tab View */
        <div className="space-y-6">
          {/* KPI Cards Audit */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <div className="p-4 rounded-2xl bg-card border border-border">
              <span className="text-[10px] font-extrabold text-muted-foreground uppercase">Total Traces</span>
              <p className="text-xl font-black text-foreground mt-1">{auditSummary.total_logs}</p>
            </div>
            <div className="p-4 rounded-2xl bg-card border border-border">
              <span className="text-[10px] font-extrabold text-emerald-600 uppercase">Créations 🟢</span>
              <p className="text-xl font-black text-emerald-600 mt-1">{auditSummary.create_count}</p>
            </div>
            <div className="p-4 rounded-2xl bg-card border border-border">
              <span className="text-[10px] font-extrabold text-amber-500 uppercase">Modifications 🟡</span>
              <p className="text-xl font-black text-amber-500 mt-1">{auditSummary.update_count}</p>
            </div>
            <div className="p-4 rounded-2xl bg-card border border-border">
              <span className="text-[10px] font-extrabold text-red-500 uppercase">Suppressions 🔴</span>
              <p className="text-xl font-black text-red-500 mt-1">{auditSummary.delete_count}</p>
            </div>
            <div className="p-4 rounded-2xl bg-card border border-border">
              <span className="text-[10px] font-extrabold text-purple-600 uppercase">Connexions 🔑</span>
              <p className="text-xl font-black text-purple-600 mt-1">{auditSummary.auth_count}</p>
            </div>
          </div>

          {/* Filter Toolbar Audit */}
          <div className="p-4 rounded-3xl bg-card border border-border flex flex-col md:flex-row items-center gap-4">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadAuditData()}
                placeholder="Rechercher par employé, description ou action..."
                className="w-full pl-10 pr-4 py-2 bg-secondary border border-border rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <Filter className="w-4 h-4 text-primary flex-shrink-0" />
              <select
                value={auditActionFilter}
                onChange={(e) => setAuditActionFilter(e.target.value)}
                className="w-full md:w-auto px-3 py-2 bg-secondary border border-border rounded-xl text-xs font-bold focus:outline-none"
              >
                <option value="all">Toutes les actions</option>
                <option value="create">🟢 Créations</option>
                <option value="update">🟡 Modifications</option>
                <option value="delete">🔴 Suppressions</option>
                <option value="auth">🔑 Connexions / Sécurité</option>
                <option value="communication">📱 Communications & Reçus</option>
              </select>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <UserCheck className="w-4 h-4 text-primary flex-shrink-0" />
              <select
                value={auditUserFilter}
                onChange={(e) => setAuditUserFilter(e.target.value)}
                className="w-full md:w-auto px-3 py-2 bg-secondary border border-border rounded-xl text-xs font-bold focus:outline-none"
              >
                <option value="all">Tous les collaborateurs</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    👤 {u.name} ({u.email})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Audit Logs List Table */}
          {auditLoading ? (
            <div className="flex items-center justify-center min-h-[30vh]">
              <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-card border border-border space-y-3">
              <History className="w-12 h-12 text-muted-foreground mx-auto" />
              <h3 className="text-base font-bold text-foreground">Aucune trace d'audit enregistrée</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">Les actions effectuées par vos collaborateurs s'afficheront ici en temps réel.</p>
            </div>
          ) : (
            <div className="rounded-3xl bg-card border border-border shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-secondary/60 text-muted-foreground font-extrabold uppercase text-[10px] tracking-wider border-b border-border">
                    <tr>
                      <th className="p-4">Date & Heure</th>
                      <th className="p-4">Collaborateur (Auteur)</th>
                      <th className="p-4">Type d'Action</th>
                      <th className="p-4">Description Détaillée</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border font-medium">
                    {auditLogs.map((log) => {
                      let badgeStyle = 'bg-blue-500/10 text-blue-600 border-blue-500/20';
                      let icon = '⚡ ACTION';
                      if (log.action_type === 'create') {
                        badgeStyle = 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
                        icon = '🟢 CRÉATION';
                      } else if (log.action_type === 'update') {
                        badgeStyle = 'bg-amber-500/10 text-amber-600 border-amber-500/20';
                        icon = '🟡 MODIFICATION';
                      } else if (log.action_type === 'delete') {
                        badgeStyle = 'bg-red-500/10 text-red-600 border-red-500/20';
                        icon = '🔴 SUPPRESSION';
                      } else if (log.action_type === 'auth') {
                        badgeStyle = 'bg-purple-500/10 text-purple-600 border-purple-500/20';
                        icon = '🔑 CONNEXION';
                      } else if (log.action_type === 'communication') {
                        badgeStyle = 'bg-emerald-600/10 text-emerald-600 border-emerald-600/20';
                        icon = '📱 WHATSAPP';
                      }

                      return (
                        <tr key={log.id} className="hover:bg-secondary/30 transition-colors">
                          <td className="p-4 text-muted-foreground font-bold whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-primary" />
                              <span>{formatDateTime(log.created_at)}</span>
                            </div>
                          </td>
                          <td className="p-4 whitespace-nowrap">
                            <div className="font-extrabold text-foreground">{log.user_name}</div>
                            <div className="text-[10px] text-muted-foreground font-normal">{log.user_email}</div>
                          </td>
                          <td className="p-4 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold border ${badgeStyle}`}>
                              <span>{icon}</span>
                            </span>
                          </td>
                          <td className="p-4 font-bold text-foreground">
                            {log.description}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal Création Collaborateur avec Cases à cocher des Onglets */}
      {isCreateModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card border border-border rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-5 my-8 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h2 className="text-lg font-extrabold flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-primary" />
                <span>Nouveau Collaborateur & Droits d'Onglets</span>
              </h2>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded-lg hover:bg-secondary text-muted-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-semibold">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-5 text-xs overflow-y-auto pr-1 flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold mb-1">Nom Complet *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Mamadou Diallo"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-secondary border border-border rounded-xl font-bold"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">Adresse Email *</label>
                  <input
                    type="email"
                    required
                    placeholder="Ex: mamadou@cargonotify.sn"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-secondary border border-border rounded-xl font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold mb-1">Mot de passe de connexion *</label>
                  <input
                    type="password"
                    required
                    placeholder="Minimum 6 caractères"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-secondary border border-border rounded-xl font-bold"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">Entrepôt Rattaché</label>
                  <select
                    value={selectedWarehouseId}
                    onChange={(e) => setSelectedWarehouseId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-secondary border border-border rounded-xl font-bold"
                  >
                    <option value="">Tous les entrepôts (Accès Général)</option>
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.city})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Système de coches direct pour les onglets */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <label className="font-extrabold text-sm text-foreground flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-primary" />
                    <span>Onglets autorisés pour ce collaborateur ({allowedTabs.length} sélectionnés)</span>
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setAllowedTabs(APP_TABS.map(t => t.id))}
                      className="text-[11px] text-primary hover:underline font-bold"
                    >
                      Tout cocher
                    </button>
                    <span className="text-muted-foreground">•</span>
                    <button
                      type="button"
                      onClick={() => setAllowedTabs([])}
                      className="text-[11px] text-destructive hover:underline font-bold"
                    >
                      Tout décocher
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-3 rounded-2xl bg-secondary/40 border border-border">
                  {APP_TABS.map(tab => {
                    const isChecked = allowedTabs.includes(tab.id);
                    const Icon = tab.icon;

                    return (
                      <label
                        key={tab.id}
                        onClick={() => handleToggleTabForCreate(tab.id)}
                        className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all select-none ${
                          isChecked 
                            ? 'bg-primary/10 border-primary text-primary font-bold shadow-sm' 
                            : 'bg-card border-border hover:bg-secondary text-muted-foreground'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="mt-0.5 rounded border-border text-primary focus:ring-primary h-4 w-4"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                            <Icon className="w-4 h-4 text-primary flex-shrink-0" />
                            <span>{tab.label}</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground font-normal leading-tight mt-0.5">
                            {tab.desc}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold hover:bg-secondary"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs shadow hover:bg-primary/90 disabled:opacity-50"
                >
                  {submitting ? 'Création...' : 'Créer le Compte'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Modification Collaborateur avec Cases à cocher */}
      {editingUser && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card border border-border rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-5 my-8 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h2 className="text-lg font-extrabold flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-primary" />
                <span>Modifier le Collaborateur & ses Droits</span>
              </h2>
              <button
                onClick={() => setEditingUser(null)}
                className="p-1 rounded-lg hover:bg-secondary text-muted-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditUser} className="space-y-5 text-xs overflow-y-auto pr-1 flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  <label className="block font-semibold mb-1">Adresse Email *</label>
                  <input
                    type="email"
                    required
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-secondary border border-border rounded-xl font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold mb-1">Entrepôt Rattaché</label>
                  <select
                    value={editWarehouseId}
                    onChange={(e) => setEditWarehouseId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-secondary border border-border rounded-xl font-bold"
                  >
                    <option value="">Tous les entrepôts (Accès Général)</option>
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.city})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1">Statut d'Activation du Compte</label>
                  <select
                    value={editIsActive ? 'true' : 'false'}
                    onChange={(e) => setEditIsActive(e.target.value === 'true')}
                    className="w-full px-3.5 py-2.5 bg-secondary border border-border rounded-xl font-bold"
                  >
                    <option value="true">🟢 Compte Actif (Accès Autorisé)</option>
                    <option value="false">🔴 Compte Suspendu (Accès Bloqué)</option>
                  </select>
                </div>
              </div>

              {/* Système de coches direct pour les onglets en édition */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <label className="font-extrabold text-sm text-foreground flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-primary" />
                    <span>Onglets autorisés pour ce collaborateur ({editAllowedTabs.length} sélectionnés)</span>
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditAllowedTabs(APP_TABS.map(t => t.id))}
                      className="text-[11px] text-primary hover:underline font-bold"
                    >
                      Tout cocher
                    </button>
                    <span className="text-muted-foreground">•</span>
                    <button
                      type="button"
                      onClick={() => setEditAllowedTabs([])}
                      className="text-[11px] text-destructive hover:underline font-bold"
                    >
                      Tout décocher
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-3 rounded-2xl bg-secondary/40 border border-border">
                  {APP_TABS.map(tab => {
                    const isChecked = editAllowedTabs.includes(tab.id);
                    const Icon = tab.icon;

                    return (
                      <label
                        key={tab.id}
                        onClick={() => handleToggleTabForEdit(tab.id)}
                        className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all select-none ${
                          isChecked 
                            ? 'bg-primary/10 border-primary text-primary font-bold shadow-sm' 
                            : 'bg-card border-border hover:bg-secondary text-muted-foreground'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="mt-0.5 rounded border-border text-primary focus:ring-primary h-4 w-4"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                            <Icon className="w-4 h-4 text-primary flex-shrink-0" />
                            <span>{tab.label}</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground font-normal leading-tight mt-0.5">
                            {tab.desc}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Réinitialiser le Mot de passe (Optionnel)</label>
                <input
                  type="password"
                  placeholder="Laissez vide pour conserver le mot de passe actuel"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-secondary border border-border rounded-xl font-bold"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold hover:bg-secondary"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold shadow hover:bg-primary/90 disabled:opacity-50"
                >
                  {editSubmitting ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Confirmation Suppression Collaborateur */}
      {deletingUser && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-red-500/10 text-red-500 flex-shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-foreground">Supprimer l'Utilisateur</h3>
                <p className="text-xs text-muted-foreground">Confirmation de suppression du compte</p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Êtes-vous sûr de vouloir supprimer le compte de <strong className="text-foreground">{deletingUser.name}</strong> ({deletingUser.email}) ?
            </p>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
              <button
                type="button"
                onClick={() => setDeletingUser(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold hover:bg-secondary transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteUser}
                disabled={isDeleting}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-md shadow-red-600/20 flex items-center gap-2 transition-all disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isDeleting ? 'Suppression...' : 'Supprimer Définitivement'}</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
