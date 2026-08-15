import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../lib/api';
import { toast } from 'sonner';
import { Client } from '../types';
import { formatFCFA, formatDate } from '../lib/utils';
import { 
  Users, 
  Search, 
  Plus, 
  Phone, 
  Mail, 
  MapPin, 
  Package, 
  Edit2, 
  Trash2, 
  X, 
  AlertTriangle, 
  Globe,
  History,
  FileText,
  CreditCard,
  CheckCircle2
} from 'lucide-react';

const COUNTRY_CODES = [
  { code: '+221', flag: '🇸🇳', name: 'Sénégal (+221)' },
  { code: '+33', flag: '🇫🇷', name: 'France (+33)' },
  { code: '+86', flag: '🇨🇳', name: 'Chine (+86)' },
  { code: '+1', flag: '🇺🇸', name: 'États-Unis / Canada (+1)' },
  { code: '+225', flag: '🇨🇮', name: 'Côte d\'Ivoire (+225)' },
  { code: '+223', flag: '🇲🇱', name: 'Mali (+223)' },
  { code: '+224', flag: '🇬🇳', name: 'Guinée (+224)' },
  { code: '+212', flag: '🇲🇦', name: 'Maroc (+212)' },
  { code: '+241', flag: '🇬🇦', name: 'Gabon (+241)' },
  { code: '+34', flag: '🇪🇸', name: 'Espagne (+34)' },
  { code: '+39', flag: '🇮🇹', name: 'Italie (+39)' },
  { code: '+971', flag: '🇦🇪', name: 'Émirats Arabes Unis (+971)' },
  { code: '+44', flag: '🇬🇧', name: 'Royaume-Uni (+44)' }
];

export const ClientsPage: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [duplicatePhoneError, setDuplicatePhoneError] = useState<string | null>(null);

  // Create Client Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [selectedCountryCode, setSelectedCountryCode] = useState('+221');
  const [phoneBody, setPhoneBody] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Edit Client Modal State
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [editName, setEditName] = useState('');
  const [editCountryCode, setEditCountryCode] = useState('+221');
  const [editPhoneBody, setEditPhoneBody] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Delete Client Modal State
  const [deletingClient, setDeletingClient] = useState<Client | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Client History Modal State
  const [historyClient, setHistoryClient] = useState<Client | null>(null);
  const [historyDetails, setHistoryDetails] = useState<{
    client: Client;
    lots: any[];
    payments: any[];
  } | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const loadClients = async () => {
    try {
      const res = await api.get('/clients');
      setClients(res.data.clients);
    } catch (err) {
      console.error('Erreur chargement clients:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClients();
  }, []);

  const handleOpenHistory = async (client: Client) => {
    setHistoryClient(client);
    setLoadingHistory(true);
    try {
      const res = await api.get(`/clients/${client.id}`);
      setHistoryDetails({
        client: res.data.client,
        lots: res.data.client.lots || [],
        payments: res.data.client.payments || []
      });
    } catch (err) {
      console.error('Erreur chargement historique client:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleDownloadConsolidatedInvoice = async (clientId: number, clientName: string) => {
    try {
      toast.info(`Génération de la facture regroupée pour ${clientName}...`);
      const response = await api.get(`/clients/${clientId}/consolidated-invoice/pdf`, {
        responseType: 'blob'
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
      toast.success(`Facture regroupée générée avec succès !`);
    } catch (err: any) {
      console.error('Erreur génération facture regroupée:', err);
      toast.error('Erreur lors de la génération de la facture regroupée.');
    }
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phoneBody) return;
    setSubmitting(true);
    setDuplicatePhoneError(null);

    const fullPhone = `${selectedCountryCode} ${phoneBody.trim()}`;

    try {
      await api.post('/clients', {
        name,
        phone: fullPhone,
        email: email || null,
        address: address || null,
        notes: notes || null
      });

      setIsModalOpen(false);
      setName('');
      setSelectedCountryCode('+221');
      setPhoneBody('');
      setEmail('');
      setAddress('');
      setNotes('');
      loadClients();
    } catch (err: any) {
      console.error('Erreur création client:', err);
      if (err.response?.data?.error) {
        setDuplicatePhoneError(err.response.data.error);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEdit = (client: Client) => {
    setEditingClient(client);
    setEditName(client.name);
    setEditEmail(client.email || '');
    setEditAddress(client.address || '');
    setEditNotes(client.notes || '');

    let matchedCode = '+221';
    let body = client.phone || '';
    for (const c of COUNTRY_CODES) {
      if (body.startsWith(c.code)) {
        matchedCode = c.code;
        body = body.replace(c.code, '').trim();
        break;
      }
    }
    setEditCountryCode(matchedCode);
    setEditPhoneBody(body);
  };

  const handleSaveEditClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient) return;
    setEditSubmitting(true);
    setDuplicatePhoneError(null);

    const fullPhone = `${editCountryCode} ${editPhoneBody.trim()}`;

    try {
      await api.put(`/clients/${editingClient.id}`, {
        name: editName,
        phone: fullPhone,
        email: editEmail || null,
        address: editAddress || null,
        notes: editNotes || null
      });

      setEditingClient(null);
      loadClients();
    } catch (err: any) {
      console.error('Erreur modification client:', err);
      if (err.response?.data?.error) {
        setDuplicatePhoneError(err.response.data.error);
      }
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleConfirmDeleteClient = async () => {
    if (!deletingClient) return;
    setIsDeleting(true);

    try {
      await api.delete(`/clients/${deletingClient.id}`);
      setDeletingClient(null);
      loadClients();
    } catch (err) {
      console.error('Erreur suppression client:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Répertoire de Tous les Clients</h1>
          <p className="text-sm text-muted-foreground">Consultez, modifiez ou supprimez les fiches des clients (Sénégal, France, International).</p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm shadow-md hover:bg-primary/90 transition-all self-start"
        >
          <Plus className="w-4 h-4" />
          <span>Nouveau Client</span>
        </button>
      </div>

      {/* Search */}
      <div className="p-4 rounded-2xl bg-card border border-border flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Rechercher un client par nom ou téléphone..."
            className="w-full pl-10 pr-4 py-2 bg-secondary border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      {/* Clients Grid */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredClients.map((client) => {
            const due = parseFloat(String(client.total_due || 0));
            return (
              <div key={client.id} className="p-6 rounded-2xl bg-card border border-border shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary font-black flex items-center justify-center text-base">
                        {client.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-extrabold text-base leading-tight">{client.name}</h3>
                        <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3 text-emerald-600" />
                          {client.phone}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenHistory(client)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-secondary hover:bg-primary hover:text-white text-muted-foreground text-xs font-extrabold transition-colors group"
                        title="Voir l'historique de paiement"
                      >
                        <History className="w-3.5 h-3.5 text-primary group-hover:text-white" />
                        <span>Historique</span>
                      </button>

                      <button
                        onClick={() => handleOpenEdit(client)}
                        className="p-1.5 rounded-lg bg-secondary hover:bg-primary hover:text-white text-muted-foreground transition-colors"
                        title="Modifier ce client"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => setDeletingClient(client)}
                        className="p-1.5 rounded-lg bg-secondary hover:bg-red-600 hover:text-white text-red-500 transition-colors"
                        title="Supprimer ce client"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-secondary/50 space-y-1.5 text-xs">
                    {client.email && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="w-3.5 h-3.5" />
                        <span>{client.email}</span>
                      </div>
                    )}
                    {client.address && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="w-3.5 h-3.5" />
                        <span>{client.address}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-foreground pt-1">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Package className="w-3.5 h-3.5" /> Total Lots :
                      </span>
                      <span className="font-bold">{client.total_lots || 0}</span>
                    </div>
                  </div>
                </div>

                {/* Financial Summary */}
                <div className="p-3 rounded-xl bg-secondary/30 border border-border flex items-center justify-between text-xs">
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-muted-foreground">Total Facturé</span>
                    <span className="font-extrabold">{formatFCFA(client.total_billed)}</span>
                  </div>
                  <div className="text-right">
                    <span className="block text-[10px] uppercase font-bold text-muted-foreground">Reste à Payer</span>
                    <span className={`font-extrabold ${due > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                      {formatFCFA(due)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Historique de Paiement du Client avec React Portal (100% de la fenêtre recouverte) */}
      {historyClient && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-primary/10 text-primary">
                  <History className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-extrabold">Historique des Paiements</h2>
                  <p className="text-xs text-muted-foreground">{historyClient.name} ({historyClient.phone})</p>
                </div>
              </div>
              <button
                onClick={() => { setHistoryClient(null); setHistoryDetails(null); }}
                className="p-1.5 rounded-xl hover:bg-secondary text-muted-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingHistory ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
              </div>
            ) : historyDetails ? (
              <div className="space-y-6 text-xs">
                {/* Résumé Financier Globale du Client */}
                <div className="grid grid-cols-3 gap-3 p-4 rounded-2xl bg-secondary/50 border border-border">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Total Facturé</span>
                    <p className="text-sm font-extrabold text-foreground mt-0.5">{formatFCFA(historyDetails.client.total_billed || historyClient.total_billed)}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-emerald-600">Total Encaissé</span>
                    <p className="text-sm font-extrabold text-emerald-600 mt-0.5">{formatFCFA(historyDetails.client.total_paid || historyClient.total_paid)}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-red-500">Solde Restant Due</span>
                    <p className="text-sm font-extrabold text-red-500 mt-0.5">{formatFCFA(historyDetails.client.total_due || historyClient.total_due)}</p>
                  </div>
                </div>

                {/* Tableau de l'Historique des Encaissements */}
                <div className="space-y-3">
                  <h3 className="font-extrabold text-sm flex items-center gap-2 text-foreground">
                    <CreditCard className="w-4 h-4 text-emerald-600" />
                    <span>Détail des Encaissements de Paiements ({historyDetails.payments.length})</span>
                  </h3>

                  {historyDetails.payments.length > 0 ? (
                    <div className="overflow-x-auto border border-border rounded-2xl">
                      <table className="w-full text-left text-xs whitespace-nowrap">
                        <thead className="bg-slate-900 text-white font-bold uppercase text-[11px]">
                          <tr>
                            <th className="p-3">Date</th>
                            <th className="p-3">N° Reçu</th>
                            <th className="p-3">Conteneur</th>
                            <th className="p-3">Description du Lot</th>
                            <th className="p-3">Mode</th>
                            <th className="p-3 text-right">Montant Payé</th>
                            <th className="p-3 text-center">Reçu PDF</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border font-medium">
                          {historyDetails.payments.map((p) => (
                            <tr key={p.id} className="hover:bg-secondary/40 transition-colors">
                              <td className="p-3 text-muted-foreground">{formatDate(p.payment_date)}</td>
                              <td className="p-3 font-bold text-primary">{p.receipt_number}</td>
                              <td className="p-3 font-semibold">{p.container_number || '-'}</td>
                              <td className="p-3 text-foreground truncate max-w-[150px]">{p.product_description || 'Marchandise'}</td>
                              <td className="p-3">
                                <span className="px-2 py-0.5 rounded-full bg-secondary text-[10px] font-bold uppercase text-foreground">
                                  {p.payment_method === 'cash' ? 'Espèces' : p.payment_method === 'wave' ? 'Wave' : p.payment_method === 'orange_money' ? 'OM' : 'Virement'}
                                </span>
                              </td>
                              <td className="p-3 text-right font-extrabold text-emerald-600">
                                {formatFCFA(p.amount_paid)}
                              </td>
                              <td className="p-3 text-center">
                                <a
                                  href={`/api/payments/${p.id}/pdf?token=${localStorage.getItem('cargo_notify_token') || ''}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 hover:bg-emerald-600 hover:text-white font-bold transition-all text-[11px]"
                                >
                                  <FileText className="w-3 h-3" />
                                  <span>PDF</span>
                                </a>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-6 text-center rounded-2xl bg-secondary/30 text-muted-foreground border border-border italic">
                      Aucun règlement ou paiement n'a encore été enregistré pour ce client.
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            <div className="flex items-center justify-end pt-4 border-t border-border">
              <button
                onClick={() => { setHistoryClient(null); setHistoryDetails(null); }}
                className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs shadow hover:bg-primary/90"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Création Client avec Portal React (100% de la fenêtre recouverte) */}
      {isModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <h2 className="text-lg font-extrabold">Nouveau Client</h2>

            <form onSubmit={handleCreateClient} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold mb-1">Nom Complet *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Babacar Ndiaye"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-secondary border border-border rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Téléphone WhatsApp *</label>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedCountryCode}
                    onChange={(e) => setSelectedCountryCode(e.target.value)}
                    className="px-2.5 py-2.5 bg-secondary border border-border rounded-xl font-bold text-xs focus:outline-none flex-shrink-0"
                  >
                    {COUNTRY_CODES.map(c => (
                      <option key={c.code} value={c.code}>
                        {c.flag} {c.code}
                      </option>
                    ))}
                  </select>

                  <input
                    type="text"
                    required
                    placeholder="Ex: 77 123 45 67 ou 06 12 34 56 78"
                    value={phoneBody}
                    onChange={(e) => setPhoneBody(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-secondary border border-border rounded-xl font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Email</label>
                <input
                  type="email"
                  placeholder="Ex: client@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-secondary border border-border rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Adresse / Ville</label>
                <input
                  type="text"
                  placeholder="Ex: Dakar, Paris, Lyon, Touba..."
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-secondary border border-border rounded-xl"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold hover:bg-secondary"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold shadow hover:bg-primary/90 disabled:opacity-50"
                >
                  {submitting ? 'Création...' : 'Créer le Client'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Modification Client avec Portal React */}
      {editingClient && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-extrabold flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-primary" />
                <span>Modifier le Client</span>
              </h2>
              <button
                onClick={() => setEditingClient(null)}
                className="p-1 rounded-lg hover:bg-secondary text-muted-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditClient} className="space-y-4 text-xs">
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
                <label className="block font-semibold mb-1">Téléphone WhatsApp *</label>
                <div className="flex items-center gap-2">
                  <select
                    value={editCountryCode}
                    onChange={(e) => setEditCountryCode(e.target.value)}
                    className="px-2.5 py-2.5 bg-secondary border border-border rounded-xl font-bold text-xs focus:outline-none flex-shrink-0"
                  >
                    {COUNTRY_CODES.map(c => (
                      <option key={c.code} value={c.code}>
                        {c.flag} {c.code}
                      </option>
                    ))}
                  </select>

                  <input
                    type="text"
                    required
                    value={editPhoneBody}
                    onChange={(e) => setEditPhoneBody(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-secondary border border-border rounded-xl font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Email</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-secondary border border-border rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Adresse / Ville</label>
                <input
                  type="text"
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-secondary border border-border rounded-xl"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setEditingClient(null)}
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

      {/* Modal Confirmation Suppression Client avec Portal React */}
      {deletingClient && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-red-500/10 text-red-500 flex-shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-foreground">Supprimer le Client</h3>
                <p className="text-xs text-muted-foreground">Confirmation de suppression définitive</p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Êtes-vous sûr de vouloir supprimer le client <strong className="text-foreground">{deletingClient.name}</strong> ? Cette action supprimera sa fiche du répertoire.
            </p>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
              <button
                type="button"
                onClick={() => setDeletingClient(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold hover:bg-secondary transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteClient}
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

      {/* Pop-up Modal d'avertissement Doublon Client */}
      {duplicatePhoneError && createPortal(
        <div className="fixed inset-0 z-[10000] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 text-center">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-extrabold text-foreground">Doublon Client Détecté</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {duplicatePhoneError}
              </p>
            </div>

            <button
              onClick={() => setDuplicatePhoneError(null)}
              className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-md hover:bg-primary/90 transition-all"
            >
              Compris
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
