import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import api from '../lib/api';
import { Lot, Container, Client, PricingService, Warehouse } from '../types';
import { formatFCFA, formatDate } from '../lib/utils';
import { Package, Plus, Search, Filter, Calculator, CheckCircle2, UserPlus, FileSpreadsheet, Edit2, Trash2, X, AlertTriangle } from 'lucide-react';
import { SearchableSelect } from '../components/ui/SearchableSelect';

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

export const LotsPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialContainerId = searchParams.get('container_id');

  const [lots, setLots] = useState<Lot[]>([]);
  const [containers, setContainers] = useState<Container[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [pricingServices, setPricingServices] = useState<PricingService[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'unpaid' | 'partial' | 'paid'>('all');
  const [pickupFilter, setPickupFilter] = useState<'all' | 'pending' | 'picked_up'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State - Creation
  const [selectedContainerId, setSelectedContainerId] = useState<string>(initialContainerId || '');
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
  const [productDescription, setProductDescription] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [weightKg, setWeightKg] = useState('0');
  const [volumeCbm, setVolumeCbm] = useState('1');

  // Excel Specific Services
  const [baleQty, setBaleQty] = useState('0');
  const [copyQty, setCopyQty] = useState('0');
  const [smallPackingQty, setSmallPackingQty] = useState('0');
  const [heavyGoodsQty, setHeavyGoodsQty] = useState('0');

  // Manual Override
  const [manualAmount, setManualAmount] = useState<string>('');
  const [notes, setNotes] = useState('');

  // Edit Lot State
  const [editingLot, setEditingLot] = useState<Lot | null>(null);
  const [editProductDescription, setEditProductDescription] = useState('');
  const [editQuantity, setEditQuantity] = useState('1');
  const [editWeightKg, setEditWeightKg] = useState('0');
  const [editVolumeCbm, setEditVolumeCbm] = useState('1');
  const [editBaleQty, setEditBaleQty] = useState('0');
  const [editCopyQty, setEditCopyQty] = useState('0');
  const [editSmallPackingQty, setEditSmallPackingQty] = useState('0');
  const [editHeavyGoodsQty, setEditHeavyGoodsQty] = useState('0');
  const [editFinalAmount, setEditFinalAmount] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editPaymentStatus, setEditPaymentStatus] = useState<'unpaid' | 'partial' | 'paid'>('unpaid');
  const [editPickupStatus, setEditPickupStatus] = useState<'pending' | 'picked_up'>('pending');
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Delete Lot Modal State
  const [deletingLot, setDeletingLot] = useState<Lot | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // New Client Inline Form
  const [isNewClientModal, setIsNewClientModal] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientCountryCode, setNewClientCountryCode] = useState('+221');
  const [newClientPhoneBody, setNewClientPhoneBody] = useState('');
  const [duplicatePhoneError, setDuplicatePhoneError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    try {
      const [lotsRes, containersRes, clientsRes, pricingRes, warehousesRes] = await Promise.all([
        api.get('/lots'),
        api.get('/containers'),
        api.get('/clients'),
        api.get('/pricing'),
        api.get('/warehouses')
      ]);

      setLots(lotsRes.data.lots);
      setContainers(containersRes.data.containers);
      setClients(clientsRes.data.clients);
      setPricingServices(pricingRes.data.services);
      setWarehouses(warehousesRes.data.warehouses);

      if (containersRes.data.containers.length > 0 && !selectedContainerId) {
        setSelectedContainerId(String(containersRes.data.containers[0].id));
      }
      if (clientsRes.data.clients.length > 0 && !selectedClientId) {
        setSelectedClientId(String(clientsRes.data.clients[0].id));
      }
      if (warehousesRes.data.warehouses.length > 0 && !selectedWarehouseId) {
        setSelectedWarehouseId(String(warehousesRes.data.warehouses[0].id));
      }
    } catch (err) {
      console.error('Erreur chargement lots:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

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

  const handleCreateLot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContainerId || !selectedClientId || !productDescription) return;
    setSubmitting(true);

    try {
      await api.post('/lots', {
        container_id: parseInt(selectedContainerId, 10),
        client_id: parseInt(selectedClientId, 10),
        warehouse_id: selectedWarehouseId ? parseInt(selectedWarehouseId, 10) : null,
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

      setIsModalOpen(false);
      setProductDescription('');
      setBaleQty('0');
      setCopyQty('0');
      setSmallPackingQty('0');
      setHeavyGoodsQty('0');
      setManualAmount('');
      loadData();
    } catch (err) {
      console.error('Erreur création lot:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEdit = (lot: Lot) => {
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
      await api.put(`/lots/${editingLot.id}`, {
        product_description: editProductDescription,
        quantity: parseInt(editQuantity, 10) || 1,
        weight_kg: parseFloat(editWeightKg) || 0,
        volume_cbm: parseFloat(editVolumeCbm) || 0,
        bale_qty: parseInt(editBaleQty, 10) || 0,
        copy_qty: parseFloat(editCopyQty) || 0,
        small_packing_qty: parseInt(editSmallPackingQty, 10) || 0,
        heavy_goods_qty: parseFloat(editHeavyGoodsQty) || 0,
        manual_final_amount: parseFloat(editFinalAmount) || 0,
        notes: editNotes || null,
        payment_status: editPaymentStatus,
        pickup_status: editPickupStatus
      });

      setEditingLot(null);
      loadData();
    } catch (err) {
      console.error('Erreur modification lot:', err);
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleConfirmDeleteLot = async () => {
    if (!deletingLot) return;
    setIsDeleting(true);

    try {
      await api.delete(`/lots/${deletingLot.id}`);
      setDeletingLot(null);
      loadData();
    } catch (err) {
      console.error('Erreur suppression lot:', err);
    } finally {
      setIsDeleting(false);
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

  const handlePickupToggle = async (lot: Lot) => {
    const nextStatus = lot.pickup_status === 'picked_up' ? 'pending' : 'picked_up';
    try {
      await api.put(`/lots/${lot.id}/pickup`, {
        pickup_status: nextStatus,
        pickup_date: nextStatus === 'picked_up' ? new Date().toISOString().split('T')[0] : null
      });
      loadData();
    } catch (err) {
      console.error('Erreur mise à jour statut retrait:', err);
    }
  };

  const filteredLots = lots.filter(l => {
    const matchesSearch = (
      (l.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) || '') ||
      (l.product_description?.toLowerCase().includes(searchTerm.toLowerCase()) || '') ||
      (l.container_number?.toLowerCase().includes(searchTerm.toLowerCase()) || '')
    );

    const matchesPayment = paymentFilter === 'all' || l.payment_status === paymentFilter;
    const matchesPickup = pickupFilter === 'all' || l.pickup_status === pickupFilter;

    return matchesSearch && matchesPayment && matchesPickup;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Lots Clients & Calcul CBM</h1>
          <p className="text-sm text-muted-foreground">Enregistrez, modifiez ou supprimez les colis des clients.</p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm shadow-md hover:bg-primary/90 transition-all self-start"
        >
          <Plus className="w-4 h-4" />
          <span>Nouveau Lot Client</span>
        </button>
      </div>

      {/* Search & Filters Bar */}
      <div className="p-4 rounded-2xl bg-card border border-border flex flex-col md:flex-row items-stretch md:items-center gap-3 sm:gap-4 shadow-sm">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Rechercher par client, conteneur ou produit..."
            className="w-full pl-10 pr-4 py-2 bg-secondary border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary font-medium"
          />
        </div>

        {/* Filtre Statut Paiement */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-muted-foreground whitespace-nowrap hidden lg:inline">Paiement :</span>
          <select
            value={paymentFilter}
            onChange={(e: any) => setPaymentFilter(e.target.value)}
            className="px-3 py-2 bg-secondary border border-border rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary text-foreground cursor-pointer"
          >
            <option value="all">Tous les Paiements</option>
            <option value="unpaid">🔴 En Attente (Non payé)</option>
            <option value="partial">🟠 Paiement Partiel</option>
            <option value="paid">🟢 Soldé (Payé)</option>
          </select>
        </div>

        {/* Filtre Statut Retrait */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-muted-foreground whitespace-nowrap hidden lg:inline">Retrait :</span>
          <select
            value={pickupFilter}
            onChange={(e: any) => setPickupFilter(e.target.value)}
            className="px-3 py-2 bg-secondary border border-border rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary text-foreground cursor-pointer"
          >
            <option value="all">Tous les Retraits</option>
            <option value="pending">⏳ En Attente de Retrait</option>
            <option value="picked_up">📦 Marchandise Retirée</option>
          </select>
        </div>

        {/* Reset Button */}
        {(paymentFilter !== 'all' || pickupFilter !== 'all' || searchTerm !== '') && (
          <button
            onClick={() => {
              setSearchTerm('');
              setPaymentFilter('all');
              setPickupFilter('all');
            }}
            className="px-3 py-2 rounded-xl bg-destructive/10 text-destructive text-xs font-bold hover:bg-destructive/20 transition-colors whitespace-nowrap"
            title="Réinitialiser tous les filtres"
          >
            Réinitialiser
          </button>
        )}
      </div>

      {/* Lots Table */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="p-3 sm:p-4 rounded-2xl bg-card border border-border shadow-sm overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="border-b border-border text-[11px] font-extrabold text-muted-foreground uppercase bg-secondary/50 tracking-wider">
              <tr>
                <th className="px-3 py-2.5">Client & Contact</th>
                <th className="px-3 py-2.5">Conteneur</th>
                <th className="px-3 py-2.5">Marchandise</th>
                <th className="px-3 py-2.5">Volume / Colis</th>
                <th className="px-3 py-2.5">Montant Suggéré</th>
                <th className="px-3 py-2.5">Montant Final</th>
                <th className="px-3 py-2.5">Paiement</th>
                <th className="px-3 py-2.5">Statut Retrait</th>
                <th className="px-3 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredLots.map((lot) => (
                <tr key={lot.id} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-3 py-2.5">
                    <p className="font-bold text-foreground text-xs">{lot.client_name}</p>
                    <p className="text-[11px] text-muted-foreground">{lot.client_phone}</p>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="font-extrabold text-primary text-xs">{lot.container_number}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <p className="font-medium text-xs max-w-[200px] truncate">{lot.product_description}</p>
                    <span className="text-[11px] text-muted-foreground">{lot.quantity} PKGS</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <p className="font-semibold text-xs">{lot.volume_cbm} CBM</p>
                    <span className="text-[11px] text-muted-foreground">{lot.quantity} colis</span>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground text-xs font-medium">
                    {formatFCFA(lot.suggested_amount)}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="font-extrabold text-foreground text-xs">{formatFCFA(lot.final_amount)}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold ${
                      lot.payment_status === 'paid'
                        ? 'bg-emerald-500/10 text-emerald-600'
                        : lot.payment_status === 'partial'
                        ? 'bg-amber-500/10 text-amber-600'
                        : 'bg-red-500/10 text-red-600'
                    }`}>
                      {lot.payment_status === 'paid' ? 'OK (Soldé)' : lot.payment_status === 'partial' ? 'Partiel' : 'En Attente'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <button
                      onClick={() => handlePickupToggle(lot)}
                      className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold transition-all ${
                        lot.pickup_status === 'picked_up'
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'bg-secondary border border-border text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {lot.pickup_status === 'picked_up' ? '✓ Retiré' : 'En attente'}
                    </button>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleOpenEdit(lot)}
                        className="p-1.5 rounded-lg bg-secondary hover:bg-primary hover:text-white text-muted-foreground transition-colors"
                        title="Modifier ce lot"
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
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Création Lot Client avec React Portal */}
      {isModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-extrabold flex items-center gap-2">
              <Calculator className="w-6 h-6 text-primary" />
              <span>Calcul & Saisie d'un Lot Client</span>
            </h2>

            <form onSubmit={handleCreateLot} className="space-y-5 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold mb-1">Conteneur *</label>
                  <SearchableSelect
                    options={containers.map(c => ({
                      value: c.id,
                      label: c.container_number,
                      sublabel: `${c.origin} ${c.bl_number ? `- B/L ${c.bl_number}` : ''}`
                    }))}
                    value={selectedContainerId}
                    onChange={(val) => setSelectedContainerId(String(val))}
                    placeholder="Sélectionner ou rechercher un conteneur..."
                    searchPlaceholder="Tapez N° conteneur, B/L ou provenance..."
                  />
                </div>

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
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold hover:bg-secondary"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold shadow-md hover:bg-primary/90 disabled:opacity-50"
                >
                  {submitting ? 'Enregistrement...' : 'Valider & Créer le Lot'}
                </button>
              </div>
            </form>
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
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-xl font-medium"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold mb-1">PKGS (Colis)</label>
                  <input
                    type="number"
                    value={editQuantity}
                    onChange={(e) => setEditQuantity(e.target.value)}
                    className="w-full px-3 py-2 bg-secondary border border-border rounded-xl font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Volume (CBM)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editVolumeCbm}
                    onChange={(e) => setEditVolumeCbm(e.target.value)}
                    className="w-full px-3 py-2 bg-secondary border border-border rounded-xl font-bold text-primary"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Poids (Kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editWeightKg}
                    onChange={(e) => setEditWeightKg(e.target.value)}
                    className="w-full px-3 py-2 bg-secondary border border-border rounded-xl font-bold"
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
                    className="w-full px-3 py-2 bg-secondary border border-border rounded-xl font-bold text-sm"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-[11px] truncate">COPY (Qty)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editCopyQty}
                    onChange={(e) => setEditCopyQty(e.target.value)}
                    className="w-full px-3 py-2 bg-secondary border border-border rounded-xl font-bold text-sm"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-[11px] truncate">SACS (Qty)</label>
                  <input
                    type="number"
                    value={editSmallPackingQty}
                    onChange={(e) => setEditSmallPackingQty(e.target.value)}
                    className="w-full px-3 py-2 bg-secondary border border-border rounded-xl font-bold text-sm"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-[11px] truncate" title="Marchandises Lourdes (Qty)">LOURDES (Qty)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editHeavyGoodsQty}
                    onChange={(e) => setEditHeavyGoodsQty(e.target.value)}
                    className="w-full px-3 py-2 bg-secondary border border-border rounded-xl font-bold text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Montant Final Facturé (FCFA)</label>
                <input
                  type="number"
                  required
                  value={editFinalAmount}
                  onChange={(e) => setEditFinalAmount(e.target.value)}
                  className="w-full px-3 py-2.5 bg-secondary border border-border rounded-xl font-extrabold text-foreground text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Statut Paiement</label>
                  <select
                    value={editPaymentStatus}
                    onChange={(e: any) => setEditPaymentStatus(e.target.value)}
                    className="w-full px-3 py-2 bg-secondary border border-border rounded-xl font-bold"
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
                    className="w-full px-3 py-2 bg-secondary border border-border rounded-xl font-bold"
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
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-xl"
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
    </div>
  );
};
