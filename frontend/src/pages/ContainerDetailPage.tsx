import React, { useEffect, useState } from 'react';
import { SearchableSelect } from '../components/ui/SearchableSelect';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { toast } from 'sonner';
import { Container, ContainerCost, Lot, Client } from '../types';
import { formatFCFA, formatDate } from '../lib/utils';
import { 
  Container as ContainerIcon, 
  MapPin, 
  Calendar, 
  DollarSign, 
  Plus, 
  Trash2, 
  MessageSquare, 
  ArrowLeft, 
  CheckCircle2, 
  UserPlus,
  FileSpreadsheet,
  Upload,
  Download,
  Calculator,
  Edit2,
  X,
  AlertTriangle
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

export const ContainerDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [container, setContainer] = useState<Container | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states for adding cost
  const [costCategory, setCostCategory] = useState<'freight' | 'customs' | 'transport' | 'other'>('freight');
  const [costAmount, setCostAmount] = useState('');
  const [costDescription, setCostDescription] = useState('');
  const [addingCost, setAddingCost] = useState(false);

  // Excel Export state
  const [exportingExcel, setExportingExcel] = useState(false);

  const handleExportExcel = async () => {
    if (!container) return;
    setExportingExcel(true);
    try {
      const response = await api.get(`/containers/${container.id}/export-excel`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Recap-${container.container_number}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Erreur export Excel:', err);
    } finally {
      setExportingExcel(false);
    }
  };

  // Excel Import state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Add Lot Modal State (Direct in Container)
  const [isAddLotModalOpen, setIsAddLotModalOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [productDescription, setProductDescription] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [weightKg, setWeightKg] = useState('0');
  const [volumeCbm, setVolumeCbm] = useState('1');
  const [baleQty, setBaleQty] = useState('0');
  const [copyQty, setCopyQty] = useState('0');
  const [smallPackingQty, setSmallPackingQty] = useState('0');
  const [heavyGoodsQty, setHeavyGoodsQty] = useState('0');
  const [manualAmount, setManualAmount] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [submittingLot, setSubmittingLot] = useState(false);

  // Edit Lot State
  const [editingLot, setEditingLot] = useState<Lot | null>(null);
  const [editProductDescription, setEditProductDescription] = useState('');
  const [editQuantity, setEditQuantity] = useState('1');
  const [editWeightKg, setEditWeightKg] = useState('0');
  const [editVolumeCbm, setEditVolumeCbm] = useState('0');
  const [editBaleQty, setEditBaleQty] = useState('0');
  const [editCopyQty, setEditCopyQty] = useState('0');
  const [editSmallPackingQty, setEditSmallPackingQty] = useState('0');
  const [editHeavyGoodsQty, setEditHeavyGoodsQty] = useState('0');
  const [editFinalAmount, setEditFinalAmount] = useState('0');
  const [editNotes, setEditNotes] = useState('');
  const [editPaymentStatus, setEditPaymentStatus] = useState<'unpaid' | 'partial' | 'paid'>('unpaid');
  const [editPickupStatus, setEditPickupStatus] = useState<'pending' | 'picked_up'>('pending');
  const [editSubmitting, setEditSubmitting] = useState(false);

  const handleOpenEditLot = (lot: Lot) => {
    setEditingLot(lot);
    setEditProductDescription(lot.product_description || '');
    setEditQuantity(String(lot.quantity || 1));
    setEditWeightKg(String(lot.weight_kg || 0));
    setEditVolumeCbm(String(lot.volume_cbm || 0));
    setEditBaleQty(String(lot.bale_qty || 0));
    setEditCopyQty(String(lot.copy_qty || 0));
    setEditSmallPackingQty(String(lot.small_packing_qty || 0));
    setEditHeavyGoodsQty(String(lot.heavy_goods_qty || 0));
    setEditFinalAmount(String(lot.final_amount || 0));
    setEditNotes(lot.notes || '');
    setEditPaymentStatus(lot.payment_status);
    setEditPickupStatus(lot.pickup_status);
  };

  const handleSaveEditLot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLot) return;
    setEditSubmitting(true);

    try {
      const finalAmt = editFinalAmount !== '' ? parseFloat(editFinalAmount) : editCalculatedSuggestedAmount;
      await api.put(`/lots/${editingLot.id}`, {
        product_description: editProductDescription,
        quantity: parseInt(editQuantity, 10) || 1,
        weight_kg: parseFloat(editWeightKg) || 0,
        volume_cbm: parseFloat(editVolumeCbm) || 0,
        bale_qty: parseInt(editBaleQty, 10) || 0,
        copy_qty: parseFloat(editCopyQty) || 0,
        small_packing_qty: parseInt(editSmallPackingQty, 10) || 0,
        heavy_goods_qty: parseFloat(editHeavyGoodsQty) || 0,
        final_amount: finalAmt,
        manual_final_amount: finalAmt,
        notes: editNotes || null,
        payment_status: editPaymentStatus,
        pickup_status: editPickupStatus
      });

      setEditingLot(null);
      loadContainer();
    } catch (err) {
      console.error('Erreur modification lot:', err);
    } finally {
      setEditSubmitting(false);
    }
  };

  // New Client Inline Form State
  const [isNewClientModal, setIsNewClientModal] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientCountryCode, setNewClientCountryCode] = useState('+221');
  const [newClientPhoneBody, setNewClientPhoneBody] = useState('');
  const [duplicatePhoneError, setDuplicatePhoneError] = useState<string | null>(null);

  // Delete Lot State
  const [deletingLot, setDeletingLot] = useState<Lot | null>(null);
  const [isDeletingLot, setIsDeletingLot] = useState(false);

  const loadContainer = async () => {
    try {
      const [contRes, clientsRes] = await Promise.all([
        api.get(`/containers/${id}`),
        api.get('/clients')
      ]);

      setContainer(contRes.data.container);
      setClients(clientsRes.data.clients);

      if (clientsRes.data.clients.length > 0 && !selectedClientId) {
        setSelectedClientId(String(clientsRes.data.clients[0].id));
      }
    } catch (err) {
      console.error('Erreur chargement détail conteneur:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) loadContainer();
  }, [id]);

  const cbmRate = 150000;
  const baleRate = 10000;
  const copyRate = 6000;
  const smallPackingRate = 1000;
  const heavyGoodsRate = 15000;

  const cbmComponent = (parseFloat(volumeCbm) || 0) * cbmRate;
  const baleComponent = (parseInt(baleQty, 10) || 0) * baleRate;
  const copyComponent = (parseFloat(copyQty) || 0) * copyRate;
  const smallPackingComponent = (parseInt(smallPackingQty, 10) || 0) * smallPackingRate;
  const heavyGoodsComponent = (parseFloat(heavyGoodsQty) || 0) * heavyGoodsRate;
  const calculatedSuggestedAmount = cbmComponent + baleComponent + copyComponent + smallPackingComponent + heavyGoodsComponent;

  const editCbmComponent = (parseFloat(editVolumeCbm) || 0) * cbmRate;
  const editBaleComponent = (parseInt(editBaleQty, 10) || 0) * baleRate;
  const editCopyComponent = (parseFloat(editCopyQty) || 0) * copyRate;
  const editSmallPackingComponent = (parseInt(editSmallPackingQty, 10) || 0) * smallPackingRate;
  const editHeavyGoodsComponent = (parseFloat(editHeavyGoodsQty) || 0) * heavyGoodsRate;
  const editCalculatedSuggestedAmount = editCbmComponent + editBaleComponent + editCopyComponent + editSmallPackingComponent + editHeavyGoodsComponent;

  const handleCreateLotDirect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!container || !selectedClientId || !productDescription) return;
    setSubmittingLot(true);

    try {
      await api.post('/lots', {
        container_id: container.id,
        client_id: parseInt(selectedClientId, 10),
        product_description: productDescription,
        quantity: parseInt(quantity, 10) || 1,
        weight_kg: parseFloat(weightKg) || 0,
        volume_cbm: parseFloat(volumeCbm) || 0,
        cbm_rate: cbmRate,
        cbm_amount: cbmComponent,
        bale_qty: parseInt(baleQty, 10) || 0,
        bale_amount: baleComponent,
        copy_qty: parseFloat(copyQty) || 0,
        copy_amount: copyComponent,
        small_packing_qty: parseInt(smallPackingQty, 10) || 0,
        small_packing_amount: smallPackingComponent,
        heavy_goods_qty: parseFloat(heavyGoodsQty) || 0,
        heavy_goods_amount: heavyGoodsComponent,
        manual_final_amount: manualAmount !== '' ? parseFloat(manualAmount) : calculatedSuggestedAmount,
        notes: notes || null
      });

      setIsAddLotModalOpen(false);
      setProductDescription('');
      setBaleQty('0');
      setCopyQty('0');
      setSmallPackingQty('0');
      setHeavyGoodsQty('0');
      setManualAmount('');
      loadContainer();
    } catch (err) {
      console.error('Erreur création lot direct:', err);
    } finally {
      setSubmittingLot(false);
    }
  };

  const handleCreateNewClientInline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName || !newClientPhoneBody) return;
    setDuplicatePhoneError(null);

    const fullPhone = `${newClientCountryCode} ${newClientPhoneBody.trim()}`;

    try {
      const res = await api.post('/clients', {
        name: newClientName,
        phone: fullPhone
      });
      const created = res.data.client;
      setClients(prev => [...prev, created]);
      setSelectedClientId(String(created.id));
      setIsNewClientModal(false);
      setNewClientName('');
      setNewClientCountryCode('+221');
      setNewClientPhoneBody('');
    } catch (err: any) {
      console.error('Erreur création client inline:', err);
      if (err.response?.data?.error) {
        setDuplicatePhoneError(err.response.data.error);
      }
    }
  };

  const handleConfirmDeleteLot = async () => {
    if (!deletingLot) return;
    setIsDeletingLot(true);

    try {
      await api.delete(`/lots/${deletingLot.id}`);
      setDeletingLot(null);
      loadContainer();
    } catch (err) {
      console.error('Erreur suppression lot:', err);
    } finally {
      setIsDeletingLot(false);
    }
  };

  const handleUpdateStatus = async (newStatus: 'in_transit' | 'arrived' | 'closed') => {
    if (!container) return;
    try {
      const payload: any = { status: newStatus };
      if (newStatus === 'arrived' && !container.actual_arrival) {
        payload.actual_arrival = new Date().toISOString().split('T')[0];
      }
      await api.put(`/containers/${container.id}`, payload);
      loadContainer();
    } catch (err) {
      console.error('Erreur mise à jour statut:', err);
    }
  };

  const handleAddCost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!costAmount || !container) return;
    setAddingCost(true);

    try {
      await api.post(`/containers/${container.id}/costs`, {
        category: costCategory,
        amount: parseFloat(costAmount),
        description: costDescription || null
      });

      setCostAmount('');
      setCostDescription('');
      loadContainer();
    } catch (err) {
      console.error('Erreur ajout coût:', err);
    } finally {
      setAddingCost(false);
    }
  };

  const handleDeleteCost = async (costId: number) => {
    try {
      await api.delete(`/containers/costs/${costId}`);
      loadContainer();
    } catch (err) {
      console.error('Erreur suppression coût:', err);
    }
  };

  const handleImportExcelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;
    setImporting(true);
    setImportMsg(null);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const res = await api.post('/containers/import-excel', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setImportMsg({ type: 'success', text: res.data.message });
      setTimeout(() => {
        setIsImportModalOpen(false);
        if (res.data.container_id) {
          navigate(`/containers/${res.data.container_id}`);
        } else {
          loadContainer();
        }
      }, 1500);
    } catch (err: any) {
      setImportMsg({ type: 'error', text: err.response?.data?.error || 'Erreur lors de l’importation.' });
    } finally {
      setImporting(false);
    }
  };

  if (loading || !container) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  const totalCosts = (container.costs || []).reduce((acc, c) => acc + parseFloat(String(c.amount)), 0);
  const totalRevenue = (container.lots || []).reduce((acc, l) => acc + parseFloat(String(l.final_amount)), 0);
  const netProfit = totalRevenue - totalCosts;

  const lots = container.lots || [];
  const sumCbm = lots.reduce((acc, l) => acc + parseFloat(String(l.volume_cbm || 0)), 0);
  const sumPkgs = lots.reduce((acc, l) => acc + parseInt(String(l.quantity || 1), 10), 0);
  const sumCbmAmount = lots.reduce((acc, l) => {
    const cbm = parseFloat(String(l.volume_cbm || 0));
    const rate = parseFloat(String(l.cbm_rate || 150000));
    return acc + (l.cbm_amount ? parseFloat(String(l.cbm_amount)) : (cbm * rate));
  }, 0);
  const sumBaleAmount = lots.reduce((acc, l) => acc + (parseFloat(String(l.bale_amount || 0)) || ((parseInt(String(l.bale_qty || 0), 10)) * 10000)), 0);
  const sumCopyAmount = lots.reduce((acc, l) => acc + (parseFloat(String(l.copy_amount || 0)) || ((parseFloat(String(l.copy_qty || 0))) * 6000)), 0);
  const sumSmallPackingAmount = lots.reduce((acc, l) => acc + (parseFloat(String(l.small_packing_amount || 0)) || ((parseInt(String(l.small_packing_qty || 0), 10)) * 1000)), 0);
  const sumTotalGeneral = lots.reduce((acc, l) => acc + parseFloat(String(l.final_amount || 0)), 0);

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/containers')}
            className="p-2 rounded-xl bg-card border border-border hover:bg-secondary text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">Conteneur {container.container_number}</h1>
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                container.status === 'arrived' 
                  ? 'bg-emerald-500/10 text-emerald-600'
                  : container.status === 'in_transit'
                  ? 'bg-amber-500/10 text-amber-600'
                  : 'bg-slate-500/10 text-slate-600'
              }`}>
                {container.status === 'arrived' ? 'Arrivé au Port' : container.status === 'in_transit' ? 'En Transit' : 'Clôturé'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground font-semibold flex items-center gap-2 mt-0.5">
              <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-primary" /> {container.origin}</span>
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <div className="flex items-center gap-1 bg-secondary p-1 rounded-xl border border-border">
            <button
              onClick={() => handleUpdateStatus('in_transit')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                container.status === 'in_transit' ? 'bg-amber-500 text-white shadow' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              En Transit
            </button>
            <button
              onClick={() => handleUpdateStatus('arrived')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                container.status === 'arrived' ? 'bg-emerald-600 text-white shadow' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Arrivé
            </button>
            <button
              onClick={() => handleUpdateStatus('closed')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                container.status === 'closed' ? 'bg-slate-700 text-white shadow' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Clôturé
            </button>
          </div>


          <button
            onClick={handleExportExcel}
            disabled={exportingExcel}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-card border border-border hover:bg-secondary text-xs font-bold text-foreground transition-all disabled:opacity-50"
            title="Exporter la fiche au format Excel (.xlsx)"
          >
            <Download className="w-4 h-4 text-blue-600" />
            <span>{exportingExcel ? 'Génération...' : 'Exporter Excel'}</span>
          </button>

          <button
            onClick={() => navigate(`/whatsapp?containerId=${container.id}`)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-md hover:bg-emerald-500 transition-all"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Notifier Clients</span>
          </button>
        </div>
      </div>

      {/* Summary Financial Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-5">
        <div className="p-3.5 sm:p-5 rounded-2xl bg-card border border-border">
          <span className="text-[10px] sm:text-xs font-extrabold text-muted-foreground uppercase">Revenus Brut Facturé</span>
          <p className="text-sm sm:text-xl font-black text-foreground mt-1 truncate">{formatFCFA(totalRevenue)}</p>
        </div>

        <div className="p-3.5 sm:p-5 rounded-2xl bg-card border border-border">
          <span className="text-[10px] sm:text-xs font-extrabold text-red-600 uppercase">Total Coûts (Fret/Douane)</span>
          <p className="text-sm sm:text-xl font-black text-red-600 mt-1 truncate">{formatFCFA(totalCosts)}</p>
        </div>

        <div className="col-span-2 sm:col-span-1 p-3.5 sm:p-5 rounded-2xl bg-card border border-border">
          <span className="text-[10px] sm:text-xs font-extrabold text-emerald-600 uppercase">Marge Nette du Conteneur</span>
          <p className="text-sm sm:text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1 truncate">{formatFCFA(netProfit)}</p>
        </div>
      </div>

      {/* Bloc 1: Saisie des Coûts du Conteneur */}
      <div className="p-4 sm:p-6 rounded-2xl bg-card border border-border shadow-sm space-y-4">
        <h2 className="text-base font-bold flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-primary" />
          <span>Saisie & Historique des Coûts du Conteneur</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Formulaire d'ajout de charge */}
          <form onSubmit={handleAddCost} className="md:col-span-1 space-y-3 text-xs">
            <div>
              <label className="block font-semibold mb-1">Catégorie de Charge</label>
              <select
                value={costCategory}
                onChange={(e: any) => setCostCategory(e.target.value)}
                className="w-full px-3 py-2 bg-secondary border border-border rounded-xl font-medium focus:outline-none"
              >
                <option value="freight">Fret Maritime</option>
                <option value="customs">Frais de Douane & Dédouanement</option>
                <option value="transport">Transport Local & Manutention</option>
                <option value="other">Autres Frais Divers</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold mb-1">Montant (FCFA) *</label>
              <input
                type="number"
                required
                placeholder="Ex: 2500000"
                value={costAmount}
                onChange={(e) => setCostAmount(e.target.value)}
                className="w-full px-3 py-2 bg-secondary border border-border rounded-xl focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold mb-1">Description / Note</label>
              <input
                type="text"
                placeholder="Ex: Facture transitataire..."
                value={costDescription}
                onChange={(e) => setCostDescription(e.target.value)}
                className="w-full px-3 py-2 bg-secondary border border-border rounded-xl focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={addingCost}
              className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>{addingCost ? 'Ajout...' : 'Ajouter cette Charge'}</span>
            </button>
          </form>

          {/* Liste des charges enregistrées */}
          <div className="md:col-span-2 space-y-2">
            <h3 className="text-xs font-bold text-muted-foreground uppercase">Historique des Charges Enregistrées</h3>
            {container.costs && container.costs.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                {container.costs.map((cost) => (
                  <div key={cost.id} className="p-3 rounded-xl bg-secondary/50 flex items-center justify-between text-xs border border-border">
                    <div>
                      <span className="font-bold uppercase text-primary">
                        {cost.category === 'freight' ? 'Fret' : cost.category === 'customs' ? 'Douane' : cost.category === 'transport' ? 'Transport' : 'Autre'}
                      </span>
                      {cost.description && <p className="text-muted-foreground truncate max-w-[150px]">{cost.description}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{formatFCFA(cost.amount)}</span>
                      <button
                        onClick={() => handleDeleteCost(cost.id)}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center rounded-xl bg-secondary/30 text-xs text-muted-foreground italic border border-border">
                Aucune charge enregistrée pour l'instant. Utilisez le formulaire à gauche pour ajouter les frais de fret ou de douane.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bloc 2: Tableau Récapitulatif Client sur TOUTE LA LONGUEUR */}
      <div className="p-4 sm:p-6 rounded-2xl bg-card border border-border shadow-sm space-y-4 w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold flex items-center gap-2">
              <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
              <span>Tableau Récapitulatif Client (Format Excel)</span>
            </h2>
            <p className="text-xs text-muted-foreground">Conforme au modèle Excel officiel (Classeur.xlsx)</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAddLotModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-extrabold shadow-md hover:bg-primary/90 transition-all"
            >
              <UserPlus className="w-4 h-4" />
              <span>+ Ajouter un Lot Client</span>
            </button>
          </div>
        </div>

        {/* En-tête Excel R1 & Connaissement B/L */}
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-semibold text-emerald-950 dark:text-emerald-300">
          <div><span className="text-muted-foreground font-normal">Conteneur :</span> <strong>{container.container_number}</strong></div>
          <div><span className="text-muted-foreground font-normal">B/L :</span> <strong>{container.bl_number || 'SHZ7825000'}</strong></div>
          <div><span className="text-muted-foreground font-normal">Compagnie :</span> <strong>{container.shipping_line || '76CMA'}</strong></div>
          <div><span className="text-muted-foreground font-normal">Agent :</span> <strong>{container.agent_name || 'BABACAR CISSE'}</strong></div>
        </div>

        {/* Tableau Pleine Largeur */}
        <div className="overflow-x-auto border border-border rounded-2xl">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-slate-900 text-white text-xs font-bold uppercase">
              <tr>
                <th className="p-3">NOM CLIENT</th>
                <th className="p-3 text-center">CBM</th>
                <th className="p-3 text-center">PKGS</th>
                <th className="p-3 text-right">PRIX CBM</th>
                <th className="p-3 text-right">TOTAL CBM</th>
                <th className="p-3 text-center">BALES</th>
                <th className="p-3 text-right">TOTAL BALES</th>
                <th className="p-3 text-center">COPY</th>
                <th className="p-3 text-right">TOTAL COPY</th>
                <th className="p-3 text-center">SACS</th>
                <th className="p-3 text-right">TOTAL SACS</th>
                <th className="p-3 text-right bg-emerald-700">TOTAL GENERAL</th>
                <th className="p-3 text-center">STATUT</th>
                <th className="p-3 text-center">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-medium">
              {lots.length > 0 ? (
                lots.map((lot) => {
                  const cbm = parseFloat(String(lot.volume_cbm || 0));
                  const pkgs = parseInt(String(lot.quantity || 1), 10);
                  const cbmRate = parseFloat(String(lot.cbm_rate || 150000));
                  const cbmAmt = lot.cbm_amount ? parseFloat(String(lot.cbm_amount)) : (cbm * cbmRate);

                  const baleQty = parseInt(String(lot.bale_qty || 0), 10);
                  const baleAmt = parseFloat(String(lot.bale_amount || 0)) || (baleQty * 10000);

                  const copyQty = parseFloat(String(lot.copy_qty || 0));
                  const copyAmt = parseFloat(String(lot.copy_amount || 0)) || (copyQty * 6000);

                  const spQty = parseInt(String(lot.small_packing_qty || 0), 10);
                  const spAmt = parseFloat(String(lot.small_packing_amount || 0)) || (spQty * 1000);

                  const totalGen = parseFloat(String(lot.final_amount || 0));

                  return (
                    <tr key={lot.id} className="hover:bg-secondary/40 transition-colors">
                      <td className="p-3 font-bold text-foreground">{lot.client_name}</td>
                      <td className="p-3 text-center font-bold text-primary">{cbm}</td>
                      <td className="p-3 text-center">{pkgs}</td>
                      <td className="p-3 text-right text-muted-foreground">{cbmRate.toLocaleString('fr-FR')} CFA</td>
                      <td className="p-3 text-right font-semibold">{cbmAmt.toLocaleString('fr-FR')} CFA</td>
                      <td className="p-3 text-center">{baleQty || '-'}</td>
                      <td className="p-3 text-right">{baleAmt > 0 ? `${baleAmt.toLocaleString('fr-FR')} CFA` : '-'}</td>
                      <td className="p-3 text-center">{copyQty || '-'}</td>
                      <td className="p-3 text-right">{copyAmt > 0 ? `${copyAmt.toLocaleString('fr-FR')} CFA` : '-'}</td>
                      <td className="p-3 text-center">{spQty || '-'}</td>
                      <td className="p-3 text-right">{spAmt > 0 ? `${spAmt.toLocaleString('fr-FR')} CFA` : '-'}</td>
                      <td className="p-3 text-right font-extrabold text-foreground bg-emerald-500/10">
                        {totalGen.toLocaleString('fr-FR')} CFA
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          lot.payment_status === 'paid'
                            ? 'bg-emerald-500/10 text-emerald-600'
                            : 'bg-amber-500/10 text-amber-600'
                        }`}>
                          {lot.payment_status === 'paid' ? 'OK' : 'EN ATTENTE'}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleOpenEditLot(lot)}
                            className="p-1.5 rounded-lg bg-secondary hover:bg-primary hover:text-white text-muted-foreground transition-colors"
                            title="Modifier ce lot client"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeletingLot(lot)}
                            className="p-1.5 rounded-lg bg-secondary hover:bg-red-600 hover:text-white text-red-500 transition-colors"
                            title="Supprimer ce lot"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={14} className="p-6 text-center text-muted-foreground">
                    Aucun lot client dans ce conteneur.
                  </td>
                </tr>
              )}
            </tbody>

            {lots.length > 0 && (
              <tfoot className="bg-slate-900 text-white font-extrabold text-xs">
                <tr>
                  <td className="p-3">TOTAL GENERAL CONTENEUR</td>
                  <td className="p-3 text-center text-amber-400 font-bold">{sumCbm.toFixed(2)} CBM</td>
                  <td className="p-3 text-center text-amber-400 font-bold">{sumPkgs} PKGS</td>
                  <td className="p-3"></td>
                  <td className="p-3 text-right">{sumCbmAmount.toLocaleString('fr-FR')} CFA</td>
                  <td className="p-3"></td>
                  <td className="p-3 text-right">{sumBaleAmount.toLocaleString('fr-FR')} CFA</td>
                  <td className="p-3"></td>
                  <td className="p-3 text-right">{sumCopyAmount.toLocaleString('fr-FR')} CFA</td>
                  <td className="p-3"></td>
                  <td className="p-3 text-right">{sumSmallPackingAmount.toLocaleString('fr-FR')} CFA</td>
                  <td className="p-3 text-right text-emerald-400 text-sm bg-emerald-950 font-black">
                    {sumTotalGeneral.toLocaleString('fr-FR')} CFA
                  </td>
                  <td className="p-3"></td>
                  <td className="p-3"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Modal Création Lot Client Directement dans ce Conteneur avec React Portal */}
      {isAddLotModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-extrabold flex items-center gap-2">
                <Calculator className="w-6 h-6 text-primary" />
                <span>Ajouter un Lot dans le Conteneur {container.container_number}</span>
              </h2>
              <button
                onClick={() => setIsAddLotModalOpen(false)}
                className="p-1 rounded-lg hover:bg-secondary text-muted-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateLotDirect} className="space-y-5 text-xs">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold">Client *</label>
                  <button
                    type="button"
                    onClick={() => setIsNewClientModal(true)}
                    className="text-primary hover:underline font-bold text-[11px]"
                  >
                    + Nouveau Client
                  </button>
                </div>
                <SearchableSelect
                  options={clients.map(cl => ({
                    value: cl.id,
                    label: cl.name,
                    sublabel: cl.phone
                  }))}
                  value={selectedClientId}
                  onChange={(val) => setSelectedClientId(String(val))}
                  placeholder="Sélectionner ou rechercher un client..."
                  searchPlaceholder="Tapez un nom ou N° téléphone (ex: 77 123...)"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block font-semibold mb-1">Description des Marchandises *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Cartons d'électroménager..."
                    value={productDescription}
                    onChange={(e) => setProductDescription(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-secondary border border-border rounded-xl font-medium focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Nombre de Colis (PKGS)</label>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full px-3 py-2.5 bg-secondary border border-border rounded-xl font-bold text-center focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Volume (CBM) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={volumeCbm}
                    onChange={(e) => setVolumeCbm(e.target.value)}
                    className="w-full px-3 py-2 bg-secondary border border-border rounded-xl font-extrabold text-primary text-base focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Poids (Kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                    className="w-full px-3 py-2 bg-secondary border border-border rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-secondary/50 border border-border space-y-3">
                <h4 className="font-extrabold text-foreground uppercase tracking-wider text-[11px] flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>Services & Frais Annexes (Modèle Classeur.xlsx)</span>
                </h4>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block font-semibold mb-1 text-[11px] truncate">BALES (10.000 F)</label>
                    <input
                      type="number"
                      value={baleQty}
                      onChange={(e) => setBaleQty(e.target.value)}
                      className="w-full px-3 py-2 bg-card border border-border rounded-xl font-bold text-sm"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold mb-1 text-[11px] truncate">COPY (6.000 F)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={copyQty}
                      onChange={(e) => setCopyQty(e.target.value)}
                      className="w-full px-3 py-2 bg-card border border-border rounded-xl font-bold text-sm"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold mb-1 text-[11px] truncate">SACS (1.000 F)</label>
                    <input
                      type="number"
                      value={smallPackingQty}
                      onChange={(e) => setSmallPackingQty(e.target.value)}
                      className="w-full px-3 py-2 bg-card border border-border rounded-xl font-bold text-sm"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold mb-1 text-[11px] truncate" title="Marchandises Lourdes (15.000 F)">LOURDES (15.000 F)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={heavyGoodsQty}
                      onChange={(e) => setHeavyGoodsQty(e.target.value)}
                      className="w-full px-3 py-2 bg-card border border-border rounded-xl font-bold text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20 space-y-2">
                <div className="flex items-center justify-between font-semibold">
                  <span>Calcul Automatique Suggéré :</span>
                  <span className="text-base font-black text-primary">{formatFCFA(calculatedSuggestedAmount)}</span>
                </div>

                <div className="pt-2 border-t border-primary/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <label className="font-bold text-foreground">
                    Montant Final Négocié (FCFA) :
                  </label>
                  <input
                    type="number"
                    placeholder={`Ex: ${calculatedSuggestedAmount}`}
                    value={manualAmount}
                    onChange={(e) => setManualAmount(e.target.value)}
                    className="px-3 py-2 bg-card border border-primary/30 rounded-xl font-extrabold text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary w-full sm:w-48 text-right"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsAddLotModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold hover:bg-secondary"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submittingLot}
                  className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold shadow-md hover:bg-primary/90 disabled:opacity-50"
                >
                  {submittingLot ? 'Enregistrement...' : 'Valider & Ajouter le Lot'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Nouveau Client Inline avec React Portal */}
      {isNewClientModal && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold">Nouveau Client</h3>
            <form onSubmit={handleCreateNewClientInline} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Nom Complet *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Modou Fall"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-xl font-bold"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Téléphone WhatsApp *</label>
                <div className="flex items-center gap-2">
                  <select
                    value={newClientCountryCode}
                    onChange={(e) => setNewClientCountryCode(e.target.value)}
                    className="px-2 py-2 bg-secondary border border-border rounded-xl font-bold text-xs focus:outline-none flex-shrink-0"
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
                    placeholder="Ex: 77 123 45 67 ou 06 12 34..."
                    value={newClientPhoneBody}
                    onChange={(e) => setNewClientPhoneBody(e.target.value)}
                    className="w-full px-3 py-2 bg-secondary border border-border rounded-xl font-bold"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewClientModal(false)}
                  className="px-3 py-1.5 rounded-lg text-xs hover:bg-secondary"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground font-semibold"
                >
                  Créer
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Confirmation Suppression Lot avec React Portal */}
      {deletingLot && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-red-500/10 text-red-500 flex-shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-foreground">Supprimer le Lot Client</h3>
                <p className="text-xs text-muted-foreground">Confirmation de suppression définitive</p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Êtes-vous sûr de vouloir supprimer le lot de <strong className="text-foreground">{deletingLot.client_name}</strong> ({deletingLot.product_description}) ? Cette action est irréversible.
            </p>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
              <button
                type="button"
                onClick={() => setDeletingLot(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold hover:bg-secondary transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteLot}
                disabled={isDeletingLot}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-md shadow-red-600/20 flex items-center gap-2 transition-all disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isDeletingLot ? 'Suppression...' : 'Supprimer Définitivement'}</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Importation Excel avec React Portal */}
      {isImportModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <h2 className="text-lg font-extrabold flex items-center gap-2">
              <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
              <span>Importer un Fichier Excel</span>
            </h2>

            <p className="text-xs text-muted-foreground">
              Sélectionnez un fichier `.xlsx` (ex: `Classeur.xlsx`). Le conteneur et tous ses lots clients seront importés automatiquement.
            </p>

            {importMsg && (
              <div className={`p-3 rounded-xl text-xs font-semibold ${
                importMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'
              }`}>
                {importMsg.text}
              </div>
            )}

            <form onSubmit={handleImportExcelSubmit} className="space-y-4 text-xs">
              <div className="border-2 border-dashed border-border rounded-2xl p-6 text-center space-y-2 hover:border-primary/50 transition-colors">
                <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  required
                  onChange={(e) => setSelectedFile(e.target.files ? e.target.files[0] : null)}
                  className="w-full text-xs text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-4 py-2 rounded-xl hover:bg-secondary font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={importing || !selectedFile}
                  className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-semibold shadow hover:bg-emerald-500 disabled:opacity-50"
                >
                  {importing ? 'Importation en cours...' : 'Importer'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Pop-up Modal d'avertissement Doublon Téléphone */}
      {duplicatePhoneError && createPortal(
        <div className="fixed inset-0 z-[10000] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 text-center">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-extrabold text-foreground">Action Impossible (Téléphone Déjà Utilisé)</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {duplicatePhoneError}
              </p>
            </div>

            <button
              onClick={() => setDuplicatePhoneError(null)}
              className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-md hover:bg-primary/90 transition-all"
            >
              Fermer & Rectifier le Numéro
            </button>
          </div>
        </div>,
        document.body
      )}
      {/* Modal Modification Lot avec React Portal */}
      {editingLot && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-extrabold flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-primary" />
                <span>Modifier le Lot Client</span>
              </h2>
              <button
                onClick={() => setEditingLot(null)}
                className="p-1 rounded-lg hover:bg-secondary text-muted-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditLot} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold mb-1">Description des Marchandises</label>
                <input
                  type="text"
                  required
                  value={editProductDescription}
                  onChange={(e) => setEditProductDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl font-medium focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold mb-1">PKGS (Colis)</label>
                  <input
                    type="number"
                    value={editQuantity}
                    onChange={(e) => setEditQuantity(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl font-bold focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Volume (CBM)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editVolumeCbm}
                    onChange={(e) => setEditVolumeCbm(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl font-bold text-primary focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Poids (Kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editWeightKg}
                    onChange={(e) => setEditWeightKg(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl font-bold focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-semibold mb-1 text-[11px] truncate">BALES (Qty)</label>
                  <input
                    type="number"
                    value={editBaleQty}
                    onChange={(e) => setEditBaleQty(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl font-bold text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-[11px] truncate">COPY (Qty)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editCopyQty}
                    onChange={(e) => setEditCopyQty(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl font-bold text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-[11px] truncate">SACS (Qty)</label>
                  <input
                    type="number"
                    value={editSmallPackingQty}
                    onChange={(e) => setEditSmallPackingQty(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl font-bold text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-[11px] truncate" title="Marchandises Lourdes (Qty)">LOURDES (Qty)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editHeavyGoodsQty}
                    onChange={(e) => setEditHeavyGoodsQty(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl font-bold text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20 space-y-2">
                <div className="flex items-center justify-between font-semibold">
                  <span>Calcul Automatique Suggéré :</span>
                  <span className="text-base font-black text-primary">{formatFCFA(editCalculatedSuggestedAmount)}</span>
                </div>

                <div className="pt-2 border-t border-primary/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <label className="font-bold text-foreground">
                    Montant Final Négocié (FCFA) :
                  </label>
                  <input
                    type="number"
                    placeholder={`Ex: ${editCalculatedSuggestedAmount}`}
                    value={editFinalAmount}
                    onChange={(e) => setEditFinalAmount(e.target.value)}
                    className="px-3 py-2 bg-card border border-primary/30 rounded-xl font-extrabold text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary w-full sm:w-48 text-right"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Statut Paiement</label>
                  <select
                    value={editPaymentStatus}
                    onChange={(e: any) => setEditPaymentStatus(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl font-bold focus:ring-2 focus:ring-primary focus:outline-none"
                  >
                    <option value="unpaid">En Attente</option>
                    <option value="partial">Partiel</option>
                    <option value="paid">Soldé (OK)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1">Statut Retrait</label>
                  <select
                    value={editPickupStatus}
                    onChange={(e: any) => setEditPickupStatus(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl font-bold focus:ring-2 focus:ring-primary focus:outline-none"
                  >
                    <option value="pending">En Attente de Retrait</option>
                    <option value="picked_up">Marchandise Retirée</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary focus:outline-none"
                ></textarea>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setEditingLot(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold hover:bg-secondary"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold shadow hover:bg-primary/90 disabled:opacity-50"
                >
                  {editSubmitting ? 'Enregistrement...' : 'Enregistrer'}
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
