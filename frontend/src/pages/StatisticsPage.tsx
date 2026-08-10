import React, { useEffect, useState } from 'react';
import api from '../lib/api';
import { formatFCFA } from '../lib/utils';
import { 
  BarChart3, 
  Calendar, 
  Filter, 
  Users, 
  Package, 
  Container as ContainerIcon, 
  CreditCard, 
  CheckCircle2, 
  AlertTriangle, 
  MessageSquare,
  TrendingUp,
  Boxes,
  FileCheck2,
  DollarSign
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  CartesianGrid, 
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts';

interface StatsSummary {
  total_clients: number;
  period_clients: number;
  total_lots: number;
  total_cbm: number;
  total_revenue: number;
  paid_count: number;
  unpaid_count: number;
  paid_revenue: number;
  unpaid_revenue: number;
  receipts_count: number;
  total_collected: number;
  total_due: number;
  total_containers: number;
  in_transit_count: number;
  arrived_count: number;
  closed_count: number;
  whatsapp_sent: number;
}

interface MonthlyChartItem {
  month_num: number;
  month_name: string;
  revenue: number;
  collected: number;
  volume_cbm: number;
}

const MONTH_OPTIONS = [
  { id: 'all', label: ' Tous les mois' },
  { id: '1', label: 'Janvier' },
  { id: '2', label: 'Février' },
  { id: '3', label: 'Mars' },
  { id: '4', label: 'Avril' },
  { id: '5', label: 'Mai' },
  { id: '6', label: 'Juin' },
  { id: '7', label: 'Juillet' },
  { id: '8', label: 'Août' },
  { id: '9', label: 'Septembre' },
  { id: '10', label: 'Octobre' },
  { id: '11', label: 'Novembre' },
  { id: '12', label: 'Décembre' }
];

export const StatisticsPage: React.FC = () => {
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [availableYears, setAvailableYears] = useState<number[]>([new Date().getFullYear()]);
  const [summary, setSummary] = useState<StatsSummary | null>(null);
  const [monthlyChart, setMonthlyChart] = useState<MonthlyChartItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        setLoading(true);
        const res = await api.get(`/stats/advanced?year=${selectedYear}&month=${selectedMonth}`);
        setSummary(res.data.summary);
        setMonthlyChart(res.data.monthly_chart || []);
        if (res.data.available_years && Array.isArray(res.data.available_years)) {
          setAvailableYears(res.data.available_years);
        }
      } catch (err) {
        console.error('Erreur chargement statistiques:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, [selectedYear, selectedMonth]);

  if (loading && !summary) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  // Données pour le Pie Chart des Dossiers
  const pieData = [
    { name: 'Dossiers Soldés (À jour)', value: summary?.paid_count || 0, color: '#10B981' },
    { name: 'Dossiers Impayés / En attente', value: summary?.unpaid_count || 0, color: '#EF4444' }
  ];

  return (
    <div className="space-y-8">
      {/* Header & Filtres */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight flex items-center gap-2">
            <BarChart3 className="w-8 h-8 text-primary" />
            <span>Statistiques & Bilans d'Activité</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Analyses approfondies du portefeuille clients, du volume CBM, des encaissements et des conteneurs.</p>
        </div>

        {/* Filtres d'Année et de Mois */}
        <div className="flex flex-wrap lg:flex-nowrap items-center gap-2.5 flex-shrink-0">
          <div className="flex items-center gap-2 px-3.5 py-2.5 bg-card border border-border rounded-2xl shadow-sm flex-shrink-0">
            <Calendar className="w-4 h-4 text-primary" />
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="bg-transparent font-extrabold text-xs sm:text-sm text-foreground focus:outline-none cursor-pointer"
            >
              <option value="all"> Toutes les années</option>
              {availableYears.map(y => (
                <option key={y} value={String(y)}>
                   Année {y}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 px-3.5 py-2.5 bg-card border border-border rounded-2xl shadow-sm flex-shrink-0">
            <Filter className="w-4 h-4 text-primary" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent font-extrabold text-xs sm:text-sm text-foreground focus:outline-none cursor-pointer"
            >
              {MONTH_OPTIONS.map(m => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Grille des KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Clients */}
        <div className="p-4 rounded-3xl bg-card border border-border shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] font-extrabold uppercase">Clients Inscrits</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-xl font-black text-foreground">{summary?.period_clients || 0}</p>
            <p className="text-[10px] text-muted-foreground font-semibold mt-0.5">Total général : {summary?.total_clients || 0}</p>
          </div>
        </div>

        {/* Lots Clients & CBM */}
        <div className="p-4 rounded-3xl bg-card border border-border shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] font-extrabold uppercase">Lots & Colis</span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-xl font-black text-foreground">{summary?.total_lots || 0} lots</p>
            <p className="text-[10px] text-muted-foreground font-semibold mt-0.5">{summary?.total_cbm?.toFixed(2) || 0} CBM</p>
          </div>
        </div>

        {/* Conteneurs */}
        <div className="p-4 rounded-3xl bg-card border border-border shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] font-extrabold uppercase">Conteneurs</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
              <ContainerIcon className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-xl font-black text-foreground">{summary?.total_containers || 0}</p>
            <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">{summary?.closed_count || 0} clôturés</p>
          </div>
        </div>

        {/* Reçus Délivrés */}
        <div className="p-4 rounded-3xl bg-card border border-border shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] font-extrabold uppercase">Reçus Délivrés</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
              <FileCheck2 className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-xl font-black text-emerald-600">{summary?.receipts_count || 0}</p>
            <p className="text-[10px] text-muted-foreground font-semibold mt-0.5">Reçus PDF émis</p>
          </div>
        </div>

        {/* Dossiers Soldés vs Impayés */}
        <div className="p-4 rounded-3xl bg-card border border-border shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] font-extrabold uppercase">Dossiers Soldés</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-xl font-black text-foreground">{summary?.paid_count || 0} / {summary?.total_lots || 0}</p>
            <p className="text-[10px] text-red-500 font-semibold mt-0.5">{summary?.unpaid_count || 0} en attente</p>
          </div>
        </div>

        {/* Notifications WhatsApp */}
        <div className="p-4 rounded-3xl bg-card border border-border shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] font-extrabold uppercase">WhatsApp Envoyés</span>
            <div className="p-2 rounded-xl bg-emerald-600/10 text-emerald-600">
              <MessageSquare className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-xl font-black text-foreground">{summary?.whatsapp_sent || 0}</p>
            <p className="text-[10px] text-muted-foreground font-semibold mt-0.5">Relances logistiques</p>
          </div>
        </div>
      </div>

      {/* Cartes financières récapitulatives sur la période */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 rounded-3xl bg-card border border-border shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider">Chiffre d'Affaires Facturé</span>
            <p className="text-2xl font-black text-foreground mt-1">{formatFCFA(summary?.total_revenue)}</p>
            <p className="text-xs text-muted-foreground mt-1 font-semibold">Total général des lots sur la période</p>
          </div>
          <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-600">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        <div className="p-6 rounded-3xl bg-card border border-border shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-extrabold text-emerald-600 uppercase tracking-wider">Règlements Encaissés</span>
            <p className="text-2xl font-black text-emerald-600 mt-1">{formatFCFA(summary?.total_collected)}</p>
            <p className="text-xs text-muted-foreground mt-1 font-semibold">Total réels encaissés en caisse</p>
          </div>
          <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-600">
            <CreditCard className="w-6 h-6" />
          </div>
        </div>

        <div className="p-6 rounded-3xl bg-card border border-border shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-extrabold text-amber-500 uppercase tracking-wider">Reste à Recouvrer</span>
            <p className="text-2xl font-black text-amber-500 mt-1">{formatFCFA(summary?.total_due)}</p>
            <p className="text-xs text-muted-foreground mt-1 font-semibold">Factures clients non soldées</p>
          </div>
          <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-500">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Graphiques Recharts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Histogramme 12 Mois (Chiffre d'affaires vs Encaissé) */}
        <div className="lg:col-span-2 p-6 rounded-3xl bg-card border border-border shadow-sm space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-base font-extrabold text-foreground">Évolution Mensuelle : Chiffre d'Affaires vs Encaissements</h2>
              <p className="text-xs text-muted-foreground">Comparatif entre le montant total facturé et les encaissements réels</p>
            </div>
          </div>

          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyChart} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="month_name" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(val: any) => formatFCFA(val)} />
                <Bar dataKey="revenue" name="Chiffre d'Affaires Facturé" fill="#2563EB" radius={[6, 6, 0, 0]} />
                <Bar dataKey="collected" name="Montant Encaisse" fill="#16A34A" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Camembert (Pie Chart) de Répartition des Dossiers */}
        <div className="p-6 rounded-3xl bg-card border border-border shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <h2 className="text-base font-extrabold text-foreground">Statut des Dossiers Clients</h2>
            <p className="text-xs text-muted-foreground">Proportion des lots soldés par rapport aux impayés</p>
          </div>

          <div className="h-60 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-2 pt-2 border-t border-border text-xs font-semibold">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-emerald-600">
                <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                Dossiers Soldés (À jour) :
              </span>
              <span className="font-extrabold text-foreground">{summary?.paid_count || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-red-500">
                <span className="w-3 h-3 rounded-full bg-red-500"></span>
                Dossiers Impayés :
              </span>
              <span className="font-extrabold text-foreground">{summary?.unpaid_count || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Graphique de Volume CBM Traité par Mois */}
      <div className="p-6 rounded-3xl bg-card border border-border shadow-sm space-y-4">
        <div>
          <h2 className="text-base font-extrabold text-foreground">Volume Logistique Traité (CBM) par Mois</h2>
          <p className="text-xs text-muted-foreground">Suivi du volume de marchandises réceptionné en entrepôt</p>
        </div>

        <div className="h-64 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyChart} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="month_name" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v) => `${v} CBM`} tick={{ fontSize: 11 }} />
              <Tooltip 
                formatter={(val: any) => `${parseFloat(val).toFixed(2)} CBM`}
                labelFormatter={(label) => `Mois de ${label}`}
              />
              <Bar dataKey="volume_cbm" name="Volume (CBM)" fill="#8B5CF6" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
