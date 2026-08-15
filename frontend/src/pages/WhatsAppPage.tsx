import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import api from '../lib/api';
import { Container, Warehouse } from '../types';
import { MessageSquare, Send, CheckCircle2, QrCode, Smartphone, RefreshCw, LogOut, CheckSquare, Square, AlertCircle, Sparkles, X, Eye, MapPin } from 'lucide-react';
import { SearchableSelect } from '../components/ui/SearchableSelect';

interface NotificationItem {
  client_id: number;
  client_name: string;
  client_phone: string;
  lot_id: number;
  product_description: string;
  total_due?: number;
  remaining_balance: number;
  raw_template?: string;
  company_name?: string;
  company_phone?: string;
  container_number?: string;
  origin?: string;
  currency?: string;
  message: string;
  wa_link: string;
}

const formatFrontendArrivalMessage = (
  template: string | undefined,
  companyName: string,
  companyPhone: string,
  clientName: string,
  containerNumber: string,
  origin: string,
  productDesc: string,
  totalDue: number,
  remainingDue: number,
  pickupLocationsText: string,
  currency: string = 'FCFA'
) => {
  const defaultTemplate = `📦 *[Nom Société] — Notification d'arrivée de Marchandise*

Bonjour *[Nom du Client]*,

Nous avons le plaisir de vous informer que le conteneur *N° [Code Conteneur]* (Provenance : [Provenance]) est bien arrivé !

📋 *Vos Colis concernés :*
[Description des marchandise]

💰 *Statut Financier :*
- Montant Total : *[Montant FCFA]*
- Reste à régler pour retrait : *[Solde FCFA]*

📍 *Lieux de retrait disponibles :*
[Lieux de Retrait]

Merci de vous munir de votre pièce d'identité et de votre reçu de paiement pour la remise.
Pour toute question, contactez-nous directement au [Téléphone Support].`;

  let msg = (template && template.trim()) ? template : defaultTemplate;

  msg = msg.replace(/\[(Nom Société|Nom Entreprise|Entreprise|Société)\]/gi, companyName || 'CargoNotify');
  msg = msg.replace(/\[(Nom du Client|Nom Client|Client)\]/gi, clientName || 'Client');
  msg = msg.replace(/\[(Code Conteneur|N° Conteneur|Numero Conteneur|Conteneur)\]/gi, containerNumber || '');
  msg = msg.replace(/\[(Provenance|Origine)\]/gi, origin || '');
  msg = msg.replace(/\[(Description des marchandise|Description des marchandises|Marchandises|Marchandise|Colis)\]/gi, productDesc || '');
  msg = msg.replace(/\[(Montant FCFA|Montant Total|Montant)\]/gi, `${parseFloat(totalDue as any || 0).toLocaleString('fr-FR')} ${currency}`);
  msg = msg.replace(/\[(Solde FCFA|Solde|Reste à régler)\]/gi, `${parseFloat(remainingDue as any || 0).toLocaleString('fr-FR')} ${currency}`);
  msg = msg.replace(/\[(Lieux de Retrait|Lieux de retrait disponibles|Lieu de Retrait|Entrepôts)\]/gi, pickupLocationsText || '');
  msg = msg.replace(/\[(Téléphone Support|Tél Support|Contact Support|Téléphone)\]/gi, companyPhone || '');

  return msg;
};

interface WhatsAppStatus {
  isConnected: boolean;
  qrCodeDataUrl: string | null;
  connectedPhone: string | null;
  statusText: string;
}

export const WhatsAppPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialContainerId = searchParams.get('containerId');

  const [containers, setContainers] = useState<Container[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedContainerId, setSelectedContainerId] = useState<string>(initialContainerId || '');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [selectedLotIds, setSelectedLotIds] = useState<number[]>([]);
  const [clientWarehouseSelection, setClientWarehouseSelection] = useState<Record<number, number[]>>({});
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);

  // Modal View Full Message State
  const [viewingMessage, setViewingMessage] = useState<{
    client_name: string;
    client_phone: string;
    message: string;
  } | null>(null);

  // Custom Feedback Modal
  const [feedbackModal, setFeedbackModal] = useState<{
    isOpen: boolean;
    type: 'success' | 'error';
    title: string;
    message: string;
  }>({
    isOpen: false,
    type: 'success',
    title: '',
    message: ''
  });

  // WhatsApp Baileys Status
  const [waStatus, setWaStatus] = useState<WhatsAppStatus>({
    isConnected: false,
    qrCodeDataUrl: null,
    connectedPhone: null,
    statusText: 'Chargement du statut...'
  });

  const checkWhatsAppStatus = async () => {
    try {
      const res = await api.get('/whatsapp/status');
      setWaStatus(res.data);
    } catch (err) {
      console.error('Erreur status WhatsApp:', err);
    }
  };

  const isPhoneValid = (phone?: string) => {
    if (!phone) return false;
    const clean = phone.replace(/\D/g, '');
    return clean.length >= 6;
  };

  const loadContainersAndLogs = async () => {
    try {
      const [cRes, lRes, wRes] = await Promise.all([
        api.get('/containers'),
        api.get('/whatsapp/logs'),
        api.get('/warehouses')
      ]);

      setContainers(cRes.data.containers);
      setLogs(lRes.data.logs);
      setWarehouses(wRes.data.warehouses);

      if (cRes.data.containers.length > 0 && !selectedContainerId) {
        setSelectedContainerId(String(cRes.data.containers[0].id));
      }
    } catch (err) {
      console.error('Erreur chargement conteneurs / logs:', err);
    }
  };

  const generateLocationsText = (whIds: number[], allWh: Warehouse[]) => {
    const selectedList = allWh.filter(w => whIds.includes(w.id));
    if (selectedList.length === 0) {
      return '📍 Contactez notre service client pour le lieu de retrait.';
    }
    const numberEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
    return selectedList.map((w, idx) => {
      const emoji = numberEmojis[idx] || `${idx + 1}.`;
      const addr = w.address ? ` : ${w.address}` : '';
      const phone = w.phone ? ` (Tél : ${w.phone})` : '';
      return `${emoji} ${w.name}${addr}${phone}`;
    }).join('\n');
  };

  const loadPreview = async (containerId: string) => {
    if (!containerId) return;
    setLoading(true);
    try {
      const [previewRes, whRes] = await Promise.all([
        api.get(`/whatsapp/preview/${containerId}`),
        api.get('/warehouses')
      ]);

      const currentWarehouses: Warehouse[] = whRes.data.warehouses || [];
      setWarehouses(currentWarehouses);

      const defaultWhIds = currentWarehouses
        .filter(w => w.is_default_pickup !== false)
        .map(w => w.id);

      const initialSelections: Record<number, number[]> = {};
      const updatedNotifs = (previewRes.data.notifications || []).map((n: NotificationItem) => {
        initialSelections[n.lot_id] = defaultWhIds;

        const locText = generateLocationsText(defaultWhIds, currentWarehouses);
        const updatedMsg = formatFrontendArrivalMessage(
          n.raw_template,
          n.company_name || '',
          n.company_phone || '',
          n.client_name,
          n.container_number || '',
          n.origin || '',
          n.product_description,
          n.total_due || 0,
          n.remaining_balance || 0,
          locText,
          n.currency || 'FCFA'
        );
        
        const cleanPhone = n.client_phone.replace(/\D/g, '');
        const fullPhone = cleanPhone.startsWith('221') ? cleanPhone : `221${cleanPhone}`;
        const updatedLink = `https://wa.me/${fullPhone}?text=${encodeURIComponent(updatedMsg)}`;

        return {
          ...n,
          message: updatedMsg,
          wa_link: updatedLink
        };
      });

      setClientWarehouseSelection(initialSelections);
      setNotifications(updatedNotifs);
      setSelectedLotIds(updatedNotifs.map((n: NotificationItem) => n.lot_id));
    } catch (err) {
      console.error('Erreur prévisualisation:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContainersAndLogs();
    checkWhatsAppStatus();

    const interval = setInterval(checkWhatsAppStatus, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedContainerId) {
      loadPreview(selectedContainerId);
    }
  }, [selectedContainerId]);

  const handleDisconnect = async () => {
    try {
      await api.post('/whatsapp/disconnect');
      checkWhatsAppStatus();
    } catch (err) {
      console.error('Erreur déconnexion:', err);
    }
  };

  const toggleSelectAll = () => {
    if (selectedLotIds.length === notifications.length) {
      setSelectedLotIds([]);
    } else {
      setSelectedLotIds(notifications.map(n => n.lot_id));
    }
  };

  const toggleSelectLot = (lotId: number) => {
    if (selectedLotIds.includes(lotId)) {
      setSelectedLotIds(selectedLotIds.filter(id => id !== lotId));
    } else {
      setSelectedLotIds([...selectedLotIds, lotId]);
    }
  };

  const toggleClientWarehouse = (lotId: number, warehouseId: number) => {
    setClientWarehouseSelection(prev => {
      const current = prev[lotId] || [];
      const updatedWhIds = current.includes(warehouseId)
        ? current.filter(id => id !== warehouseId)
        : [...current, warehouseId];

      const newSelection = { ...prev, [lotId]: updatedWhIds };

      setNotifications(oldNotifs => oldNotifs.map(n => {
        if (n.lot_id !== lotId) return n;

        const locText = generateLocationsText(updatedWhIds, warehouses);
        const updatedMsg = formatFrontendArrivalMessage(
          n.raw_template,
          n.company_name || '',
          n.company_phone || '',
          n.client_name,
          n.container_number || '',
          n.origin || '',
          n.product_description,
          n.total_due || 0,
          n.remaining_balance || 0,
          locText,
          n.currency || 'FCFA'
        );

        const cleanPhone = n.client_phone.replace(/\D/g, '');
        const fullPhone = cleanPhone.startsWith('221') ? cleanPhone : `221${cleanPhone}`;
        const updatedLink = `https://wa.me/${fullPhone}?text=${encodeURIComponent(updatedMsg)}`;

        return {
          ...n,
          message: updatedMsg,
          wa_link: updatedLink
        };
      }));

      return newSelection;
    });
  };

  const handleSendBulkAuto = async () => {
    const toSend = notifications.filter(n => selectedLotIds.includes(n.lot_id));
    if (toSend.length === 0) return;

    const validToSend = toSend.filter(n => isPhoneValid(n.client_phone));
    const missingCount = toSend.length - validToSend.length;

    if (validToSend.length === 0) {
      setFeedbackModal({
        isOpen: true,
        type: 'error',
        title: 'Téléphones Manquants',
        message: 'Impossible d\'envoyer : aucun des clients sélectionnés ne possède un numéro de téléphone renseigné.'
      });
      return;
    }

    setSending(true);
    try {
      const res = await api.post('/whatsapp/send-bulk', {
        containerId: selectedContainerId ? parseInt(selectedContainerId, 10) : null,
        notifications: validToSend
      });

      const messageText = missingCount > 0
        ? `${validToSend.length} notification(s) envoyée(s). Note : ${missingCount} client(s) ignoré(s) car leur numéro de téléphone est manquant.`
        : res.data.message || `${validToSend.length} notification(s) envoyée(s) avec succès.`;

      setFeedbackModal({
        isOpen: true,
        type: 'success',
        title: 'Envoi des Notifications Réussi !',
        message: messageText
      });

      loadContainersAndLogs();
    } catch (err: any) {
      setFeedbackModal({
        isOpen: true,
        type: 'error',
        title: 'Échec de l\'Envoi',
        message: err.response?.data?.error || 'Une erreur est survenue lors de l’envoi automatique.'
      });
    } finally {
      setSending(false);
    }
  };

  const handleSingleAutoSend = async (n: NotificationItem) => {
    try {
      await api.post('/whatsapp/send-single', {
        client_id: n.client_id,
        container_id: selectedContainerId ? parseInt(selectedContainerId, 10) : null,
        phone: n.client_phone,
        message: n.message
      });

      setFeedbackModal({
        isOpen: true,
        type: 'success',
        title: 'Notification Envoyée !',
        message: `Le message a été envoyé avec succès à ${n.client_name} (${n.client_phone}).`
      });

      loadContainersAndLogs();
    } catch (err: any) {
      setFeedbackModal({
        isOpen: true,
        type: 'error',
        title: 'Échec de l\'Envoi',
        message: err.response?.data?.error || 'Échec d\'envoi via l\'API WhatsApp.'
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Centre de Notifications WhatsApp</h1>
        <p className="text-sm text-muted-foreground">Envoyez les alertes d'arrivée de conteneurs en 1-clic aux clients.</p>
      </div>

      {/* WhatsApp Connection Status Card (Baileys) */}
      <div className="p-6 rounded-3xl bg-card border border-border shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-2xl ${waStatus.isConnected ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'}`}>
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base">Connexion WhatsApp Directe (+221)</h3>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  waStatus.isConnected ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                }`}>
                  {waStatus.isConnected ? '● Connecté' : '○ Déconnecté'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {waStatus.isConnected 
                  ? `Compte actif : ${waStatus.connectedPhone || '+221 76 162 95 29'}` 
                  : waStatus.statusText}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={checkWhatsAppStatus}
              className="p-2 rounded-xl bg-secondary hover:bg-border text-muted-foreground hover:text-foreground transition-colors"
              title="Rafraîchir l'état"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {waStatus.isConnected ? (
              <button
                onClick={handleDisconnect}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-600 text-xs font-bold transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Déconnecter Session</span>
              </button>
            ) : (
              <button
                onClick={() => api.post('/whatsapp/connect')}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow hover:bg-primary/90 transition-all"
              >
                <QrCode className="w-4 h-4" />
                <span>Générer QR Code</span>
              </button>
            )}
          </div>
        </div>

        {/* QR Code Display Box when disconnected */}
        {!waStatus.isConnected && waStatus.qrCodeDataUrl && (
          <div className="p-5 rounded-2xl bg-secondary/50 border border-border flex flex-col sm:flex-row items-center gap-6">
            <div className="p-3 bg-white rounded-2xl shadow-md border border-slate-200">
              <img src={waStatus.qrCodeDataUrl} alt="QR Code WhatsApp" className="w-44 h-44 object-contain" />
            </div>
            <div className="space-y-2 text-xs">
              <h4 className="font-extrabold text-sm text-foreground flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>Scannez ce QR Code avec WhatsApp (+221 7X XXX XX XX)</span>
              </h4>
              <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground font-medium">
                <li>Ouvrez WhatsApp sur votre téléphone (ex: <strong>+221 7X XXX XX XX</strong>).</li>
                <li>Allez dans <strong>Réglages / Menu ➔ Appareils connectés</strong>.</li>
                <li>Appuyez sur <strong>Connecter un appareil</strong> et scannez ce QR Code.</li>
              </ol>
              <p className="text-[11px] text-emerald-600 font-semibold pt-1">
                ✓ Une fois scanné, vous pourrez envoyer toutes vos notifications d'arrivée en 1-clic depuis votre numéro Sénégal !
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Container Selector & Actions Bar */}
      <div className="p-6 rounded-2xl bg-card border border-border shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="w-full sm:w-80">
            <label className="block text-xs font-semibold mb-1">Sélectionner un Conteneur *</label>
            <SearchableSelect
              options={containers.map(c => ({
                value: c.id,
                label: `Conteneur ${c.container_number}`,
                sublabel: `${c.origin} ${c.bl_number ? `- B/L ${c.bl_number}` : ''}`
              }))}
              value={selectedContainerId}
              onChange={(val) => setSelectedContainerId(String(val))}
              placeholder="Sélectionner ou rechercher un conteneur..."
              searchPlaceholder="Tapez N° conteneur, B/L ou provenance..."
            />
          </div>

          {notifications.length > 0 && (
            <div className="flex items-center gap-3">
              <button
                onClick={toggleSelectAll}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-secondary hover:bg-border text-xs font-semibold"
              >
                {selectedLotIds.length === notifications.length ? (
                  <CheckSquare className="w-4 h-4 text-primary" />
                ) : (
                  <Square className="w-4 h-4 text-muted-foreground" />
                )}
                <span>Tout Sélectionner ({selectedLotIds.length}/{notifications.length})</span>
              </button>

              <button
                onClick={handleSendBulkAuto}
                disabled={sending || selectedLotIds.length === 0}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-md hover:bg-emerald-500 disabled:opacity-50 transition-all"
              >
                <Send className="w-4 h-4" />
                <span>{sending ? 'Envoi en cours...' : `Envoyer ${selectedLotIds.length} Alerte(s) (Automatique)`}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Notifications List avec Bouton "Voir le message" */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[30vh]">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
        </div>
      ) : notifications.length > 0 ? (
        <div className="space-y-4">
          {notifications.map((n) => {
            const isSelected = selectedLotIds.includes(n.lot_id);
            return (
              <div
                key={n.lot_id}
                className={`p-5 rounded-2xl border transition-all ${
                  isSelected ? 'bg-card border-primary/40 shadow-sm' : 'bg-card/50 border-border opacity-75'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => toggleSelectLot(n.lot_id)}
                      className="mt-1 text-primary focus:outline-none"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-5 h-5 text-primary" />
                      ) : (
                        <Square className="w-5 h-5 text-muted-foreground" />
                      )}
                    </button>
                    <div>
                      <h4 className="font-extrabold text-base text-foreground">{n.client_name}</h4>
                      {isPhoneValid(n.client_phone) ? (
                        <p className="text-xs text-muted-foreground font-semibold">{n.client_phone}</p>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-500/10 text-red-600 border border-red-500/20 text-[11px] font-extrabold mt-0.5">
                          <AlertCircle className="w-3 h-3" />
                          <span>N° Téléphone Manquant</span>
                        </span>
                      )}
                      <span className="inline-block px-2.5 py-0.5 rounded-full bg-secondary text-[11px] font-bold text-foreground mt-1 ml-2">
                        {n.product_description}
                      </span>
                    </div>
                  </div>

                  {/* Actions Row avec Bouton "Voir le message" */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => setViewingMessage({ client_name: n.client_name, client_phone: n.client_phone || 'Non renseigné', message: n.message })}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-secondary hover:bg-border text-xs font-bold text-foreground transition-all"
                    >
                      <Eye className="w-3.5 h-3.5 text-primary" />
                      <span>Voir le message</span>
                    </button>

                    {isPhoneValid(n.client_phone) ? (
                      <>
                        <button
                          onClick={() => handleSingleAutoSend(n)}
                          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow transition-all"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Envoyer 1-Clic</span>
                        </button>

                        <a
                          href={n.wa_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-secondary hover:bg-border text-xs font-bold text-foreground transition-all"
                        >
                          <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Ouvrir App WhatsApp</span>
                        </a>
                      </>
                    ) : (
                      <span className="px-3 py-1.5 rounded-xl bg-secondary text-muted-foreground text-xs font-bold italic">
                        ⚠️ Ajoutez un N° dans "Tous les Clients"
                      </span>
                    )}
                  </div>
                </div>

                {/* Sélecteur de Lieux de Retrait par Coche pour ce Client */}
                {warehouses.length > 0 && (
                  <div className="mt-3 p-3 rounded-2xl bg-secondary/50 border border-border space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-extrabold text-foreground flex items-center gap-1.5 uppercase tracking-wider">
                        <MapPin className="w-3.5 h-3.5 text-primary" />
                        <span>Lieux de retrait à inclure dans le message :</span>
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-0.5">
                      {warehouses.map((w) => {
                        const isChecked = (clientWarehouseSelection[n.lot_id] || []).includes(w.id);
                        return (
                          <label
                            key={w.id}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer select-none ${
                              isChecked
                                ? 'bg-primary/10 border-primary/40 text-primary shadow-sm'
                                : 'bg-card border-border text-muted-foreground hover:border-primary/20'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleClientWarehouse(n.lot_id, w.id)}
                              className="w-4 h-4 rounded text-primary border-border focus:ring-primary accent-primary"
                            />
                            <span>{w.name} {w.address ? `(${w.address})` : ''}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-8 text-center bg-card border border-border rounded-2xl text-muted-foreground">
          Aucune notification disponible pour ce conteneur.
        </div>
      )}

      {/* Modal Visualisation du Message Complet avec React Portal */}
      {viewingMessage && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-foreground">Message WhatsApp</h3>
                <p className="text-xs text-muted-foreground">{viewingMessage.client_name} ({viewingMessage.client_phone})</p>
              </div>
              <button
                onClick={() => setViewingMessage(null)}
                className="p-1.5 rounded-xl hover:bg-secondary text-muted-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-secondary/50 border border-border max-h-96 overflow-y-auto">
              <pre className="whitespace-pre-wrap font-sans text-xs text-foreground leading-relaxed">
                {viewingMessage.message}
              </pre>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                onClick={() => setViewingMessage(null)}
                className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow hover:bg-primary/90"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* WhatsApp Logs History */}
      {logs.length > 0 && (
        <div className="p-6 rounded-2xl bg-card border border-border space-y-4">
          <h3 className="text-base font-bold flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>Historique des Notifications Envoyées</span>
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border text-muted-foreground uppercase">
                <tr>
                  <th className="p-2.5">Date & Heure</th>
                  <th className="p-2.5">Client</th>
                  <th className="p-2.5">Téléphone</th>
                  <th className="p-2.5">Conteneur</th>
                  <th className="p-2.5">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="p-2.5 text-muted-foreground">
                      {new Date(log.sent_at).toLocaleString('fr-FR')}
                    </td>
                    <td className="p-2.5 font-bold">{log.client_name || 'Client'}</td>
                    <td className="p-2.5">{log.phone}</td>
                    <td className="p-2.5 font-semibold text-primary">{log.container_number || '-'}</td>
                    <td className="p-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        log.status === 'sent' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-500'
                      }`}>
                        {log.status === 'sent' ? '✓ ENVOYÉ' : 'ÉCHEC'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Custom Styled Feedback Modal avec React Portal */}
      {feedbackModal.isOpen && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 text-center">
            <div className={`mx-auto w-14 h-14 rounded-2xl flex items-center justify-center ${
              feedbackModal.type === 'success' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-500'
            }`}>
              {feedbackModal.type === 'success' ? (
                <CheckCircle2 className="w-8 h-8" />
              ) : (
                <AlertCircle className="w-8 h-8" />
              )}
            </div>

            <div className="space-y-1.5">
              <h3 className="text-lg font-extrabold text-foreground">{feedbackModal.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {feedbackModal.message}
              </p>
            </div>

            <button
              onClick={() => setFeedbackModal({ ...feedbackModal, isOpen: false })}
              className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-md hover:bg-primary/90 transition-all"
            >
              D'accord, compris
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
