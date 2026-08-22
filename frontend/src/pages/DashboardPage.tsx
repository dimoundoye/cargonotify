import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { DashboardStats, ContainerProfitability, Container } from '../types';
import { formatFCFA, formatDate } from '../lib/utils';
import { 
  TrendingUp, 
  DollarSign, 
  Container as ContainerIcon, 
  Users, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  PlusCircle, 
  MessageSquare,
  ArrowUpRight,
  Calendar,
  Wallet
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

export const DashboardPage: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [profitability, setProfitability] = useState<ContainerProfitability[]>([]);
  const [recentContainers, setRecentContainers] = useState<Container[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [availableYears, setAvailableYears] = useState<number[]>([new Date().getFullYear()]);
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();

  useEffect(() => {
    async function loadDashboardData() {
      try {
        setLoading(true);
        const res = await api.get(`/dashboard?year=${selectedYear}`);
        setStats(res.data.stats);
        setProfitability(res.data.container_profitability || []);
        setRecentContainers(res.data.recent_containers || []);
        if (res.data.available_years && Array.isArray(res.data.available_years)) {
          setAvailableYears(res.data.available_years);
        }
      } catch (err) {
        console.error('Erreur chargement dashboard:', err);
      } finally {
        setLoading(false);
      }
    }
    loadDashboardData();
  }, [selectedYear]);

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight">Tableau de Bord Analytics</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Vue d'ensemble de la rentabilité nette et du suivi des conteneurs par exercice comptable.</p>
        </div>

        <div className="flex flex-wrap lg:flex-nowrap items-center gap-2 sm:gap-3 flex-shrink-0">
          {/* Sélecteur d'Année Comptable */}
          <div className="flex items-center gap-2 px-3 py-2 bg-card border border-border rounded-xl shadow-sm flex-shrink-0 whitespace-nowrap">
            <Calendar className="w-4 h-4 text-primary" />
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="bg-transparent font-extrabold text-xs sm:text-sm text-foreground focus:outline-none cursor-pointer"
            >
              <option value="all"> Toutes les années (Global)</option>
              {availableYears.map(y => (
                <option key={y} value={String(y)}>
                   Année {y}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => navigate('/containers')}
            className="flex-shrink-0 whitespace-nowrap flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs sm:text-sm shadow-md hover:bg-primary/90 transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Nouveau Conteneur</span>
          </button>

          <button
            onClick={() => navigate('/whatsapp')}
            className="flex-shrink-0 whitespace-nowrap flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs sm:text-sm shadow-md hover:bg-emerald-500 transition-all"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Notifications WhatsApp</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-5">
        {/* CA Total */}
        <div className="p-3.5 sm:p-5 rounded-2xl bg-card border border-border shadow-sm flex flex-col justify-between">
          <div className="flex items-start justify-between gap-1 mb-2 sm:mb-4">
            <span className="text-[10px] sm:text-xs font-extrabold text-muted-foreground uppercase tracking-wider leading-tight">Chiffre d'Affaires</span>
            <div className="p-1.5 sm:p-2.5 rounded-xl bg-blue-500/10 text-blue-600 flex-shrink-0">
              <DollarSign className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div>
            <p className="text-sm sm:text-xl font-black text-foreground truncate">{formatFCFA(stats?.total_revenue)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5 hidden sm:block">Sur l'ensemble des lots</p>
          </div>
        </div>

        {/* Total Encaissé */}
        <div className="p-3.5 sm:p-5 rounded-2xl bg-card border border-border shadow-sm flex flex-col justify-between">
          <div className="flex items-start justify-between gap-1 mb-2 sm:mb-4">
            <span className="text-[10px] sm:text-xs font-extrabold text-muted-foreground uppercase tracking-wider leading-tight">Total Encaissé</span>
            <div className="p-1.5 sm:p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600 flex-shrink-0">
              <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div>
            <p className="text-sm sm:text-xl font-black text-foreground truncate">{formatFCFA(stats?.total_collected)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5 hidden sm:block">Règlements reçus</p>
          </div>
        </div>

        {/* Solde (Encaissé - Dépenses) */}
        <div className="p-3.5 sm:p-5 rounded-2xl bg-card border border-border shadow-sm flex flex-col justify-between">
          <div className="flex items-start justify-between gap-1 mb-2 sm:mb-4">
            <span className="text-[10px] sm:text-xs font-extrabold text-teal-600 uppercase tracking-wider leading-tight">Solde Net</span>
            <div className="p-1.5 sm:p-2.5 rounded-xl bg-teal-500/10 text-teal-600 flex-shrink-0">
              <Wallet className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div>
            <p className={`text-sm sm:text-xl font-black truncate ${(stats?.net_cash_balance ?? 0) >= 0 ? 'text-teal-600 dark:text-teal-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {formatFCFA(stats?.net_cash_balance)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5 hidden sm:block">Encaissé − Dépenses d'exploitation</p>
          </div>
        </div>

        {/* Reste à Recouvrer */}
        <div className="p-3.5 sm:p-5 rounded-2xl bg-card border border-border shadow-sm flex flex-col justify-between">
          <div className="flex items-start justify-between gap-1 mb-2 sm:mb-4">
            <span className="text-[10px] sm:text-xs font-extrabold text-amber-600 uppercase tracking-wider leading-tight">Reste à Recouvrer</span>
            <div className="p-1.5 sm:p-2.5 rounded-xl bg-amber-500/10 text-amber-600 flex-shrink-0">
              <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div>
            <p className="text-sm sm:text-xl font-black text-amber-600 dark:text-amber-400 truncate">{formatFCFA(stats?.total_due)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5 hidden sm:block">En attente de solde</p>
          </div>
        </div>

        {/* Bénéfice Net */}
        <div className="col-span-2 sm:col-span-1 p-3.5 sm:p-5 rounded-2xl bg-card border border-border shadow-sm flex flex-col justify-between">
          <div className="flex items-start justify-between gap-1 mb-2 sm:mb-4">
            <span className="text-[10px] sm:text-xs font-extrabold text-emerald-600 uppercase tracking-wider leading-tight">Bénéfice Net</span>
            <div className="p-1.5 sm:p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 flex-shrink-0">
              <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div>
            <p className="text-sm sm:text-xl font-black text-emerald-600 dark:text-emerald-400 truncate">{formatFCFA(stats?.net_profit)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5 hidden sm:block">CA − Dépenses totales</p>
          </div>
        </div>
      </div>

      {/* Conteneurs Stats Summary — 2 par ligne sur Mobile */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-5">
        <div className="p-3.5 sm:p-5 rounded-2xl bg-card border border-border flex items-center gap-3">
          <div className="p-2 sm:p-3 rounded-xl bg-amber-500/10 text-amber-600 flex-shrink-0">
            <Clock className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <p className="text-[10px] sm:text-xs text-muted-foreground font-semibold">En Transit</p>
            <p className="text-base sm:text-xl font-extrabold">{stats?.in_transit_count || 0}</p>
          </div>
        </div>

        <div className="p-3.5 sm:p-5 rounded-2xl bg-card border border-border flex items-center gap-3">
          <div className="p-2 sm:p-3 rounded-xl bg-emerald-500/10 text-emerald-600 flex-shrink-0">
            <ContainerIcon className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <p className="text-[10px] sm:text-xs text-muted-foreground font-semibold">Arrivés au Port</p>
            <p className="text-base sm:text-xl font-extrabold">{stats?.arrived_count || 0}</p>
          </div>
        </div>

        <div className="col-span-2 md:col-span-1 p-3.5 sm:p-5 rounded-2xl bg-card border border-border flex items-center gap-3">
          <div className="p-2 sm:p-3 rounded-xl bg-blue-500/10 text-blue-600 flex-shrink-0">
            <Users className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <p className="text-[10px] sm:text-xs text-muted-foreground font-semibold">Clients Enregistrés</p>
            <p className="text-base sm:text-xl font-extrabold">{stats?.total_clients || 0}</p>
          </div>
        </div>
      </div>

      {/* Chart Section */}
      <div className="p-4 sm:p-6 rounded-2xl bg-card border border-border shadow-sm space-y-4">
        <div>
          <h2 className="text-base sm:text-lg font-extrabold">Analyse de Rentabilité Nette par Conteneur</h2>
          <p className="text-xs text-muted-foreground">Comparatif Revenus bruts vs Coûts vs Marge Nette</p>
        </div>

        <div className="h-64 sm:h-72 w-full pt-2">
          {profitability.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={profitability} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="container_number" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value: any) => formatFCFA(value)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="container_revenue" name="Revenu Brut" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="container_costs" name="Coûts Totaux" fill="#EF4444" radius={[4, 4, 0, 0]} />
                <Bar dataKey="net_profit" name="Bénéfice Net" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              Aucun conteneur à afficher.
            </div>
          )}
        </div>
      </div>

      {/* Recent Containers List */}
      <div className="p-4 sm:p-6 rounded-2xl bg-card border border-border shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-extrabold">Derniers Conteneurs Traités</h2>
          <button
            onClick={() => navigate('/containers')}
            className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
          >
            <span>Voir tous</span>
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="border-b border-border text-[10px] sm:text-xs text-muted-foreground uppercase bg-secondary/50">
              <tr>
                <th className="p-2 sm:p-3">N° Conteneur</th>
                <th className="p-2 sm:p-3">Provenance</th>
                <th className="p-2 sm:p-3">Statut</th>
                <th className="p-2 sm:p-3">Lots</th>
                <th className="p-2 sm:p-3">Chiffre d'Affaires</th>
                <th className="p-2 sm:p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {recentContainers.map((container) => (
                <tr key={container.id} className="hover:bg-secondary/30 transition-colors">
                  <td className="p-2 sm:p-3 font-bold text-foreground">{container.container_number}</td>
                  <td className="p-2 sm:p-3">{container.origin}</td>
                  <td className="p-2 sm:p-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold ${
                      container.status === 'arrived' 
                        ? 'bg-emerald-500/10 text-emerald-600'
                        : container.status === 'in_transit'
                        ? 'bg-amber-500/10 text-amber-600'
                        : 'bg-slate-500/10 text-slate-600'
                    }`}>
                      {container.status === 'arrived' ? 'Arrivé' : container.status === 'in_transit' ? 'En Transit' : 'Clôturé'}
                    </span>
                  </td>
                  <td className="p-2 sm:p-3">{container.lots_count || 0}</td>
                  <td className="p-2 sm:p-3 font-semibold">{formatFCFA(container.revenue)}</td>
                  <td className="p-2 sm:p-3 text-right">
                    <button
                      onClick={() => navigate(`/containers/${container.id}`)}
                      className="px-2.5 py-1 rounded-lg bg-secondary text-secondary-foreground text-xs font-medium hover:bg-primary hover:text-white transition-colors"
                    >
                      Détails
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
