import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';
import { 
  LayoutDashboard, 
  Container, 
  Users, 
  Package, 
  CreditCard, 
  MessageSquare, 
  Sliders, 
  Settings,
  UserCheck,
  LogOut, 
  Ship, 
  Building2, 
  Sun, 
  Moon,
  Menu,
  X,
  Crown,
  BarChart3,
  Wallet,
  QrCode,
  ChevronLeft,
  ChevronRight,
  Download
} from 'lucide-react';

export const AppLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true';
  });
  const [deferredPrompt, setDeferredPrompt] = useState<any>(() => (window as any).deferredPwaPrompt || null);
  const [isStandalone, setIsStandalone] = useState<boolean>(() => {
    return window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
  });
  const [isInstalled, setIsInstalled] = useState<boolean>(false);

  useEffect(() => {
    // 🛡️ Détection si l'application est déjà lancée en mode PWA installée
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleDisplayModeChange = (e: MediaQueryListEvent) => setIsStandalone(e.matches);
    mediaQuery.addEventListener('change', handleDisplayModeChange);

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      (window as any).deferredPwaPrompt = e;
      setDeferredPrompt(e);
    };

    const handlePwaPromptReady = () => {
      if ((window as any).deferredPwaPrompt) {
        setDeferredPrompt((window as any).deferredPwaPrompt);
      }
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      (window as any).deferredPwaPrompt = null;
      setDeferredPrompt(null);
      toast.success("CargoNotify a été installée avec succès sur votre appareil !");
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('pwa-prompt-ready', handlePwaPromptReady);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      mediaQuery.removeEventListener('change', handleDisplayModeChange);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('pwa-prompt-ready', handlePwaPromptReady);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallPWA = async () => {
    if (isStandalone || isInstalled) {
      toast.success("L'application CargoNotify est déjà installée sur cet appareil.");
      return;
    }

    const activePrompt = deferredPrompt || (window as any).deferredPwaPrompt;

    if (!activePrompt) {
      toast.info(
        "Pour installer l'application : sur Chrome/Edge, cliquez sur le bouton d'installation dans la barre d'adresse. Sur iPhone (Safari), appuyez sur le bouton Partager ➔ 'Sur l'écran d'accueil'.",
        { duration: 6000 }
      );
      return;
    }

    try {
      activePrompt.prompt();
      const { outcome } = await activePrompt.userChoice;
      if (outcome === 'accepted') {
        (window as any).deferredPwaPrompt = null;
        setDeferredPrompt(null);
        setIsInstalled(true);
        toast.success("Installation de CargoNotify acceptée !");
      }
    } catch (err) {
      console.error("[PWA Install Error]", err);
    }
  };

  // 🛡️ Le Propriétaire de la Plateforme (Super Admin) n'a pas sa place dans le portail opérationnel client
  if (user?.role === 'super_admin') {
    return <Navigate to="/platform-admin" replace />;
  }

  const toggleTheme = () => {
    setDarkMode(!darkMode);
    document.documentElement.classList.toggle('dark');
  };

  const toggleSidebar = () => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sidebar_collapsed', String(next));
      return next;
    });
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { label: 'Tableau de bord', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Conteneurs', path: '/containers', icon: Container },
    { label: 'Lots Clients', path: '/lots', icon: Package },
    { label: 'Tous les Clients', path: '/clients', icon: Users },
    { label: 'Paiements & Reçus', path: '/payments', icon: CreditCard },
    { label: 'Gestion des Dépenses', path: '/expenses', icon: Wallet },
    { label: 'Collaborateurs & Accès', path: '/collaborateurs', icon: UserCheck },
    { label: 'Notifications WhatsApp', path: '/whatsapp', icon: MessageSquare },
    { label: 'Statistiques & Bilans', path: '/statistics', icon: BarChart3 },
    { label: 'Scanner & Valider QR', path: '/scan-qr', icon: QrCode },
    { label: 'Tarifs & Services CBM', path: '/pricing', icon: Sliders },
    { label: 'Paramètres', path: '/settings', icon: Settings },
  ];

  // Matrice de restriction d'accès au menu selon le rôle de l'utilisateur client
  const roleAccessMap: Record<string, string[]> = {
    admin: ['/dashboard', '/statistics', '/scan-qr', '/containers', '/lots', '/clients', '/payments', '/expenses', '/collaborateurs', '/whatsapp', '/pricing', '/settings'],
    logistics: ['/dashboard', '/statistics', '/scan-qr', '/containers', '/lots', '/clients', '/expenses'],
    cashier: ['/dashboard', '/statistics', '/scan-qr', '/lots', '/clients', '/payments', '/expenses'],
    agent: ['/dashboard', '/statistics', '/containers', '/clients', '/whatsapp']
  };

  const userRole = user?.role || 'admin';
  const defaultAllowedPaths = roleAccessMap[userRole] || roleAccessMap['admin'];
  const allowedPaths = (user?.allowed_tabs && Array.isArray(user.allowed_tabs) && user.allowed_tabs.length > 0)
    ? user.allowed_tabs
    : defaultAllowedPaths;
  const filteredNavItems = navItems.filter(item => allowedPaths.includes(item.path));

  const roleLabelMap: Record<string, string> = {
    super_admin: 'Propriétaire Plateforme (SaaS)',
    admin: 'Administrateur Entreprise',
    logistics: 'Logistique & Entrepôt',
    cashier: 'Agent de Caisse',
    agent: 'Agent WhatsApp'
  };

  return (
    <div className={`min-h-screen flex bg-background text-foreground ${darkMode ? 'dark' : ''}`}>
      {/* Sidebar Desktop Rétractable */}
      <aside className={`hidden md:flex flex-col border-r border-border bg-card shadow-sm fixed inset-y-0 z-30 transition-all duration-300 ${
        isSidebarCollapsed ? 'w-20' : 'w-64'
      }`}>
        <div className="p-4 flex items-center justify-between border-b border-border h-16">
          <div className="flex items-center gap-3 overflow-hidden">
            <img src="/favicon.svg" alt="CargoNotify" className="w-10 h-10 rounded-xl shadow-md shrink-0 object-cover" />
            {!isSidebarCollapsed && (
              <div className="min-w-0 transition-opacity duration-200">
                <h1 className="font-extrabold text-lg leading-tight tracking-tight text-primary truncate">CargoNotify</h1>
                <span className="text-xs text-muted-foreground font-semibold truncate block">Transit & Logistique</span>
              </div>
            )}
          </div>
          <button
            onClick={toggleSidebar}
            className="p-1.5 rounded-lg border border-border hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors shrink-0"
            title={isSidebarCollapsed ? "Déplier le menu" : "Réduire le menu"}
          >
            {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation Filtrée Dynamiquement selon le Rôle */}
        <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto scrollbar-none">
          {filteredNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                title={isSidebarCollapsed ? item.label : undefined}
                className={({ isActive }) =>
                  `flex items-center ${isSidebarCollapsed ? 'justify-center px-0' : 'px-3.5'} py-2.5 rounded-2xl font-bold text-sm transition-all duration-200 ${
                    isActive
                      ? 'bg-primary text-white shadow-md shadow-primary/20'
                      : 'text-[hsl(240_60%_25%)] dark:text-slate-300 hover:bg-secondary hover:text-primary'
                  }`
                }
              >
                <Icon className="w-5 h-5 shrink-0" />
                {!isSidebarCollapsed && <span className="ml-3 truncate">{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>

        {/* User Card */}
        <div className="p-3 border-t border-border bg-secondary/50 space-y-2">
          {userRole === 'super_admin' && (
            <NavLink
              to="/platform-admin"
              title={isSidebarCollapsed ? "Console SaaS Super Admin" : undefined}
              className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center p-2' : 'justify-center gap-2 px-3 py-2'} rounded-xl text-xs font-black bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors shadow-sm`}
            >
              <Crown className="w-4 h-4 shrink-0" />
              {!isSidebarCollapsed && <span>Console SaaS Super Admin</span>}
            </NavLink>
          )}

          <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
            <div 
              className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center font-extrabold text-sm shadow-sm shrink-0"
              title={isSidebarCollapsed ? user?.name || 'Admin' : undefined}
            >
              {user?.name?.charAt(0).toUpperCase() || 'A'}
            </div>
            {!isSidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-extrabold truncate text-foreground">{user?.name || 'Admin'}</p>
                <p className="text-[11px] text-muted-foreground truncate font-semibold">
                  {roleLabelMap[userRole] || 'Administrateur Entreprise'}
                </p>
              </div>
            )}
          </div>

          <button
            onClick={handleLogout}
            title={isSidebarCollapsed ? "Déconnexion" : undefined}
            className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center p-2' : 'justify-center gap-2 px-3 py-2'} rounded-xl text-xs font-semibold text-destructive hover:bg-destructive/10 transition-colors`}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!isSidebarCollapsed && <span>Déconnexion</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ${
        isSidebarCollapsed ? 'md:pl-20' : 'md:pl-64'
      } min-w-0`}>
        {/* Top Navbar */}
        <header className="h-16 border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-20 px-4 md:px-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)} 
              className="md:hidden p-2 rounded-lg hover:bg-secondary"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>

            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-secondary text-secondary-foreground text-xs font-semibold border border-border">
              <Building2 className="w-4 h-4 text-primary" />
              <span>Espace Gestion Logistique & Transit</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {!isStandalone && !isInstalled && (
              <button
                onClick={handleInstallPWA}
                className="flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-xl border border-primary/30 bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all text-xs font-bold shadow-sm"
                title="Installer l'application sur cet appareil"
              >
                <Download className="w-4 h-4 animate-bounce shrink-0" />
                <span className="text-[11px] sm:text-xs font-extrabold whitespace-nowrap">Installer l'App</span>
              </button>
            )}

            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-xl border border-border bg-card hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              title="Changer de thème"
            >
              {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>

            <div className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-bold bg-emerald-500/10 border-emerald-500/20 text-emerald-600">
              <span className="w-2 h-2 rounded-full animate-pulse bg-emerald-500"></span>
              <span>Système Opérationnel</span>
            </div>
          </div>
        </header>

        {/* Mobile Navigation Drawer Overlay (Affiche le menu à gauche en tiroir) */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex">
            {/* Backdrop sombre */}
            <div 
              className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity"
              onClick={() => setMobileMenuOpen(false)}
            />

            {/* Panneau latéral gauche (Drawer) */}
            <aside className="relative w-72 max-w-[85vw] bg-card border-r border-border flex flex-col h-full z-10 shadow-2xl overflow-y-auto">
              <div className="p-5 flex items-center justify-between border-b border-border">
                <div className="flex items-center gap-3">
                  <img src="/favicon.svg" alt="CargoNotify" className="w-10 h-10 rounded-xl shadow-md shrink-0 object-cover" />
                  <div>
                    <h1 className="font-extrabold text-lg leading-tight tracking-tight text-primary">CargoNotify</h1>
                    <span className="text-xs text-muted-foreground font-semibold">Transit & Logistique</span>
                  </div>
                </div>

                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 rounded-xl text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Liens de navigation */}
              <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                {filteredNavItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-sm transition-all duration-200 ${
                          isActive
                            ? 'bg-primary text-white shadow-md shadow-primary/20'
                            : 'text-[hsl(240_60%_25%)] dark:text-slate-300 hover:bg-secondary hover:text-primary'
                        }`
                      }
                    >
                      <Icon className="w-5 h-5" />
                      <span>{item.label}</span>
                    </NavLink>
                  );
                })}

                {!isStandalone && !isInstalled && (
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      handleInstallPWA();
                    }}
                    className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl font-extrabold text-xs bg-primary/10 text-primary border border-primary/20 hover:bg-primary hover:text-white transition-all shadow-sm"
                  >
                    <Download className="w-4 h-4 animate-bounce" />
                    <span>Installer l'App sur Mobile</span>
                  </button>
                )}
              </nav>

              {/* Carte Utilisateur Mobile */}
              <div className="p-4 border-t border-border bg-secondary/50 space-y-2.5">
                {userRole === 'super_admin' && (
                  <NavLink
                    to="/platform-admin"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-black bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors shadow-sm"
                  >
                    <Crown className="w-4 h-4" />
                    <span>Console SaaS Super Admin</span>
                  </NavLink>
                )}

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-extrabold text-base shadow-sm">
                    {user?.name?.charAt(0).toUpperCase() || 'A'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-extrabold truncate text-foreground">{user?.name || 'Admin'}</p>
                    <p className="text-[11px] text-muted-foreground truncate font-semibold">
                      {roleLabelMap[userRole] || 'Administrateur Entreprise'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleLogout();
                  }}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Déconnexion</span>
                </button>
              </div>
            </aside>
          </div>
        )}

        {/* View Body avec espacement de bas d'écran mobile généreux (Safe Area Clearance) */}
        <main className="flex-1 p-4 pb-16 sm:pb-20 md:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

