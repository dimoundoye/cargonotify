import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { PricingService, Warehouse } from '../types';
import { formatFCFA } from '../lib/utils';
import { SignatureScannerModal } from '../components/SignatureScannerModal';
import { 
  Settings, 
  Building2, 
  Phone, 
  Mail, 
  MapPin, 
  Warehouse as WarehouseIcon, 
  Plus, 
  Edit2, 
  Trash2, 
  CheckCircle2, 
  MessageSquare, 
  User,
  Lock,
  KeyRound,
  ShieldCheck, 
  Save,
  Sliders,
  Stamp,
  Upload,
  X,
  AlertCircle
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'general' | 'pricing' | 'account'>('general');

  // General Settings State (Loaded dynamically from DB)
  const [companyName, setCompanyName] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [currency, setCurrency] = useState('FCFA');
  const [signatureBase64, setSignatureBase64] = useState<string | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const [generalSaveSuccess, setGeneralSaveSuccess] = useState(false);
  const [savingGeneral, setSavingGeneral] = useState(false);

  // Pricing Services State
  const [services, setServices] = useState<PricingService[]>([]);
  const [editingService, setEditingService] = useState<PricingService | null>(null);
  const [rateInput, setRateInput] = useState('');
  const [nameInput, setNameInput] = useState('');

  // New Service Modal
  const [isAddServiceModalOpen, setIsAddServiceModalOpen] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newRate, setNewRate] = useState('');
  const [newUnitType, setNewUnitType] = useState<'per_cbm' | 'per_unit'>('per_cbm');
  const [newDescription, setNewDescription] = useState('');
  const [submittingService, setSubmittingService] = useState(false);

  // Warehouses State
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loadingWh, setLoadingWh] = useState(true);

  // Warehouse Modal States
  const [isWarehouseModalOpen, setIsWarehouseModalOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
  const [whName, setWhName] = useState('');
  const [whAddress, setWhAddress] = useState('');
  const [whCity, setWhCity] = useState('Dakar');
  const [whPhone, setWhPhone] = useState('');
  const [submittingWh, setSubmittingWh] = useState(false);

  // Change Password State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdSubmitting, setPwdSubmitting] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdSuccess, setPwdSuccess] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [compRes, whRes, pricingRes] = await Promise.all([
        api.get('/settings/company'),
        api.get('/warehouses'),
        api.get('/pricing')
      ]);

      if (compRes.data.settings) {
        const s = compRes.data.settings;
        setCompanyName(s.company_name);
        setCompanyPhone(s.phone);
        setCompanyEmail(s.email);
        setCompanyAddress(s.address);
        setCurrency(s.currency);
        setSignatureBase64(s.signature_base64 || null);
      }

      setWarehouses(whRes.data.warehouses);
      setServices(pricingRes.data.services);
    } catch (err) {
      console.error('Erreur chargement données paramètres:', err);
    } finally {
      setLoadingWh(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveCompanySettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingGeneral(true);
    setGeneralSaveSuccess(false);

    try {
      await api.put('/settings/company', {
        company_name: companyName,
        phone: companyPhone,
        email: companyEmail,
        address: companyAddress,
        currency,
        signature_base64: signatureBase64
      });

      setGeneralSaveSuccess(true);
      setTimeout(() => setGeneralSaveSuccess(false), 4000);
    } catch (err) {
      console.error('Erreur enregistrement profil entreprise:', err);
    } finally {
      setSavingGeneral(false);
    }
  };

  const handleSaveSignature = async (base64Png: string) => {
    setSignatureBase64(base64Png);
    try {
      await api.put('/settings/company', {
        company_name: companyName,
        phone: companyPhone,
        email: companyEmail,
        address: companyAddress,
        currency,
        signature_base64: base64Png
      });
      setGeneralSaveSuccess(true);
      setTimeout(() => setGeneralSaveSuccess(false), 4000);
    } catch (err) {
      console.error('Erreur sauvegarde signature:', err);
    }
  };

  const handleRemoveSignature = async () => {
    setSignatureBase64(null);
    try {
      await api.put('/settings/company', {
        company_name: companyName,
        phone: companyPhone,
        email: companyEmail,
        address: companyAddress,
        currency,
        signature_base64: null
      });
    } catch (err) {
      console.error('Erreur suppression signature:', err);
    }
  };

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

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError(null);
    setPwdSuccess(null);

    if (newPassword !== confirmPassword) {
      setPwdError('Les deux nouveaux mots de passe ne correspondent pas.');
      return;
    }

    if (newPassword.length < 6) {
      setPwdError('Le nouveau mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    setPwdSubmitting(true);
    try {
      const res = await api.post('/auth/change-password', {
        currentPassword,
        newPassword
      });

      setPwdSuccess(res.data.message || 'Votre mot de passe a été mis à jour avec succès !');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPwdError(err.response?.data?.error || 'Erreur lors du changement de mot de passe.');
    } finally {
      setPwdSubmitting(false);
    }
  };

  const handleOpenAddWarehouse = () => {
    setEditingWarehouse(null);
    setWhName('');
    setWhAddress('');
    setWhCity('Dakar');
    setWhPhone('');
    setIsWarehouseModalOpen(true);
  };

  const handleOpenEditWarehouse = (w: Warehouse) => {
    setEditingWarehouse(w);
    setWhName(w.name);
    setWhAddress(w.address || '');
    setWhCity(w.city || 'Dakar');
    setWhPhone(w.phone || '');
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
          phone: whPhone
        });
      } else {
        await api.post('/warehouses', {
          name: whName,
          address: whAddress,
          city: whCity,
          phone: whPhone
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

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
          <Settings className="w-7 h-7 text-primary" />
          <span>Paramètres du Système</span>
        </h1>
        <p className="text-sm text-muted-foreground">Gérez le profil de votre entreprise, votre cachet/signature officielle, les tarifs CBM et vos lieux de retrait.</p>
      </div>

      {/* Sub-Tabs Selector */}
      <div className="flex items-center gap-2 p-1.5 bg-secondary border border-border rounded-2xl w-fit flex-wrap">
        <button
          onClick={() => setActiveTab('general')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'general'
              ? 'bg-card text-foreground shadow-sm border border-border'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Building2 className="w-4 h-4 text-primary" />
          <span>Général, Cachet & Entreprise</span>
        </button>

        <button
          onClick={() => setActiveTab('pricing')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'pricing'
              ? 'bg-card text-foreground shadow-sm border border-border'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Sliders className="w-4 h-4 text-primary" />
          <span>Tarifs & Services CBM</span>
        </button>

        <button
          onClick={() => setActiveTab('account')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'account'
              ? 'bg-card text-foreground shadow-sm border border-border'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <User className="w-4 h-4 text-primary" />
          <span>Compte & Sécurité</span>
        </button>
      </div>

      {/* TAB 1: Général, Cachet & Entreprise */}
      {activeTab === 'general' && (
        <div className="space-y-8 animate-in fade-in duration-200">
          {generalSaveSuccess && (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 font-bold text-xs flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" />
              <span>Paramètres de l'entreprise et Cachet Officiel enregistrés avec succès !</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Formulaire Profil Société & Cachet */}
            <div className="lg:col-span-1 space-y-6">
              <div className="p-6 rounded-3xl bg-card border border-border shadow-sm space-y-5">
                <h2 className="text-base font-extrabold flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-primary" />
                  <span>Profil de l'Entreprise</span>
                </h2>

                <form onSubmit={handleSaveCompanySettings} className="space-y-4 text-xs">
                  <div>
                    <label className="block font-semibold mb-1">Nom de la Société *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: CargoNotify Transit"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-secondary border border-border rounded-xl font-bold"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold mb-1">Téléphone Principal *</label>
                    <div className="relative">
                      <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="text"
                        required
                        placeholder="Ex: +221 77 872 16 15"
                        value={companyPhone}
                        onChange={(e) => setCompanyPhone(e.target.value)}
                        className="w-full pl-9 pr-3.5 py-2.5 bg-secondary border border-border rounded-xl font-bold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold mb-1">Email Officiel *</label>
                    <div className="relative">
                      <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="email"
                        required
                        placeholder="Ex: contact@cargonotify.sn"
                        value={companyEmail}
                        onChange={(e) => setCompanyEmail(e.target.value)}
                        className="w-full pl-9 pr-3.5 py-2.5 bg-secondary border border-border rounded-xl font-bold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold mb-1">Adresse du Siège *</label>
                    <div className="relative">
                      <MapPin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="text"
                        required
                        placeholder="Ex: Dakar, Sénégal"
                        value={companyAddress}
                        onChange={(e) => setCompanyAddress(e.target.value)}
                        className="w-full pl-9 pr-3.5 py-2.5 bg-secondary border border-border rounded-xl font-bold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold mb-1">Devise Principale</label>
                    <input
                      type="text"
                      required
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-secondary border border-border rounded-xl font-black text-primary"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={savingGeneral}
                    className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-bold flex items-center justify-center gap-2 shadow hover:bg-primary/90 transition-all disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    <span>{savingGeneral ? 'Enregistrement BD...' : 'Enregistrer le Profil'}</span>
                  </button>
                </form>
              </div>

              {/* Cachet & Signature de l'Entreprise Card */}
              <div className="p-6 rounded-3xl bg-card border border-border shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-extrabold flex items-center gap-2">
                    <Stamp className="w-5 h-5 text-amber-500" />
                    <span>Cachet Officiel & Signature</span>
                  </h2>
                </div>
                <p className="text-xs text-muted-foreground">
                  Le cachet numérisé avec fond transparent est automatiquement apposé sur la partie droite de vos reçus de paiement PDF (à côté du QR code).
                </p>

                {signatureBase64 ? (
                  <div className="p-4 rounded-2xl bg-secondary/50 border border-border flex flex-col items-center gap-3">
                    <div className="p-3 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:10px_10px] dark:bg-[radial-gradient(#334155_1px,transparent_1px)] border border-border rounded-xl">
                      <img src={signatureBase64} alt="Cachet Entreprise" className="max-h-28 object-contain" />
                    </div>
                    <div className="flex items-center gap-2 w-full">
                      <button
                        onClick={() => setIsScannerOpen(true)}
                        className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground font-bold text-xs shadow hover:bg-primary/90 flex items-center justify-center gap-1.5"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Changer</span>
                      </button>
                      <button
                        onClick={handleRemoveSignature}
                        className="px-3 py-2 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 font-bold text-xs border border-red-500/20 flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Effacer</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsScannerOpen(true)}
                    className="w-full py-4 border-2 border-dashed border-border rounded-2xl bg-secondary/30 hover:bg-secondary/60 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground transition-all"
                  >
                    <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-500">
                      <Upload className="w-6 h-6" />
                    </div>
                    <span className="font-extrabold text-xs text-foreground">Ajouter la Photo de votre Cachet / Signature</span>
                    <span className="text-[10px] text-muted-foreground">Suppression automatique du fond blanc inclus</span>
                  </button>
                )}
              </div>
            </div>

            {/* Entrepôts de Retrait & Modèle WhatsApp */}
            <div className="lg:col-span-2 space-y-6">
              <div className="p-6 rounded-3xl bg-card border border-border shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-extrabold flex items-center gap-2">
                      <WarehouseIcon className="w-5 h-5 text-emerald-600" />
                      <span>Lieux de Retrait WhatsApp (Entrepôts)</span>
                    </h2>
                    <p className="text-xs text-muted-foreground">Ces entrepôts sont automatiquement injectés dans les messages WhatsApp.</p>
                  </div>

                  <button
                    onClick={handleOpenAddWarehouse}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-primary text-primary-foreground font-bold text-xs shadow hover:bg-primary/90 transition-all self-start"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Nouveau Lieu</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  {warehouses.map((w, idx) => (
                    <div key={w.id} className="p-4 rounded-2xl bg-secondary/50 border border-border flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-600 font-extrabold text-xs flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <h4 className="font-extrabold text-sm text-foreground">{w.name}</h4>
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

              {/* Aperçu WhatsApp */}
              <div className="p-6 rounded-3xl bg-card border border-border shadow-sm space-y-4">
                <h2 className="text-base font-extrabold flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-emerald-600" />
                  <span>Aperçu du Message WhatsApp Généré (Données Dynamiques)</span>
                </h2>

                <div className="p-4 rounded-2xl bg-secondary/50 border border-border">
                  <pre className="whitespace-pre-wrap font-sans text-xs text-muted-foreground leading-relaxed">
{`📦 *${companyName || 'CargoNotify'} — Notification d'arrivée de Marchandise*

Bonjour *[Nom du Client]*,

Nous avons le plaisir de vous informer que le conteneur *N° [Code Conteneur]* (Provenance : [Provenance]) est bien arrivé !

📋 *Vos Colis concernés :*
[Description des marchandise]

💰 *Statut Financier :*
- Montant Total : *[Montant ${currency || 'FCFA'}]*
- Reste à régler pour retrait : *[Solde ${currency || 'FCFA'}]*

📍 *Lieux de retrait disponibles :*
${warehouses.map((w, i) => `${i + 1}️⃣ ${w.name}${w.address ? ' : ' + w.address : ''}`).join('\n')}

Merci de vous munir de votre pièce d'identité et de votre reçu de paiement pour la remise.
Pour toute question, contactez-nous directement au ${companyPhone}.`}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Tarifs & Services CBM */}
      {activeTab === 'pricing' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-extrabold flex items-center gap-2 text-foreground">
                <Sliders className="w-5 h-5 text-primary" />
                <span>Barèmes de Tarification CBM & Services Annexes</span>
              </h2>
              <p className="text-xs text-muted-foreground">Ajustez les tarifs au m³ (CBM), frais par balle, copie, sac et marchandises lourdes.</p>
            </div>

            <button
              onClick={() => setIsAddServiceModalOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-primary text-primary-foreground font-bold text-xs shadow hover:bg-primary/90 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Nouveau Barème</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((service) => (
              <div key={service.id} className="p-6 rounded-3xl bg-card border border-border shadow-sm flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-extrabold uppercase">
                      {service.code}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEditService(service)}
                        className="p-1.5 rounded-lg bg-secondary hover:bg-primary hover:text-white text-muted-foreground text-xs transition-colors"
                        title="Modifier le tarif"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteService(service.id)}
                        className="p-1.5 rounded-lg bg-secondary hover:bg-red-600 hover:text-white text-red-500 text-xs transition-colors"
                        title="Supprimer ce tarif"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <h3 className="font-extrabold text-base mt-3 leading-tight text-foreground">{service.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{service.description}</p>
                </div>

                <div className="p-4 rounded-2xl bg-secondary/50 border border-border flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">
                    Tarif par {service.unit_type === 'per_cbm' ? 'CBM (m³)' : 'Unité'} :
                  </span>
                  <span className="text-base font-black text-primary truncate">{formatFCFA(service.default_rate)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: Compte & Sécurité */}
      {activeTab === 'account' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in duration-200">
          <div className="p-6 rounded-3xl bg-card border border-border shadow-sm space-y-5">
            <h2 className="text-base font-extrabold flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              <span>Informations sur votre Compte</span>
            </h2>

            <div className="flex items-center gap-4 p-4 rounded-2xl bg-secondary/50 border border-border">
              <div className="w-14 h-14 rounded-2xl bg-primary text-primary-foreground font-black text-xl flex items-center justify-center shadow-md shadow-primary/20">
                {user?.name?.charAt(0).toUpperCase() || 'A'}
              </div>
              <div className="space-y-1">
                <h3 className="font-extrabold text-base text-foreground">{user?.name || 'Administrateur'}</h3>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
                <span className="inline-block px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 text-[10px] font-bold uppercase">
                  Rôle : {user?.role || 'Administrateur'}
                </span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-secondary/30 space-y-2 text-xs text-muted-foreground">
              <div className="flex items-center justify-between">
                <span>Statut du Compte :</span>
                <span className="font-bold text-emerald-600">✓ Actif</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Accès Réseau :</span>
                <span className="font-bold text-foreground">Autorisé</span>
              </div>
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-card border border-border shadow-sm space-y-5">
            <h2 className="text-base font-extrabold flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-amber-500" />
              <span>Changer le Mot de Passe</span>
            </h2>

            {pwdError && (
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{pwdError}</span>
              </div>
            )}

            {pwdSuccess && (
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{pwdSuccess}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold mb-1">Mot de passe actuel *</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 bg-secondary border border-border rounded-xl font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Nouveau mot de passe *</label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="password"
                    required
                    placeholder="Au moins 6 caractères"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 bg-secondary border border-border rounded-xl font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Confirmer le nouveau mot de passe *</label>
                <div className="relative">
                  <ShieldCheck className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="password"
                    required
                    placeholder="Répétez le nouveau mot de passe"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 bg-secondary border border-border rounded-xl font-bold"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={pwdSubmitting}
                className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs shadow-md shadow-amber-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{pwdSubmitting ? 'Mise à jour...' : 'Mettre à Jour le Mot de Passe'}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Numérisation Cachet / Signature */}
      <SignatureScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onSave={handleSaveSignature}
        existingSignatureUrl={signatureBase64}
      />

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
                    <option value="per_cbm">Par CBM (m³)</option>
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
    </div>
  );
};
