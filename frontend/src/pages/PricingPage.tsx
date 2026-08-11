import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../lib/api';
import { PricingService, Warehouse } from '../types';
import { formatFCFA } from '../lib/utils';
import { Sliders, Plus, Edit2, CheckCircle2, Warehouse as WarehouseIcon, MapPin, Trash2, X } from 'lucide-react';

export const PricingPage: React.FC = () => {
  const [services, setServices] = useState<PricingService[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit Service State
  const [editingService, setEditingService] = useState<PricingService | null>(null);
  const [rateInput, setRateInput] = useState('');
  const [nameInput, setNameInput] = useState('');

  // Warehouse Modal States
  const [isWarehouseModalOpen, setIsWarehouseModalOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
  const [whName, setWhName] = useState('');
  const [whAddress, setWhAddress] = useState('');
  const [whCity, setWhCity] = useState('Dakar');
  const [whPhone, setWhPhone] = useState('');
  const [whIsDefault, setWhIsDefault] = useState(true);
  const [submittingWh, setSubmittingWh] = useState(false);

  const loadData = async () => {
    try {
      const [pricingRes, warehousesRes] = await Promise.all([
        api.get('/pricing'),
        api.get('/warehouses')
      ]);
      setServices(pricingRes.data.services);
      setWarehouses(warehousesRes.data.warehouses);
    } catch (err) {
      console.error('Erreur chargement données tarification:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleEditService = (service: PricingService) => {
    setEditingService(service);
    setNameInput(service.name);
    setRateInput(String(service.default_rate));
  };

  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingService) return;

    try {
      await api.put(`/pricing/${editingService.id}`, {
        name: nameInput,
        default_rate: parseFloat(rateInput)
      });
      setEditingService(null);
      loadData();
    } catch (err) {
      console.error('Erreur mise à jour tarif:', err);
    }
  };

  const handleOpenAddWarehouse = () => {
    setEditingWarehouse(null);
    setWhName('');
    setWhAddress('');
    setWhCity('Dakar');
    setWhPhone('');
    setWhIsDefault(true);
    setIsWarehouseModalOpen(true);
  };

  const handleOpenEditWarehouse = (w: Warehouse) => {
    setEditingWarehouse(w);
    setWhName(w.name);
    setWhAddress(w.address || '');
    setWhCity(w.city || 'Dakar');
    setWhPhone(w.phone || '');
    setWhIsDefault(w.is_default_pickup !== false);
    setIsWarehouseModalOpen(true);
  };

  const handleSaveWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!whName) return;
    setSubmittingWh(true);

    try {
      if (editingWarehouse) {
        await api.put(`/warehouses/${editingWarehouse.id}`, {
          name: whName,
          address: whAddress,
          city: whCity,
          phone: whPhone,
          is_default_pickup: whIsDefault
        });
      } else {
        await api.post('/warehouses', {
          name: whName,
          address: whAddress,
          city: whCity,
          phone: whPhone,
          is_default_pickup: whIsDefault
        });
      }

      setIsWarehouseModalOpen(false);
      loadData();
    } catch (err) {
      console.error('Erreur enregistrement entrepôt:', err);
    } finally {
      setSubmittingWh(false);
    }
  };

  const handleDeleteWarehouse = async (warehouseId: number) => {
    try {
      await api.delete(`/warehouses/${warehouseId}`);
      loadData();
    } catch (err) {
      console.error('Erreur suppression entrepôt:', err);
    }
  };

  // New Service State
  const [isAddServiceModalOpen, setIsAddServiceModalOpen] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newRate, setNewRate] = useState('');
  const [newUnitType, setNewUnitType] = useState<'per_cbm' | 'per_unit'>('per_cbm');
  const [newDescription, setNewDescription] = useState('');
  const [submittingService, setSubmittingService] = useState(false);

  const handleDeleteService = async (serviceId: number) => {
    if (!window.confirm('Voulez-vous vraiment supprimer ce barème de tarification ?')) return;
    try {
      await api.delete(`/pricing/${serviceId}`);
      loadData();
    } catch (err) {
      console.error('Erreur suppression tarif:', err);
    }
  };

  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode || !newName || !newRate) return;
    setSubmittingService(true);

    try {
      await api.post('/pricing', {
        code: newCode,
        name: newName,
        default_rate: parseFloat(newRate),
        unit_type: newUnitType,
        description: newDescription
      });

      setIsAddServiceModalOpen(false);
      setNewCode('');
      setNewName('');
      setNewRate('');
      setNewDescription('');
      loadData();
    } catch (err) {
      console.error('Erreur création tarif:', err);
    } finally {
      setSubmittingService(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight flex items-center gap-2">
          <Sliders className="w-6 h-6 sm:w-7 sm:h-7 text-primary" />
          <span>Barèmes de Tarification CBM & Lieux de Retrait</span>
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground">Configurez le tarif CBM par défaut, les frais annexes et vos entrepôts de retrait WhatsApp.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Section 1: Barèmes & Services CBM */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-extrabold text-foreground">Tarifs CBM & Services Annexes</h2>
                <p className="text-xs text-muted-foreground">Configurez librement les tarifs CBM, frais annexes et suppléments pour votre entreprise.</p>
              </div>
              <button
                onClick={() => setIsAddServiceModalOpen(true)}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-primary text-primary-foreground font-bold text-xs shadow hover:bg-primary/90 transition-all shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Nouveau Barème</span>
              </button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
              {services.map((service) => (
                <div key={service.id} className="p-3.5 sm:p-6 rounded-2xl bg-card border border-border shadow-sm flex flex-col justify-between space-y-3 sm:space-y-4">
                  <div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-primary/10 text-primary text-[10px] sm:text-xs font-extrabold uppercase">
                        {service.code}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleEditService(service)}
                          className="p-1 sm:p-1.5 rounded-lg bg-secondary hover:bg-primary hover:text-white text-muted-foreground text-xs transition-colors"
                          title="Modifier le tarif"
                        >
                          <Edit2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteService(service.id)}
                          className="p-1 sm:p-1.5 rounded-lg bg-secondary hover:bg-red-600 hover:text-white text-red-500 text-xs transition-colors"
                          title="Supprimer ce tarif"
                        >
                          <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </button>
                      </div>
                    </div>

                    <h3 className="font-extrabold text-xs sm:text-lg mt-2 sm:mt-3 leading-tight">{service.name}</h3>
                    <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1 line-clamp-2">{service.description}</p>
                  </div>

                  <div className="p-2.5 sm:p-4 rounded-xl bg-secondary/50 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <span className="text-[10px] sm:text-xs font-semibold text-muted-foreground">
                      Tarif par {service.unit_type === 'per_cbm' ? 'CBM' : 'unité'} :
                    </span>
                    <span className="text-xs sm:text-lg font-black text-primary truncate">{formatFCFA(service.default_rate)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: Gestion Dynamique des Lieux de Retrait / Entrepôts */}
          <div className="space-y-4 p-6 rounded-3xl bg-card border border-border shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-extrabold text-foreground flex items-center gap-2">
                  <WarehouseIcon className="w-5 h-5 text-emerald-600" />
                  <span>Entrepôts & Lieux de Retrait (Injectés dans les messages WhatsApp)</span>
                </h2>
                <p className="text-xs text-muted-foreground">Les entrepôts saisis ici alimentent automatiquement la rubrique "📍 Lieux de retrait disponibles" des messages WhatsApp envoyés aux clients.</p>
              </div>

              <button
                onClick={handleOpenAddWarehouse}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-xs shadow hover:bg-primary/90 transition-all self-start"
              >
                <Plus className="w-4 h-4" />
                <span>Nouveau Lieu de Retrait</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
              {warehouses.map((w, idx) => (
                <div key={w.id} className="p-4 rounded-2xl bg-secondary/50 border border-border flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-600 font-extrabold text-xs flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <h4 className="font-extrabold text-sm text-foreground">{w.name}</h4>
                      {w.is_default_pickup !== false ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[10px] font-extrabold">
                          ✓ WhatsApp Défaut
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-secondary text-muted-foreground text-[10px] font-semibold">
                          Non coché par défaut
                        </span>
                      )}
                    </div>
                    {w.address && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                        <span>{w.address} ({w.city})</span>
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEditWarehouse(w)}
                      className="p-1.5 rounded-lg bg-card hover:bg-primary hover:text-white text-muted-foreground transition-colors"
                      title="Modifier cet entrepôt"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteWarehouse(w.id)}
                      className="p-1.5 rounded-lg bg-card hover:bg-red-600 hover:text-white text-red-500 transition-colors"
                      title="Supprimer cet entrepôt"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal Edition Tarif avec React Portal */}
      {editingService && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-extrabold">Modifier le Barème</h3>
            <form onSubmit={handleSaveService} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold mb-1">Nom du Service</label>
                <input
                  type="text"
                  required
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-secondary border border-border rounded-xl font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Tarif de base (FCFA)</label>
                <input
                  type="number"
                  required
                  value={rateInput}
                  onChange={(e) => setRateInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-secondary border border-border rounded-xl font-bold text-primary text-base"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingService(null)}
                  className="px-4 py-2 rounded-xl text-xs hover:bg-secondary font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Création/Modification Entrepôt avec React Portal */}
      {isWarehouseModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-extrabold flex items-center gap-2">
                <WarehouseIcon className="w-5 h-5 text-emerald-600" />
                <span>{editingWarehouse ? 'Modifier l’Entrepôt' : 'Nouveau Lieu de Retrait'}</span>
              </h3>
              <button
                onClick={() => setIsWarehouseModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-secondary text-muted-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveWarehouse} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold mb-1">Nom de l'Entrepôt *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Entrepôt Médina"
                  value={whName}
                  onChange={(e) => setWhName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-secondary border border-border rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Adresse Complète</label>
                <input
                  type="text"
                  placeholder="Ex: Rue 1X8, Médina"
                  value={whAddress}
                  onChange={(e) => setWhAddress(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-secondary border border-border rounded-xl font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Ville</label>
                  <input
                    type="text"
                    value={whCity}
                    onChange={(e) => setWhCity(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-secondary border border-border rounded-xl font-medium"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Téléphone de contact</label>
                  <input
                    type="text"
                    placeholder="Ex: +221 77..."
                    value={whPhone}
                    onChange={(e) => setWhPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-secondary border border-border rounded-xl font-medium"
                  />
                </div>
              </div>

              <div className="pt-1">
                <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer select-none text-foreground">
                  <input
                    type="checkbox"
                    checked={whIsDefault}
                    onChange={(e) => setWhIsDefault(e.target.checked)}
                    className="w-4 h-4 rounded text-primary border-border focus:ring-primary accent-primary"
                  />
                  <span>Cocher par défaut cet entrepôt dans les notifications WhatsApp</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsWarehouseModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs hover:bg-secondary font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submittingWh}
                  className="px-5 py-2 rounded-xl bg-primary text-primary-foreground font-semibold shadow disabled:opacity-50"
                >
                  {submittingWh ? 'Enregistrement...' : 'Valider'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Création Nouveau Barème CBM avec React Portal */}
      {isAddServiceModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 text-foreground">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-extrabold flex items-center gap-2">
                <Sliders className="w-5 h-5 text-primary" />
                <span>Ajouter un Nouveau Barème / Service</span>
              </h3>
              <button
                onClick={() => setIsAddServiceModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-secondary text-muted-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateService} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Code Raccourci *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: FRIGO"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-secondary border border-border rounded-xl font-bold uppercase text-primary"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Unité de Calcul *</label>
                  <select
                    value={newUnitType}
                    onChange={(e: any) => setNewUnitType(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-secondary border border-border rounded-xl font-bold"
                  >
                    <option value="per_cbm">Par CBM</option>
                    <option value="per_unit">Par Unité / Pièce</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Nom du Barème / Service *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Transport Conteneur Frigorifique"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-secondary border border-border rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Tarif de Base (FCFA) *</label>
                <input
                  type="number"
                  required
                  placeholder="Ex: 200000"
                  value={newRate}
                  onChange={(e) => setNewRate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-secondary border border-border rounded-xl font-black text-primary text-base"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Description / Notes</label>
                <textarea
                  rows={2}
                  placeholder="Notes explicatives pour la facturation..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-secondary border border-border rounded-xl"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsAddServiceModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs hover:bg-secondary font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submittingService}
                  className="px-5 py-2 rounded-xl bg-primary text-primary-foreground font-semibold shadow disabled:opacity-50"
                >
                  {submittingService ? 'Création...' : 'Créer le Barème'}
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
