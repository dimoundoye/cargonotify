import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';

import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { StatisticsPage } from './pages/StatisticsPage';
import { ContainersPage } from './pages/ContainersPage';
import { ContainerDetailPage } from './pages/ContainerDetailPage';
import { LotsPage } from './pages/LotsPage';
import { ClientsPage } from './pages/ClientsPage';
import { UsersPage } from './pages/UsersPage';
import { PaymentsPage } from './pages/PaymentsPage';
import { ExpensesPage } from './pages/ExpensesPage';
import { WhatsAppPage } from './pages/WhatsAppPage';
import { PricingPage } from './pages/PricingPage';
import { SettingsPage } from './pages/SettingsPage';
import { PlatformAdminPage } from './pages/PlatformAdminPage';
import { ScannerQRPage } from './pages/ScannerQRPage';

const queryClient = new QueryClient();

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// Route Guard strict pour l'isolation totale entre le Propriétaire (Super Admin) et les Clients
const RoleGuard: React.FC<{ allowedRoles: string[]; path?: string; children: React.ReactNode }> = ({ allowedRoles, path, children }) => {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // 🛡️ Si le Super Admin tente d'accéder à l'espace opérationnel d'un client, le rediriger vers sa Console SaaS
  if (user.role === 'super_admin' && !allowedRoles.includes('super_admin')) {
    return <Navigate to="/platform-admin" replace />;
  }

  // 🛡️ Si un utilisateur client tente d'accéder au portail Super Admin, le rediriger vers son Dashboard
  if (user.role !== 'super_admin' && allowedRoles.includes('super_admin')) {
    return <Navigate to="/dashboard" replace />;
  }

  // Si l'utilisateur est administrateur de l'entreprise client
  if (user.role === 'admin') {
    return <>{children}</>;
  }

  // Vérification par onglets autorisés sur-mesure si définis
  if (path && user.allowed_tabs && Array.isArray(user.allowed_tabs) && user.allowed_tabs.length > 0) {
    if (user.allowed_tabs.includes(path)) {
      return <>{children}</>;
    } else {
      return <Navigate to={user.allowed_tabs[0] || '/dashboard'} replace />;
    }
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to={user.role === 'super_admin' ? '/platform-admin' : '/dashboard'} replace />;
  }

  return <>{children}</>;
};

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* PORTAIL SUPER ADMIN / GESTIONNAIRE DE LA PLATEFORME SAAS (EXCLUSIF) */}
      <Route
        path="/platform-admin"
        element={
          <ProtectedRoute>
            <RoleGuard allowedRoles={['super_admin']}>
              <PlatformAdminPage />
            </RoleGuard>
          </ProtectedRoute>
        }
      />

      {/* PORTAIL DE L'APPLICATION CLIENT LOGISTIQUE (EXCLUSIF AUX COMPTES SOCIÉTÉS CLIENTS) */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            {user?.role === 'super_admin' ? (
              <Navigate to="/platform-admin" replace />
            ) : (
              <AppLayout />
            )}
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        
        {/* Tableau de bord client */}
        <Route 
          path="dashboard" 
          element={
            <RoleGuard allowedRoles={['admin', 'logistics', 'cashier', 'agent']} path="/dashboard">
              <DashboardPage />
            </RoleGuard>
          } 
        />

        {/* Statistiques & Bilans d'activité */}
        <Route 
          path="statistics" 
          element={
            <RoleGuard allowedRoles={['admin', 'logistics', 'cashier', 'agent']} path="/statistics">
              <StatisticsPage />
            </RoleGuard>
          } 
        />

        {/* Conteneurs */}
        <Route 
          path="containers" 
          element={
            <RoleGuard allowedRoles={['admin', 'logistics', 'agent']} path="/containers">
              <ContainersPage />
            </RoleGuard>
          } 
        />
        <Route 
          path="containers/:id" 
          element={
            <RoleGuard allowedRoles={['admin', 'logistics', 'agent']} path="/containers">
              <ContainerDetailPage />
            </RoleGuard>
          } 
        />

        {/* Lots Clients */}
        <Route 
          path="lots" 
          element={
            <RoleGuard allowedRoles={['admin', 'logistics', 'cashier']} path="/lots">
              <LotsPage />
            </RoleGuard>
          } 
        />

        {/* Tous les Clients */}
        <Route 
          path="clients" 
          element={
            <RoleGuard allowedRoles={['admin', 'logistics', 'cashier', 'agent']} path="/clients">
              <ClientsPage />
            </RoleGuard>
          } 
        />

        {/* Collaborateurs & Accès (Admin Client uniquement) */}
        <Route 
          path="collaborateurs" 
          element={
            <RoleGuard allowedRoles={['admin']} path="/collaborateurs">
              <UsersPage />
            </RoleGuard>
          } 
        />

        {/* Paiements & Reçus */}
        <Route 
          path="payments" 
          element={
            <RoleGuard allowedRoles={['admin', 'cashier']} path="/payments">
              <PaymentsPage />
            </RoleGuard>
          } 
        />

        {/* Scanner & Valider QR */}
        <Route 
          path="scan-qr" 
          element={
            <RoleGuard allowedRoles={['admin', 'logistics', 'cashier']} path="/scan-qr">
              <ScannerQRPage />
            </RoleGuard>
          } 
        />

        {/* Gestion des Dépenses */}
        <Route 
          path="expenses" 
          element={
            <RoleGuard allowedRoles={['admin', 'logistics', 'cashier']} path="/expenses">
              <ExpensesPage />
            </RoleGuard>
          } 
        />

        {/* Notifications WhatsApp */}
        <Route 
          path="whatsapp" 
          element={
            <RoleGuard allowedRoles={['admin', 'agent']} path="/whatsapp">
              <WhatsAppPage />
            </RoleGuard>
          } 
        />

        {/* Tarifs CBM */}
        <Route 
          path="pricing" 
          element={
            <RoleGuard allowedRoles={['admin']} path="/pricing">
              <PricingPage />
            </RoleGuard>
          } 
        />

        {/* Paramètres de l'entreprise client */}
        <Route 
          path="settings" 
          element={
            <RoleGuard allowedRoles={['admin']} path="/settings">
              <SettingsPage />
            </RoleGuard>
          } 
        />
      </Route>

      <Route 
        path="*" 
        element={
          <Navigate to={user?.role === 'super_admin' ? '/platform-admin' : '/dashboard'} replace />
        } 
      />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
