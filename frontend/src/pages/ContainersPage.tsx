import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { Container } from '../types';
import { formatFCFA, formatDate } from '../lib/utils';
import { Container as ContainerIcon, Plus, Search, Filter, Calendar, MapPin, ArrowRight, Edit2, Trash2, X, AlertTriangle, FileSpreadsheet, Upload, CheckCircle2, Users, UserPlus } from 'lucide-react';

export const ContainersPage: React.FC = () => {
  const [containers, setContainers] = useState<Container[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Excel Import state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [duplicateMatches, setDuplicateMatches] = useState<{ excel_name: string; existing_id: number; existing_name: string; existing_phone: string }[] | null>(null);
  const [resolutions, setResolutions] = useState<{ [excelName: string]: 'existing' | 'new' }>({});

  // Create Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [containerNumber, setContainerNumber] = useState('');
  const [blNumber, setBlNumber] = useState('');
  const [shippingLine, setShippingLine] = useState('');
  const [agentName, setAgentName] = useState('');
  const [origin, setOrigin] = useState('Chine (Guangzhou)');
  const [loadingDate, setLoadingDate] = useState('');
  const [expectedArrival, setExpectedArrival] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Edit Modal State
  const [editingContainer, setEditingContainer] = useState<Container | null>(null);
  const [editContainerNumber, setEditContainerNumber] = useState('');
  const [editBlNumber, setEditBlNumber] = useState('');
  const [editShippingLine, setEditShippingLine] = useState('');
  const [editAgentName, setEditAgentName] = useState('');
  const [editOrigin, setEditOrigin] = useState('');
  const [editLoadingDate, setEditLoadingDate] = useState('');
  const [editExpectedArrival, setEditExpectedArrival] = useState('');
  const [editActualArrival, setEditActualArrival] = useState('');
  const [editStatus, setEditStatus] = useState<'in_transit' | 'arrived' | 'closed'>('in_transit');
  const [editNotes, setEditNotes] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Delete Modal State
  const [deletingContainer, setDeletingContainer] = useState<Container | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const navigate = useNavigate();

  const loadContainers = async () => {
    try {
      const res = await api.get('/containers');
      setContainers(res.data.containers);
    } catch (err) {
      console.error('Erreur chargement conteneurs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContainers();
  }, []);

  const handleCreateContainer = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);

    try {
      await api.post('/containers', {
        container_number: containerNumber,
        bl_number: blNumber || null,
        shipping_line: shippingLine || null,
        agent_name: agentName || null,
        origin,
        loading_date: loadingDate || null,
        expected_arrival: expectedArrival || null,
        notes: notes || null
      });

      setIsModalOpen(false);
      setContainerNumber('');
      setBlNumber('');
      setShippingLine('');
      setAgentName('');
      setNotes('');
      loadContainers();
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Erreur lors de la création du conteneur.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEdit = (container: Container) => {
    setEditingContainer(container);
    setEditContainerNumber(container.container_number);
    setEditBlNumber(container.bl_number || '');
    setEditShippingLine(container.shipping_line || '');
    setEditAgentName(container.agent_name || '');
    setEditOrigin(container.origin);
    setEditLoadingDate(container.loading_date ? container.loading_date.split('T')[0] : '');
    setEditExpectedArrival(container.expected_arrival ? container.expected_arrival.split('T')[0] : '');
    setEditActualArrival(container.actual_arrival ? container.actual_arrival.split('T')[0] : '');
    setEditStatus(container.status);
    setEditNotes(container.notes || '');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingContainer) return;
    setEditSubmitting(true);

    try {
      await api.put(`/containers/${editingContainer.id}`, {
        container_number: editContainerNumber,
        bl_number: editBlNumber || null,
        shipping_line: editShippingLine || null,
        agent_name: editAgentName || null,
        origin: editOrigin,
        loading_date: editLoadingDate || null,
        expected_arrival: editExpectedArrival || null,
        actual_arrival: editActualArrival || null,
        status: editStatus,
        notes: editNotes || null
      });

      setEditingContainer(null);
      loadContainers();
    } catch (err: any) {
      console.error('Erreur lors de la modification:', err);
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingContainer) return;
    setIsDeleting(true);

    try {
      await api.delete(`/containers/${deletingContainer.id}`);
      setDeletingContainer(null);
      loadContainers();
    } catch (err: any) {
      console.error('Erreur lors de la suppression:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleImportExcelSubmit = async (e?: React.FormEvent, isConfirmed = false) => {
    if (e) e.preventDefault();
    if (!selectedFile) return;
    setImporting(true);
    setImportMsg(null);

    const formData = new FormData();
    formData.append('file', selectedFile);
    if (isConfirmed) {
      formData.append('confirm_duplicates', 'true');
      formData.append('resolutions', JSON.stringify(resolutions));
    }

    try {
      const res = await api.post('/containers/import-excel', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data.requires_confirmation) {
        setDuplicateMatches(res.data.matches);
        const initialResolutions: { [name: string]: 'existing' | 'new' } = {};
        res.data.matches.forEach((m: any) => {
          initialResolutions[m.excel_name] = 'existing';
        });
        setResolutions(initialResolutions);
        return;
      }

      setDuplicateMatches(null);
      setImportMsg({ type: 'success', text: res.data.message });
      setTimeout(() => {
        setIsImportModalOpen(false);
        if (res.data.container_id) {
          navigate(`/containers/${res.data.container_id}`);
        } else {
          loadContainers();
        }
      }, 1200);
    } catch (err: any) {
      setImportMsg({
        type: 'error',
        text: err.response?.data?.error || 'Erreur lors de l’importation du fichier Excel.'
      });
    } finally {
      setImporting(false);
    }
  };

  const filteredContainers = containers.filter(c => {
    const matchesSearch = c.container_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          c.origin.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (c.bl_number && c.bl_number.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Gestion des Conteneurs</h1>
          <p className="text-sm text-muted-foreground">Suivez les expéditions, importez vos manifestes Excel ou créez de nouveaux conteneurs.</p>
        </div>

        <div className="flex items-center gap-3 self-start">
          <button
            onClick={() => {
              setImportMsg(null);
              setSelectedFile(null);
              setIsImportModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-md shadow-emerald-600/20 transition-all"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Importer Fichier Excel</span>
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-extrabold text-xs shadow-md hover:bg-primary/90 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Créer un Conteneur</span>
          </button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="p-4 rounded-2xl bg-card border border-border flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Rechercher par N°, B/L ou provenance..."
            className="w-full pl-10 pr-4 py-2 bg-secondary border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-secondary border border-border rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">Tous les statuts</option>
            <option value="in_transit">En Transit</option>
            <option value="arrived">Arrivé au Port</option>
            <option value="closed">Clôturé</option>
          </select>
        </div>
      </div>

      {/* Containers Grid */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredContainers.map((container) => (
            <div
              key={container.id}
              className="p-6 rounded-2xl bg-card border border-border shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-primary/10 text-primary flex-shrink-0">
                      <ContainerIcon className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-lg leading-tight">{container.container_number}</h3>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground font-medium mt-0.5">
                        <MapPin className="w-3.5 h-3.5 text-primary" />
                        <span>{container.origin}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(container)}
                      className="p-1.5 rounded-lg bg-secondary hover:bg-primary hover:text-white text-muted-foreground transition-colors"
                      title="Modifier le conteneur"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => setDeletingContainer(container)}
                      className="p-1.5 rounded-lg bg-secondary hover:bg-red-600 hover:text-white text-red-500 transition-colors"
                      title="Supprimer le conteneur"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-secondary/50 space-y-2 text-xs">
                  {container.bl_number && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Connaissement B/L :</span>
                      <span className="font-bold text-primary">{container.bl_number}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Statut :</span>
                    <span className={`px-2 py-0.5 rounded-full font-bold ${
                      container.status === 'arrived' 
                        ? 'bg-emerald-500/10 text-emerald-600'
                        : container.status === 'in_transit'
                        ? 'bg-amber-500/10 text-amber-600'
                        : 'bg-slate-500/10 text-slate-600'
                    }`}>
                      {container.status === 'arrived' ? 'Arrivé' : container.status === 'in_transit' ? 'En Transit' : 'Clôturé'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Chargement :</span>
                    <span className="font-semibold">{formatDate(container.loading_date)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Arrivée Prévue :</span>
                    <span className="font-semibold">{formatDate(container.expected_arrival)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-center text-xs">
                  <div className="p-2 rounded-lg bg-card border border-border">
                    <span className="block text-muted-foreground">Lots Clients</span>
                    <span className="font-bold text-sm">{container.total_lots || 0}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-card border border-border">
                    <span className="block text-muted-foreground">Coûts Réels</span>
                    <span className="font-bold text-sm text-red-600">{formatFCFA(container.total_costs)}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => navigate(`/containers/${container.id}`)}
                className="mt-6 w-full py-2.5 px-4 rounded-xl bg-secondary hover:bg-primary hover:text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <span>Accéder au dossier & coûts</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Modal Création Conteneur avec React Portal */}
      {isModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-6">
            <h2 className="text-xl font-extrabold">Nouveau Conteneur</h2>

            {formError && (
              <div className="p-3 rounded-xl bg-red-500/10 text-red-500 text-xs font-medium border border-red-500/20">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateContainer} className="space-y-4 text-xs">
              <div>
                <label className="block text-xs font-semibold mb-1">Numéro de Conteneur *</label>
                <input
                  type="text"
                  required
                  placeholder="EX: FFAU8057936"
                  value={containerNumber}
                  onChange={(e) => setContainerNumber(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-secondary border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">N° Connaissement B/L</label>
                  <input
                    type="text"
                    placeholder="Ex: B/L SHZ7825000"
                    value={blNumber}
                    onChange={(e) => setBlNumber(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-secondary border border-border rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Compagnie / Navire</label>
                  <input
                    type="text"
                    placeholder="Ex: 76CMA (CMA-CGM)"
                    value={shippingLine}
                    onChange={(e) => setShippingLine(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-secondary border border-border rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Provenance *</label>
                  <input
                    type="text"
                    required
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-secondary border border-border rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Transitataire / Agent</label>
                  <input
                    type="text"
                    placeholder="Ex: BABACAR CISSE"
                    value={agentName}
                    onChange={(e) => setAgentName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-secondary border border-border rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Date de Chargement</label>
                  <input
                    type="date"
                    value={loadingDate}
                    onChange={(e) => setLoadingDate(e.target.value)}
                    className="w-full px-3 py-2 bg-secondary border border-border rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Date Arrivée Prévue</label>
                  <input
                    type="date"
                    value={expectedArrival}
                    onChange={(e) => setExpectedArrival(e.target.value)}
                    className="w-full px-3 py-2 bg-secondary border border-border rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Notes / Instructions</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Informations douanières..."
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-xl"
                ></textarea>
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
                  className="px-5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold shadow-md hover:bg-primary/90 disabled:opacity-50"
                >
                  {submitting ? 'Création...' : 'Créer Conteneur'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Modification Conteneur avec React Portal */}
      {editingContainer && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-extrabold">Modifier le Conteneur</h2>
              <button
                onClick={() => setEditingContainer(null)}
                className="p-1 rounded-lg hover:bg-secondary text-muted-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              <div>
                <label className="block text-xs font-semibold mb-1">Numéro de Conteneur *</label>
                <input
                  type="text"
                  required
                  value={editContainerNumber}
                  onChange={(e) => setEditContainerNumber(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-secondary border border-border rounded-xl font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">N° Connaissement B/L</label>
                  <input
                    type="text"
                    value={editBlNumber}
                    onChange={(e) => setEditBlNumber(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-secondary border border-border rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Compagnie / Navire</label>
                  <input
                    type="text"
                    value={editShippingLine}
                    onChange={(e) => setEditShippingLine(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-secondary border border-border rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Provenance *</label>
                  <input
                    type="text"
                    required
                    value={editOrigin}
                    onChange={(e) => setEditOrigin(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-secondary border border-border rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Transitataire / Agent</label>
                  <input
                    type="text"
                    value={editAgentName}
                    onChange={(e) => setEditAgentName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-secondary border border-border rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Chargement</label>
                  <input
                    type="date"
                    value={editLoadingDate}
                    onChange={(e) => setEditLoadingDate(e.target.value)}
                    className="w-full px-3 py-2 bg-secondary border border-border rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Arrivée Prévue</label>
                  <input
                    type="date"
                    value={editExpectedArrival}
                    onChange={(e) => setEditExpectedArrival(e.target.value)}
                    className="w-full px-3 py-2 bg-secondary border border-border rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Arrivée Effective</label>
                  <input
                    type="date"
                    value={editActualArrival}
                    onChange={(e) => setEditActualArrival(e.target.value)}
                    className="w-full px-3 py-2 bg-secondary border border-border rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Statut du Conteneur</label>
                <select
                  value={editStatus}
                  onChange={(e: any) => setEditStatus(e.target.value)}
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-xl font-bold"
                >
                  <option value="in_transit">En Transit</option>
                  <option value="arrived">Arrivé au Port</option>
                  <option value="closed">Clôturé</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Notes / Instructions</label>
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
                  onClick={() => setEditingContainer(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold hover:bg-secondary"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="px-5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold shadow-md hover:bg-primary/90 disabled:opacity-50"
                >
                  {editSubmitting ? 'Enregistrement...' : 'Enregistrer les Modifications'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Confirmation Suppression avec React Portal */}
      {deletingContainer && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-red-500/10 text-red-500 flex-shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-foreground">Supprimer le Conteneur</h3>
                <p className="text-xs text-muted-foreground">Confirmation de suppression définitive</p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Êtes-vous sûr de vouloir supprimer le conteneur <strong className="text-foreground">{deletingContainer.container_number}</strong> et l'ensemble de ses lots associés ? Cette action est irréversible.
            </p>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
              <button
                type="button"
                onClick={() => setDeletingContainer(null)}
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
      {isImportModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-extrabold flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                <span>Importer un Fichier Excel</span>
              </h3>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="p-1 rounded-lg hover:bg-secondary text-muted-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Sélectionnez un fichier Excel (ex: <code>Classeur.xlsx</code>) contenant le numéro de conteneur, B/L et la liste des lots clients. Le conteneur et l'ensemble de ses colis seront créés automatiquement.
            </p>

            {importMsg && (
              <div className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                importMsg.type === 'success' 
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600' 
                  : 'bg-red-500/10 border-red-500/20 text-red-500'
              }`}>
                {importMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
                <span>{importMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleImportExcelSubmit} className="space-y-4 text-xs">
              <div className="p-4 rounded-2xl bg-secondary/50 border border-dashed border-border text-center space-y-2">
                <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  required
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
                />
                {selectedFile && (
                  <p className="text-xs font-extrabold text-emerald-600 truncate">
                    Fichier : {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} Ko)
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold hover:bg-secondary"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={importing || !selectedFile}
                  className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-extrabold text-xs shadow-md hover:bg-emerald-500 disabled:opacity-50 flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  <span>{importing ? 'Importation & Création...' : 'Importer et Créer le Conteneur'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Pop-up Confirmation Doublons Homonymes Excel */}
      {duplicateMatches && createPortal(
        <div className="fixed inset-0 z-[10000] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-500 flex-shrink-0">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-foreground">Confirmation des Clients Identiques</h3>
                <p className="text-xs text-muted-foreground">
                  {duplicateMatches.length} client(s) sur le fichier Excel possèdent un nom identique à votre répertoire.
                </p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Le fichier Excel ne contenant pas de numéro de téléphone comme repère, veuillez indiquer pour chaque nom s'il s'agit du <strong>même client déjà enregistré</strong> ou d'un <strong>nouveau client distinct</strong> :
            </p>

            <div className="space-y-3">
              {duplicateMatches.map((match) => {
                const currentRes = resolutions[match.excel_name] || 'existing';
                return (
                  <div key={match.excel_name} className="p-4 rounded-2xl bg-secondary/50 border border-border space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-1">
                      <span className="font-extrabold text-xs text-primary">Nom Excel : {match.excel_name}</span>
                      <span className="text-[11px] text-muted-foreground font-semibold">
                        En base : <strong>{match.existing_name}</strong> ({match.existing_phone || 'Sans tel'})
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-semibold">
                      <button
                        type="button"
                        onClick={() => setResolutions(prev => ({ ...prev, [match.excel_name]: 'existing' }))}
                        className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all ${
                          currentRes === 'existing'
                            ? 'bg-emerald-600/10 border-emerald-600 text-emerald-600 font-extrabold shadow-sm'
                            : 'bg-card border-border text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <CheckCircle2 className={`w-4 h-4 ${currentRes === 'existing' ? 'text-emerald-600' : 'text-muted-foreground'}`} />
                        <span>C'est le MÊME client (Fusionner)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setResolutions(prev => ({ ...prev, [match.excel_name]: 'new' }))}
                        className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all ${
                          currentRes === 'new'
                            ? 'bg-amber-500/10 border-amber-500 text-amber-600 font-extrabold shadow-sm'
                            : 'bg-card border-border text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <UserPlus className={`w-4 h-4 ${currentRes === 'new' ? 'text-amber-500' : 'text-muted-foreground'}`} />
                        <span>Créer un NOUVEAU client</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
              <button
                type="button"
                onClick={() => setDuplicateMatches(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold hover:bg-secondary"
              >
                Annuler L'importation
              </button>
              <button
                type="button"
                onClick={() => handleImportExcelSubmit(undefined, true)}
                disabled={importing}
                className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow hover:bg-primary/90 disabled:opacity-50"
              >
                {importing ? 'Importation...' : 'Valider & Finaliser l\'Importation'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
