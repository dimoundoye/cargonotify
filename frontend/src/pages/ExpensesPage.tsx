import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../lib/api';
import { Expense, Container } from '../types';
import { formatFCFA, formatDate } from '../lib/utils';
import { 
  Receipt, 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  X, 
  AlertTriangle, 
  Filter, 
  Calendar, 
  Briefcase, 
  Truck, 
  Boxes, 
  Ship, 
  Building, 
  HelpCircle,
  DollarSign,
  Wallet,
  CheckCircle2
} from 'lucide-react';

const CATEGORY_OPTIONS = [
  { id: 'salary', label: '💼 Salaires des Employés', color: 'bg-purple-500/10 text-purple-600 border-purple-500/20', icon: Briefcase },
  { id: 'transport', label: '🚚 Frais de Transport & Livraisons', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20', icon: Truck },
  { id: 'handling', label: '📦 Manutention & Déchargement', color: 'bg-amber-500/10 text-amber-600 border-amber-500/20', icon: Boxes },
  { id: 'container', label: '🚢 Frais de Conteneur & Douane', color: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20', icon: Ship },
  { id: 'rent', label: '🏢 Loyer & Fonctionnement', color: 'bg-slate-500/10 text-slate-600 border-slate-500/20', icon: Building },
  { id: 'other', label: '⚠️ Autre (Imprévus & Divers)', color: 'bg-red-500/10 text-red-600 border-red-500/20', icon: HelpCircle }
];

export const ExpensesPage: React.FC = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [containers, setContainers] = useState<Container[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedContainerId, setSelectedContainerId] = useState('all');

  // Summary
  const [summary, setSummary] = useState({
    total_expenses: 0,
    salary_total: 0,
    transport_total: 0,
    handling_total: 0,
    container_expenses_total: 0,
    rent_total: 0,
    other_total: 0
  });

  // Modal Create / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('salary');
  const [amount, setAmount] = useState('');
  const [containerId, setContainerId] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modal Delete
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      let queryUrl = `/expenses?category=${selectedCategory}&container_id=${selectedContainerId}`;
      const [expRes, contRes] = await Promise.all([
        api.get(queryUrl),
        api.get('/containers')
      ]);
      setExpenses(expRes.data.expenses || []);
      setSummary(expRes.data.summary || {});
      setContainers(contRes.data.containers || []);
    } catch (err) {
      console.error('Erreur chargement dépenses:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedCategory, selectedContainerId]);

  const handleOpenCreate = () => {
    setEditingExpense(null);
    setTitle('');
    setCategory('salary');
    setAmount('');
    setContainerId('');
    setExpenseDate(new Date().toISOString().split('T')[0]);
    setNotes('');
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (exp: Expense) => {
    setEditingExpense(exp);
    setTitle(exp.title);
    setCategory(exp.category);
    setAmount(String(exp.amount));
    setContainerId(exp.container_id ? String(exp.container_id) : '');
    setExpenseDate(exp.expense_date ? exp.expense_date.split('T')[0] : new Date().toISOString().split('T')[0]);
    setNotes(exp.notes || '');
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const handleSubmitExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!title || !amount || parseFloat(amount) <= 0) {
      setErrorMsg('Veuillez renseigner un libellé et un montant valide.');
      return;
    }
    setSubmitting(true);

    try {
      const payload = {
        title,
        category,
        amount: parseFloat(amount),
        container_id: containerId ? parseInt(containerId, 10) : null,
        expense_date: expenseDate,
        notes
      };

      if (editingExpense) {
        await api.put(`/expenses/${editingExpense.id}`, payload);
      } else {
        await api.post('/expenses', payload);
      }

      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || 'Erreur lors de l\'enregistrement.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingExpense) return;
    setIsDeleting(true);
    try {
      await api.delete(`/expenses/${deletingExpense.id}`);
      setDeletingExpense(null);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erreur lors de la suppression.');
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredExpenses = expenses.filter(e =>
    e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (e.notes && e.notes.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (e.container_number && e.container_number.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight flex items-center gap-2">
            <Wallet className="w-8 h-8 text-primary" />
            <span>Gestion des Dépenses & Charges</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Consignez les salaires, transports, manutentions et imprévus déduits du bénéfice de l'entreprise.</p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs sm:text-sm shadow-md hover:bg-primary/90 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Nouvelle Dépense</span>
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="p-4 rounded-3xl bg-card border border-border shadow-sm space-y-2">
          <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider">Total Dépenses</span>
          <p className="text-xl font-black text-foreground">{formatFCFA(summary.total_expenses)}</p>
          <span className="text-[10px] text-muted-foreground font-semibold">Toutes catégories</span>
        </div>

        <div className="p-4 rounded-3xl bg-card border border-border shadow-sm space-y-2">
          <span className="text-[10px] font-extrabold text-purple-600 uppercase tracking-wider">Salaires Employés</span>
          <p className="text-xl font-black text-purple-600">{formatFCFA(summary.salary_total)}</p>
          <span className="text-[10px] text-muted-foreground font-semibold">Primes & rémunérations</span>
        </div>

        <div className="p-4 rounded-3xl bg-card border border-border shadow-sm space-y-2">
          <span className="text-[10px] font-extrabold text-blue-600 uppercase tracking-wider">Frais de Transport</span>
          <p className="text-xl font-black text-blue-600">{formatFCFA(summary.transport_total)}</p>
          <span className="text-[10px] text-muted-foreground font-semibold">Camionnage & courses</span>
        </div>

        <div className="p-4 rounded-3xl bg-card border border-border shadow-sm space-y-2">
          <span className="text-[10px] font-extrabold text-amber-600 uppercase tracking-wider">Manutention</span>
          <p className="text-xl font-black text-amber-600">{formatFCFA(summary.handling_total)}</p>
          <span className="text-[10px] text-muted-foreground font-semibold">Déchargement & dockers</span>
        </div>

        <div className="p-4 rounded-3xl bg-card border border-border shadow-sm space-y-2">
          <span className="text-[10px] font-extrabold text-red-500 uppercase tracking-wider">Imprévus & Autres</span>
          <p className="text-xl font-black text-red-500">{formatFCFA(summary.other_total + summary.rent_total)}</p>
          <span className="text-[10px] text-muted-foreground font-semibold">Urgences & fonctionnement</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-3xl bg-card border border-border flex flex-col md:flex-row items-center gap-4">
        {/* Search */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher par libellé, conteneur ou remarques..."
            className="w-full pl-10 pr-4 py-2 bg-secondary border border-border rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Filter Category */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter className="w-4 h-4 text-primary flex-shrink-0" />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full md:w-auto px-3 py-2 bg-secondary border border-border rounded-xl text-xs font-bold focus:outline-none"
          >
            <option value="all">Toutes les catégories</option>
            {CATEGORY_OPTIONS.map(c => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        {/* Filter Container */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Ship className="w-4 h-4 text-primary flex-shrink-0" />
          <select
            value={selectedContainerId}
            onChange={(e) => setSelectedContainerId(e.target.value)}
            className="w-full md:w-auto px-3 py-2 bg-secondary border border-border rounded-xl text-xs font-bold focus:outline-none"
          >
            <option value="all">Tous les conteneurs (et Général)</option>
            {containers.map(c => (
              <option key={c.id} value={c.id}>
                📦 {c.container_number} ({c.origin})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Expenses Table */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
        </div>
      ) : filteredExpenses.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-card border border-border space-y-3">
          <Receipt className="w-12 h-12 text-muted-foreground mx-auto" />
          <h3 className="text-base font-bold text-foreground">Aucune dépense enregistrée</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">Commencez par ajouter vos charges de salaires, transports ou manutentions en cliquant sur le bouton ci-dessus.</p>
        </div>
      ) : (
        <div className="rounded-3xl bg-card border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-secondary/60 text-muted-foreground font-extrabold uppercase text-[10px] tracking-wider border-b border-border">
                <tr>
                  <th className="p-4">Date</th>
                  <th className="p-4">Libellé / Titre</th>
                  <th className="p-4">Catégorie</th>
                  <th className="p-4">Conteneur Rattaché</th>
                  <th className="p-4">Montant</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-medium">
                {filteredExpenses.map((exp) => {
                  const catMeta = CATEGORY_OPTIONS.find(c => c.id === exp.category) || CATEGORY_OPTIONS[5];
                  const Icon = catMeta.icon;

                  return (
                    <tr key={exp.id} className="hover:bg-secondary/30 transition-colors">
                      <td className="p-4 text-muted-foreground font-bold whitespace-nowrap">
                        {formatDate(exp.expense_date)}
                      </td>
                      <td className="p-4 font-bold text-foreground">
                        <div>{exp.title}</div>
                        {exp.notes && (
                          <div className="text-[10px] text-muted-foreground font-normal mt-0.5">{exp.notes}</div>
                        )}
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold border ${catMeta.color}`}>
                          <Icon className="w-3 h-3" />
                          <span>{catMeta.label.split(' ')[1] || catMeta.label}</span>
                        </span>
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        {exp.container_number ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-secondary border border-border text-foreground font-bold text-[11px]">
                            <Ship className="w-3 h-3 text-primary" />
                            <span>{exp.container_number}</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-[11px]">Dépense Générale</span>
                        )}
                      </td>
                      <td className="p-4 font-black text-destructive text-sm whitespace-nowrap">
                        -{formatFCFA(exp.amount)}
                      </td>
                      <td className="p-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(exp)}
                            className="p-1.5 rounded-lg bg-secondary hover:bg-primary hover:text-white text-muted-foreground transition-colors"
                            title="Modifier cette dépense"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeletingExpense(exp)}
                            className="p-1.5 rounded-lg bg-secondary hover:bg-red-600 hover:text-white text-red-500 transition-colors"
                            title="Supprimer cette dépense"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Création & Modification Dépense */}
      {isModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h2 className="text-lg font-extrabold flex items-center gap-2">
                <Wallet className="w-5 h-5 text-primary" />
                <span>{editingExpense ? 'Modifier la Dépense' : 'Enregistrer une Dépense'}</span>
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
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

            <form onSubmit={handleSubmitExpense} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold mb-1">Libellé / Intitulé de la Dépense *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Salaire Juillet Mamadou Diallo, Transport camion conteneur..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-secondary border border-border rounded-xl font-bold"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold mb-1">Catégorie *</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-secondary border border-border rounded-xl font-bold"
                  >
                    {CATEGORY_OPTIONS.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1">Montant (FCFA) *</label>
                  <input
                    type="number"
                    required
                    step="500"
                    placeholder="Ex: 150000"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-secondary border border-border rounded-xl font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold mb-1">Conteneur Rattaché (Optionnel)</label>
                  <select
                    value={containerId}
                    onChange={(e) => setContainerId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-secondary border border-border rounded-xl font-bold"
                  >
                    <option value="">Dépense Générale Entreprise</option>
                    {containers.map(c => (
                      <option key={c.id} value={c.id}>
                        📦 {c.container_number} ({c.origin})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1">Date de la Dépense *</label>
                  <input
                    type="date"
                    required
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-secondary border border-border rounded-xl font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Remarques / Justificatif (Optionnel)</label>
                <textarea
                  rows={2}
                  placeholder="Ex: Payé en espèces par l'agent de caisse..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3.5 py-2 bg-secondary border border-border rounded-xl font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold hover:bg-secondary"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow hover:bg-primary/90 disabled:opacity-50"
                >
                  {submitting ? 'Enregistrement...' : (editingExpense ? 'Enregistrer les modifications' : 'Ajouter la Dépense')}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Confirmation Suppression Dépense */}
      {deletingExpense && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-red-500/10 text-red-500 flex-shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-foreground">Supprimer la Dépense</h3>
                <p className="text-xs text-muted-foreground">Confirmation de suppression</p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Êtes-vous sûr de vouloir supprimer la dépense <strong className="text-foreground">{deletingExpense.title}</strong> d'un montant de <strong className="text-destructive">{formatFCFA(deletingExpense.amount)}</strong> ?
            </p>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
              <button
                type="button"
                onClick={() => setDeletingExpense(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold hover:bg-secondary transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
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
