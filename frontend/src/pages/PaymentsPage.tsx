import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Payment, Lot } from '../types';
import { formatFCFA, formatDate } from '../lib/utils';
import { CreditCard, Plus, ExternalLink, Share2, Download, FileText, Search, Edit2, Trash2, AlertTriangle, X, Printer, Calculator } from 'lucide-react';
import { SearchableSelect } from '../components/ui/SearchableSelect';
import { toast } from 'sonner';

export const PaymentsPage: React.FC = () => {
  const { user } = useAuth();
  const canEditPayments = user?.role === 'admin' || user?.role === 'super_admin' || user?.role === 'cashier' || (!!user?.role && user.role.toLowerCase().includes('admin'));

  const [payments, setPayments] = useState<Payment[]>([]);
  const [unpaidLots, setUnpaidLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedLotId, setSelectedLotId] = useState('');
  const [amountPaid, setAmountPaid] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'wave' | 'om' | 'bank_transfer'>('cash');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Edit Payment State (Admin Only)
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editMethod, setEditMethod] = useState<'cash' | 'wave' | 'om' | 'bank_transfer'>('cash');
  const [editNotes, setEditNotes] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete Payment Modal (Admin Only)
  const [deletingPayment, setDeletingPayment] = useState<Payment | null>(null);
  const [deleting, setDeleting] = useState(false);



  const loadData = async () => {
    try {
      const [paymentsRes, lotsRes] = await Promise.all([
        api.get('/payments'),
        api.get('/lots')
      ]);

      setPayments(paymentsRes.data.payments);
      // Filter lots that still have a remaining balance or unpaid/partial status
      const eligibleLots = lotsRes.data.lots.filter((l: Lot) => l.payment_status !== 'paid');
      setUnpaidLots(eligibleLots);
      if (eligibleLots.length > 0) {
        setSelectedLotId(String(eligibleLots[0].id));
        setAmountPaid(String(eligibleLots[0].remaining_balance || eligibleLots[0].final_amount));
      }
    } catch (err) {
      console.error('Erreur chargement paiements:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleLotChange = (lotIdStr: string) => {
    setSelectedLotId(lotIdStr);
    const target = unpaidLots.find(l => String(l.id) === lotIdStr);
    if (target) {
      setAmountPaid(String(target.remaining_balance || target.final_amount));
    }
  };

  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLotId || !amountPaid) return;
    setSubmitting(true);

    try {
      const res = await api.post('/payments', {
        lot_id: parseInt(selectedLotId, 10),
        amount_paid: parseFloat(amountPaid),
        payment_method: paymentMethod,
        notes: notes || null
      });

      setIsModalOpen(false);
      setNotes('');
      loadData();
      
      // Ouverture sécurisée de l'aperçu du reçu PDF dans un nouvel onglet
      if (res.data.payment?.id) {
        handleViewPdf(res.data.payment.id);
      }
    } catch (err) {
      console.error('Erreur enregistrement règlement:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEditPayment = (p: Payment) => {
    setEditingPayment(p);
    setEditAmount(String(p.amount_paid));
    setEditMethod((p.payment_method || 'cash') as any);
    setEditNotes(p.notes || '');
  };

  const handleUpdatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPayment) return;
    setSavingEdit(true);

    try {
      await api.put(`/payments/${editingPayment.id}`, {
        amount_paid: parseFloat(editAmount),
        payment_method: editMethod,
        notes: editNotes || null
      });

      toast.success(`Reçu N° ${editingPayment.receipt_number} mis à jour avec succès !`);
      setEditingPayment(null);
      loadData();
    } catch (err) {
      console.error('Erreur modification paiement:', err);
      toast.error('Erreur lors de la modification du paiement.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeletePayment = async () => {
    if (!deletingPayment) return;
    setDeleting(true);

    try {
      await api.delete(`/payments/${deletingPayment.id}`);
      toast.success(`Le reçu N° ${deletingPayment.receipt_number} a été supprimé !`);
      setDeletingPayment(null);
      loadData();
    } catch (err) {
      console.error('Erreur suppression paiement:', err);
      toast.error('Erreur lors de la suppression du paiement.');
    } finally {
      setDeleting(false);
    }
  };

  const handleViewPdf = async (paymentId: number) => {
    try {
      const response = await api.get(`/payments/${paymentId}/pdf`, {
        responseType: 'blob'
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err) {
      console.error('Erreur ouverture reçu PDF:', err);
      toast.error('Erreur lors de l\'ouverture du reçu PDF.');
    }
  };

  const handleDownloadPdf = async (p: Payment) => {
    try {
      const response = await api.get(`/payments/${p.id}/pdf`, {
        responseType: 'blob'
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Recu-${p.receipt_number}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success(`Le reçu ${p.receipt_number} a été téléchargé avec succès !`);
    } catch (err) {
      console.error('Erreur téléchargement reçu PDF:', err);
      toast.error('Erreur lors du téléchargement du fichier PDF.');
    }
  };

  const handleShareReceipt = async (p: Payment) => {
    try {
      toast.info(`Préparation du reçu PDF pour ${p.client_name}...`);

      // 1. Récupérer le blob PDF officiel depuis le serveur
      const response = await api.get(`/payments/${p.id}/pdf`, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const fileName = `Recu-${p.receipt_number}.pdf`;
      const file = new File([blob], fileName, { type: 'application/pdf' });

      const cleanPhone = (p.client_phone || '').replace(/[^0-9]/g, '');
      const message = `Bonjour ${p.client_name},\nVoici votre reçu officiel de paiement CargoNotify N° ${p.receipt_number} d'un montant de ${formatFCFA(p.amount_paid)} pour la marchandise "${p.product_description}".\nMerci pour votre confiance !`;

      // 2. Partage Natif avec Fichier PDF rattaché (Mobiles, Tablets & Navigateurs compatibles)
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `Reçu de paiement ${p.receipt_number}`,
          text: message,
          files: [file]
        });
        toast.success(`Le reçu PDF a été partagé avec succès !`);
        return;
      }

      // 3. Fallback PC / Web WhatsApp : Téléchargement direct du PDF + Ouverture de WhatsApp Web avec message prérempli
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();

      if (cleanPhone) {
        const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
        window.open(waUrl, '_blank');
        toast.success(`Reçu PDF téléchargé & discussion WhatsApp ouverte ! Joignez le PDF téléchargé à la discussion.`);
      } else {
        toast.success(`Fichier Reçu PDF téléchargé sur votre ordinateur !`);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Erreur partage reçu:', err);
        toast.error('Erreur lors de la préparation du reçu PDF.');
      }
    }
  };

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const filteredPayments = payments.filter(p => {
    const matchesSearch = (
      (p.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) || '') ||
      (p.receipt_number?.toLowerCase().includes(searchTerm.toLowerCase()) || '') ||
      (p.container_number?.toLowerCase().includes(searchTerm.toLowerCase()) || '')
    );

    let matchesDateRange = true;
    if (p.payment_date) {
      const payDateStr = String(p.payment_date).slice(0, 10);
      if (startDate && payDateStr < startDate) {
        matchesDateRange = false;
      }
      if (endDate && payDateStr > endDate) {
        matchesDateRange = false;
      }
    }

    return matchesSearch && matchesDateRange;
  });

  const totalFilteredAmount = filteredPayments.reduce((sum, p) => sum + (parseFloat(String(p.amount_paid)) || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Paiements & Reçus de Règlement</h1>
          <p className="text-sm text-muted-foreground">Enregistrez les règlements des clients et éditez leurs reçus au format PDF.</p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm shadow-md hover:bg-primary/90 transition-all self-start"
        >
          <Plus className="w-4 h-4" />
          <span>Saisir un Règlement</span>
        </button>
      </div>

      {/* Search & Date Filters Bar */}
      <div className="p-4 rounded-2xl bg-card border border-border flex flex-col md:flex-row items-stretch md:items-center gap-3 sm:gap-4 shadow-sm">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Rechercher par N° reçu, client ou conteneur..."
            className="w-full pl-10 pr-4 py-2 bg-secondary border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary font-medium"
          />
        </div>

        {/* Date Début */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-muted-foreground whitespace-nowrap">Du :</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-2 bg-secondary border border-border rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary text-foreground cursor-pointer"
          />
        </div>

        {/* Date Fin */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-muted-foreground whitespace-nowrap">Au :</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-2 bg-secondary border border-border rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary text-foreground cursor-pointer"
          />
        </div>

        {/* Total des paiements filtrés */}
        {(startDate || endDate || searchTerm) && (
          <button
            onClick={() => {
              setSearchTerm('');
              setStartDate('');
              setEndDate('');
            }}
            className="px-3 py-2 rounded-xl bg-destructive/10 text-destructive text-xs font-bold hover:bg-destructive/20 transition-colors whitespace-nowrap"
            title="Réinitialiser tous les filtres"
          >
            Réinitialiser
          </button>
        )}
      </div>

      {/* Résumé des totaux filtrés */}
      {(startDate || endDate || searchTerm) && (
        <div className="px-4 py-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between text-xs font-extrabold text-emerald-700 dark:text-emerald-400">
          <span>{filteredPayments.length} règlement(s) trouvé(s)</span>
          <span>Total encaissé sur la période : {formatFCFA(totalFilteredAmount)}</span>
        </div>
      )}

      {/* Table Payments */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border shadow-sm overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-xs whitespace-nowrap">
            <thead className="border-b border-border text-[11px] font-extrabold text-muted-foreground uppercase bg-secondary/50 tracking-wider">
              <tr>
                <th className="px-3 py-2.5">N° Reçu</th>
                <th className="px-3 py-2.5">Client</th>
                <th className="px-3 py-2.5">Marchandise / Conteneur</th>
                <th className="px-3 py-2.5">Montant Versé</th>
                <th className="px-3 py-2.5">Mode de Règlement</th>
                <th className="px-3 py-2.5">Date</th>
                <th className="px-3 py-2.5 text-center min-w-[260px]">Actions & Reçu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredPayments.map((p) => (
                <tr key={p.id} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-3 py-2.5 font-bold text-foreground text-xs">
                    {p.receipt_number}
                  </td>
                  <td className="px-3 py-2.5">
                    <p className="font-bold text-foreground text-xs">{p.client_name}</p>
                    <p className="text-[11px] text-muted-foreground">{p.client_phone}</p>
                  </td>
                  <td className="px-3 py-2.5">
                    <p className="font-medium text-xs max-w-[200px] truncate">{p.product_description}</p>
                    <span className="text-[11px] text-muted-foreground">Conteneur {p.container_number}</span>
                  </td>
                  <td className="px-3 py-2.5 font-extrabold text-emerald-600 dark:text-emerald-400 text-xs">
                    {formatFCFA(p.amount_paid)}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="uppercase text-[11px] font-bold px-2 py-0.5 rounded-md bg-secondary border border-border">
                      {p.payment_method}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-[11px] text-muted-foreground font-medium">
                    {formatDate(p.payment_date)}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      {/* Button 1: Voir */}
                      <button
                        onClick={() => handleViewPdf(p.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-600 hover:text-white text-[11px] font-extrabold transition-all shadow-sm"
                        title="Voir l'aperçu du reçu PDF dans un nouvel onglet"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Voir</span>
                      </button>

                      {/* Button 2: Partager */}
                      <button
                        onClick={() => handleShareReceipt(p)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20 hover:bg-indigo-600 hover:text-white text-[11px] font-extrabold transition-all shadow-sm"
                        title="Partager le reçu avec le client via WhatsApp"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>Partager</span>
                      </button>

                      {/* Button 3: PDF Reçu */}
                      <button
                        onClick={() => handleDownloadPdf(p)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-secondary text-foreground border border-border hover:bg-primary hover:text-white text-[11px] font-extrabold transition-all shadow-sm"
                        title="Télécharger le reçu de ce paiement"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Reçu PDF</span>
                      </button>

                      {/* Actions : Modifier & Supprimer */}
                      {canEditPayments && (
                        <div className="flex items-center gap-1 pl-1.5 border-l border-border">
                          <button
                            onClick={() => handleOpenEditPayment(p)}
                            className="p-1.5 rounded-xl bg-card border border-border hover:bg-primary hover:text-white text-muted-foreground transition-all shadow-sm"
                            title="Modifier ce règlement"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeletingPayment(p)}
                            className="p-1.5 rounded-xl bg-card border border-border hover:bg-red-600 hover:text-white text-red-500 transition-all shadow-sm"
                            title="Annuler / Supprimer ce règlement"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Saisie Règlement */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-6">
            <h2 className="text-xl font-extrabold flex items-center gap-2">
              <CreditCard className="w-6 h-6 text-primary" />
              <span>Saisir un Règlement Client</span>
            </h2>

            <form onSubmit={handleCreatePayment} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold mb-1">Sélectionner le Lot Client à Régler *</label>
                <SearchableSelect
                  options={unpaidLots.map(l => ({
                    value: l.id,
                    label: `${l.client_name} — ${l.product_description}`,
                    sublabel: `Reste à payer : ${formatFCFA(l.remaining_balance || l.final_amount)} (${l.client_phone || ''})`
                  }))}
                  value={selectedLotId}
                  onChange={(val) => handleLotChange(String(val))}
                  placeholder="Sélectionner ou rechercher un lot/client..."
                  searchPlaceholder="Tapez le nom d'un client, téléphone ou marchandise..."
                />
              </div>

              {(() => {
                const selectedLot = unpaidLots.find(l => String(l.id) === selectedLotId);
                if (!selectedLot) return null;
                return (
                  <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between gap-3 my-2 text-xs">
                    <div>
                      <span className="block font-extrabold text-foreground">{selectedLot.client_name}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {selectedLot.product_description} — Reste dû : <strong className="text-emerald-600 font-extrabold">{formatFCFA(selectedLot.remaining_balance || selectedLot.final_amount)}</strong>
                      </span>
                    </div>
                  </div>
                );
              })()}

              <div>
                <label className="block font-semibold mb-1">Montant du Règlement (FCFA) *</label>
                <input
                  type="number"
                  required
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-secondary border border-border rounded-xl font-extrabold text-foreground text-base focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Mode de Paiement</label>
                <select
                  value={paymentMethod}
                  onChange={(e: any) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2.5 bg-secondary border border-border rounded-xl font-medium focus:outline-none"
                >
                  <option value="cash">Espèces (Cash)</option>
                  <option value="wave">Wave</option>
                  <option value="om">Orange Money (OM)</option>
                  <option value="bank_transfer">Virement Bancaire</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">Notes / Référence de transaction</label>
                <input
                  type="text"
                  placeholder="Ex: Réf Wave #984201..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-xl"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl hover:bg-secondary font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold shadow-md hover:bg-primary/90 disabled:opacity-50"
                >
                  {submitting ? 'Validation...' : 'Valider & Imprimer le Reçu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Modification d'un Règlement (Admin uniquement) */}
      {editingPayment && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-6">
            <div className="space-y-1">
              <h2 className="text-lg font-extrabold flex items-center gap-2 text-foreground">
                <Edit2 className="w-5 h-5 text-primary" />
                <span>Modifier le Règlement (Admin)</span>
              </h2>
              <p className="text-xs text-muted-foreground">Reçu N° {editingPayment.receipt_number} — {editingPayment.client_name}</p>
            </div>

            <form onSubmit={handleUpdatePayment} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold mb-1">Montant du Règlement (FCFA) *</label>
                <input
                  type="number"
                  required
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-secondary border border-border rounded-xl font-extrabold text-foreground text-base focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Mode de Paiement</label>
                <select
                  value={editMethod}
                  onChange={(e: any) => setEditMethod(e.target.value)}
                  className="w-full px-3 py-2.5 bg-secondary border border-border rounded-xl font-medium focus:outline-none"
                >
                  <option value="cash">Espèces (Cash)</option>
                  <option value="wave">Wave</option>
                  <option value="om">Orange Money (OM)</option>
                  <option value="bank_transfer">Virement Bancaire</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">Notes / Référence de transaction</label>
                <input
                  type="text"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-xl"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setEditingPayment(null)}
                  className="px-4 py-2 rounded-xl hover:bg-secondary font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold shadow-md hover:bg-primary/90 disabled:opacity-50"
                >
                  {savingEdit ? 'Enregistrement...' : 'Enregistrer la Modification'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirmation de Suppression d'un Règlement (Admin uniquement) */}
      {deletingPayment && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 text-center">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-extrabold text-foreground">Annuler / Supprimer le Règlement ?</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Êtes-vous sûr de vouloir supprimer le reçu <strong className="text-foreground">N° {deletingPayment.receipt_number}</strong> d'un montant de <strong className="text-foreground">{formatFCFA(deletingPayment.amount_paid)}</strong> pour <strong className="text-foreground">{deletingPayment.client_name}</strong> ?
              </p>
              <p className="text-[11px] text-red-500 font-semibold pt-1">
                Le solde du client sera recalculé et une trace d'annulation sera inscrite dans le journal d'audit.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingPayment(null)}
                className="flex-1 py-2.5 rounded-xl bg-secondary hover:bg-border text-foreground font-bold text-xs"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleDeletePayment}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md disabled:opacity-50"
              >
                {deleting ? 'Suppression...' : 'Oui, Supprimer le Règlement'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
