import React, { useState, useEffect, useRef } from 'react';
import jsQR from 'jsqr';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import api from '../lib/api';
import { formatFCFA, formatDate, formatDateTime } from '../lib/utils';
import { 
  QrCode, 
  Camera, 
  Upload, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Search, 
  FileText, 
  User, 
  Package, 
  CreditCard, 
  ShieldCheck, 
  ShieldAlert,
  Printer,
  StopCircle,
  Play,
  FileType
} from 'lucide-react';

// Configuration du worker PDF.js en local (sans serveur externe)
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

interface VerifiedReceipt {
  id: number;
  receipt_number: string;
  payment_date: string;
  amount_paid: number;
  payment_method: string;
  notes?: string | null;
  client_name: string;
  client_phone: string;
  container_number: string;
  container_origin: string;
  product_description: string;
  volume_cbm: number;
  final_amount: number;
  total_paid: number;
  remaining_balance: number;
  lot_payment_status: string;
  warehouse_name?: string | null;
}

export const ScannerQRPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'camera' | 'upload' | 'manual'>('camera');
  
  // Camera scan state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [cameraRequested, setCameraRequested] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Manual input state
  const [manualCode, setManualCode] = useState('');

  // Verification state
  const [verifying, setVerifying] = useState(false);
  const [scanResult, setScanResult] = useState<{
    valid: boolean;
    receipt?: VerifiedReceipt;
    reason?: string;
  } | null>(null);

  // Camera stream lifecycle
  useEffect(() => {
    let animId: number;
    let stream: MediaStream | null = null;

    async function startCamera() {
      if (activeTab !== 'camera' || !cameraRequested) return;
      setCameraError(null);

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', 'true');
          await videoRef.current.play();
          setIsCameraActive(true);
          scanFrame();
        }
      } catch (err: any) {
        console.error('Erreur accès caméra:', err);
        setCameraError('Accès à la caméra refusé ou indisponible. Veuillez vérifier les permissions de votre navigateur.');
        setIsCameraActive(false);
      }
    }

    function scanFrame() {
      if (!videoRef.current || !canvasRef.current || videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) {
        animId = requestAnimationFrame(scanFrame);
        return;
      }

      const canvas = canvasRef.current;
      const video = videoRef.current;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const qrCode = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert'
        });

        if (qrCode && qrCode.data) {
          handleVerifyCode(qrCode.data);
          setCameraRequested(false); // Pause camera after successful decode
          return;
        }
      }

      animId = requestAnimationFrame(scanFrame);
    }

    if (cameraRequested) {
      startCamera();
    }

    return () => {
      if (animId) cancelAnimationFrame(animId);
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
      setIsCameraActive(false);
    };
  }, [activeTab, cameraRequested]);

  const handleVerifyCode = async (codeStr: string) => {
    if (!codeStr || verifying) return;
    setVerifying(true);
    setScanResult(null);

    try {
      const res = await api.post('/payments/verify-qr', { code: codeStr });
      setScanResult(res.data);
    } catch (err: any) {
      setScanResult({
        valid: false,
        reason: err.response?.data?.reason || '⚠️ QR Code non reconnu ou indisponible dans la base de données.'
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setVerifying(true);
    setScanResult(null);

    // MODE 1: Fichier PDF (.pdf)
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const page = await pdf.getPage(1);

        // 1. Extraire le contenu textuel pour détecter le motif REC-xxx ou JSON
        const textContent = await page.getTextContent();
        const extractedText = textContent.items.map((item: any) => item.str).join(' ');

        const jsonMatch = extractedText.match(/\{"app":"CargoNotify"[^\}]+\}/);
        if (jsonMatch) {
          await handleVerifyCode(jsonMatch[0]);
          return;
        }

        const recMatch = extractedText.match(/REC-[A-Za-z0-9-]+/i);
        if (recMatch) {
          await handleVerifyCode(recMatch[0]);
          return;
        }

        // 2. Rendu Canvas haute définition pour scanner le QR Code du PDF
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        if (ctx) {
          await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const qrCode = jsQR(imageData.data, imageData.width, imageData.height);

          if (qrCode && qrCode.data) {
            await handleVerifyCode(qrCode.data);
            return;
          }
        }

        setScanResult({
          valid: false,
          reason: '⚠️ Ce fichier PDF ne contient aucun numéro de reçu CargoNotify ni aucun QR Code officiel détecté.'
        });
      } catch (err) {
        console.error('Erreur analyse PDF:', err);
        setScanResult({
          valid: false,
          reason: '⚠️ Erreur lors de la lecture du fichier PDF. Vérifiez l\'intégrité de votre document.'
        });
      } finally {
        setVerifying(false);
      }
      return;
    }

    // MODE 2: Fichier Image (PNG, JPG, WEBP)
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = img.width;
      canvas.height = img.height;
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const qrCode = jsQR(imageData.data, imageData.width, imageData.height);

        if (qrCode && qrCode.data) {
          handleVerifyCode(qrCode.data);
        } else {
          setScanResult({
            valid: false,
            reason: 'Aucun QR Code lisible n\'a été trouvé sur cette photo.'
          });
          setVerifying(false);
        }
      }
    };
    img.onerror = () => {
      setScanResult({
        valid: false,
        reason: 'Impossible de lire ce fichier d\'image.'
      });
      setVerifying(false);
    };
    img.src = URL.createObjectURL(file);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleVerifyCode(manualCode.trim());
  };

  const handleResetScan = () => {
    setScanResult(null);
    setManualCode('');
    setCameraRequested(false);
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header Banner */}
      <div className="text-center space-y-2">
        <div className="inline-flex p-3 rounded-3xl bg-primary/10 text-primary mb-2 shadow-inner">
          <QrCode className="w-8 h-8" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Scanner & Valider un Reçu de Paiement</h1>
        <p className="text-xs sm:text-sm text-muted-foreground max-w-lg mx-auto font-medium">
          Vérifiez l'authenticité d'un reçu client en direct pour certifier les règlements et contrer les tentatives de falsification.
        </p>
      </div>

      {/* Tabs Switcher */}
      <div className="flex items-center justify-center gap-2 p-1.5 bg-secondary/80 rounded-2xl w-fit mx-auto border border-border">
        <button
          onClick={() => { setActiveTab('camera'); handleResetScan(); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all ${
            activeTab === 'camera'
              ? 'bg-card text-foreground shadow-sm border border-border'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Camera className="w-4 h-4 text-primary" />
          <span>Scanner par Caméra</span>
        </button>

        <button
          onClick={() => { setActiveTab('upload'); handleResetScan(); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all ${
            activeTab === 'upload'
              ? 'bg-card text-foreground shadow-sm border border-border'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <FileType className="w-4 h-4 text-primary" />
          <span>Importer un Reçu (PDF / Image)</span>
        </button>

        <button
          onClick={() => { setActiveTab('manual'); handleResetScan(); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all ${
            activeTab === 'manual'
              ? 'bg-card text-foreground shadow-sm border border-border'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Search className="w-4 h-4 text-primary" />
          <span>Saisie Manuelle</span>
        </button>
      </div>

      {/* Main Container */}
      <div className="p-6 rounded-3xl bg-card border border-border shadow-md space-y-6">
        {/* Afficher l'interface de scan uniquement si aucun résultat n'est présent */}
        {!scanResult && !verifying && (
          <>
            {/* TAB 1: CAMERA SCAN */}
            {activeTab === 'camera' && (
              <div className="space-y-6">
                {!cameraRequested ? (
                  /* Custom Elegant Pre-Access Hero Card */
                  <div className="p-8 rounded-3xl bg-secondary/40 border border-border text-center space-y-5 max-w-lg mx-auto">
                    <div className="p-4 rounded-3xl bg-primary/10 text-primary w-fit mx-auto">
                      <Camera className="w-10 h-10" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-base font-black text-foreground">Démarrer le Scanner Caméra CargoNotify</h3>
                      <p className="text-xs text-muted-foreground">
                        Cliquez sur le bouton ci-dessous pour autoriser la caméra et scanner le QR Code imprimé sur le reçu client.
                      </p>
                    </div>

                    <button
                      onClick={() => setCameraRequested(true)}
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-primary text-primary-foreground font-black text-xs shadow-lg hover:bg-primary/90 transition-all transform hover:scale-[1.02]"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      <span>Activer la Caméra</span>
                    </button>
                  </div>
                ) : (
                  /* Active Camera Stream Viewfinder */
                  <div className="space-y-4 text-center">
                    {cameraError ? (
                      <div className="p-6 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-semibold space-y-3 max-w-md mx-auto">
                        <AlertTriangle className="w-8 h-8 mx-auto" />
                        <p>{cameraError}</p>
                        <button
                          onClick={() => setCameraRequested(false)}
                          className="px-4 py-2 rounded-xl bg-red-600 text-white font-bold text-xs shadow hover:bg-red-700 transition-all"
                        >
                          Fermer & Réessayer
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="relative max-w-sm mx-auto aspect-square rounded-3xl overflow-hidden bg-slate-950 border-2 border-primary/40 shadow-xl flex items-center justify-center">
                          <video ref={videoRef} className="w-full h-full object-cover" />
                          <canvas ref={canvasRef} className="hidden" />

                          {/* Viewfinder Frame */}
                          {isCameraActive && (
                            <div className="absolute inset-0 border-[40px] border-slate-950/60 flex items-center justify-center">
                              <div className="w-48 h-48 border-2 border-primary border-dashed rounded-2xl animate-pulse relative">
                                <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-primary"></div>
                                <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-primary"></div>
                                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-primary"></div>
                                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-primary"></div>
                              </div>
                            </div>
                          )}
                        </div>

                        <button
                          onClick={() => setCameraRequested(false)}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-secondary border border-border text-foreground font-extrabold text-xs hover:bg-destructive hover:text-destructive-foreground transition-all"
                        >
                          <StopCircle className="w-4 h-4" />
                          <span>Arrêter la Caméra</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: UPLOAD FILE (PDF / IMAGE) */}
            {activeTab === 'upload' && (
              <div className="p-8 border-2 border-dashed border-border rounded-3xl text-center space-y-4 hover:border-primary transition-colors cursor-pointer bg-secondary/30">
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="qr-file-input"
                />
                <label htmlFor="qr-file-input" className="cursor-pointer space-y-3 block">
                  <div className="p-4 rounded-2xl bg-primary/10 text-primary w-fit mx-auto">
                    <FileType className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-foreground">Cliquez ici pour charger un reçu (Fichier PDF ou Image)</h3>
                    <p className="text-xs text-muted-foreground mt-1">Formats acceptés : PDF (.pdf), PNG, JPG, JPEG, WEBP</p>
                  </div>
                </label>
              </div>
            )}

            {/* TAB 3: MANUAL INPUT */}
            {activeTab === 'manual' && (
              <form onSubmit={handleManualSubmit} className="max-w-md mx-auto space-y-4">
                <div>
                  <label className="block text-xs font-semibold mb-1">Numéro de Reçu Officiel (ex: REC-2026-0001) *</label>
                  <div className="relative">
                    <FileText className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      required
                      placeholder="Saisissez ou collez le N° de reçu..."
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-secondary border border-border rounded-xl font-extrabold text-sm focus:outline-none focus:ring-2 focus:ring-primary uppercase"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={verifying || !manualCode.trim()}
                  className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs shadow-md hover:bg-primary/90 transition-all disabled:opacity-50"
                >
                  {verifying ? 'Vérification en cours...' : 'Vérifier ce Reçu'}
                </button>
              </form>
            )}
          </>
        )}

        {/* Loading Spinner */}
        {verifying && (
          <div className="p-8 text-center space-y-3">
            <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto"></div>
            <p className="text-xs font-extrabold text-foreground">Interrogation de la base de données CargoNotify...</p>
          </div>
        )}

        {/* Scan Result Cards */}
        {scanResult && !verifying && (
          <div className="space-y-4 pt-4 border-t border-border">
            {scanResult.valid && scanResult.receipt ? (
              /* VALID OFFICIAL RECEIPT CARD */
              <div className="p-6 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 space-y-6">
                {/* Header Badge */}
                <div className="flex items-center justify-between flex-wrap gap-3 pb-4 border-b border-emerald-500/20">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-2xl bg-emerald-500 text-white shadow-lg">
                      <ShieldCheck className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase text-emerald-600 tracking-wider">Certificat d'Authenticité</span>
                      <h2 className="text-lg font-black text-emerald-700">REÇU AUTHENTIQUE & VALIDE ✅</h2>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-emerald-500 text-white font-extrabold text-xs shadow">
                    N° {scanResult.receipt.receipt_number}
                  </span>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  {/* Client & Logistique */}
                  <div className="p-4 rounded-2xl bg-card border border-border space-y-2">
                    <span className="text-[10px] font-extrabold text-muted-foreground uppercase flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-primary" />
                      Client & Logistique
                    </span>
                    <p className="font-extrabold text-foreground text-sm">{scanResult.receipt.client_name}</p>
                    <p className="text-muted-foreground font-semibold">📞 {scanResult.receipt.client_phone}</p>
                    <div className="pt-2 border-t border-border flex items-center justify-between text-muted-foreground">
                      <span>Conteneur :</span>
                      <strong className="text-foreground">{scanResult.receipt.container_number} ({scanResult.receipt.container_origin})</strong>
                    </div>
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Lieu de Retrait :</span>
                      <strong className="text-foreground">{scanResult.receipt.warehouse_name || 'Médina / Cambérène'}</strong>
                    </div>
                  </div>

                  {/* Marchandise & Volumétrie */}
                  <div className="p-4 rounded-2xl bg-card border border-border space-y-2">
                    <span className="text-[10px] font-extrabold text-muted-foreground uppercase flex items-center gap-1">
                      <Package className="w-3.5 h-3.5 text-primary" />
                      Description de la Marchandise
                    </span>
                    <p className="font-extrabold text-foreground">{scanResult.receipt.product_description}</p>
                    <div className="pt-2 border-t border-border flex items-center justify-between text-muted-foreground">
                      <span>Volume :</span>
                      <strong className="text-foreground">{scanResult.receipt.volume_cbm} CBM</strong>
                    </div>
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Montant Total Lot :</span>
                      <strong className="text-foreground">{formatFCFA(scanResult.receipt.final_amount)}</strong>
                    </div>
                  </div>
                </div>

                {/* Bilan financier */}
                <div className="p-4 rounded-2xl bg-card border border-border space-y-3">
                  <span className="text-[10px] font-extrabold text-muted-foreground uppercase flex items-center gap-1">
                    <CreditCard className="w-3.5 h-3.5 text-primary" />
                    Détail du Règlement Présent
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                    <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                      <span className="text-[9px] font-extrabold text-emerald-600 uppercase">Montant Encaissé</span>
                      <p className="text-base font-black text-emerald-600">{formatFCFA(scanResult.receipt.amount_paid)}</p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-secondary border border-border">
                      <span className="text-[9px] font-extrabold text-muted-foreground uppercase">Mode Règlement</span>
                      <p className="text-xs font-black text-foreground uppercase mt-1">{scanResult.receipt.payment_method}</p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-secondary border border-border">
                      <span className="text-[9px] font-extrabold text-muted-foreground uppercase">Cumul Déjà Payé</span>
                      <p className="text-xs font-black text-foreground mt-1">{formatFCFA(scanResult.receipt.total_paid)}</p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                      <span className="text-[9px] font-extrabold text-amber-600 uppercase">Reste à Solder</span>
                      <p className="text-base font-black text-amber-600">{formatFCFA(scanResult.receipt.remaining_balance)}</p>
                    </div>
                  </div>
                </div>

                {scanResult.receipt.notes && (
                  <div className="p-3.5 rounded-2xl bg-secondary/60 border border-border text-xs">
                    <span className="font-extrabold text-foreground">📝 Observation / Note : </span>
                    <span className="text-muted-foreground font-medium italic">{scanResult.receipt.notes}</span>
                  </div>
                )}

                {/* Actions Button */}
                <div className="flex items-center justify-between pt-2 flex-wrap gap-2">
                  <button
                    onClick={() => {
                      const token = localStorage.getItem('cargo_notify_token') || '';
                      window.open(`/api/payments/${scanResult.receipt?.id}/pdf?token=${token}`, '_blank');
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs shadow hover:bg-primary/90 transition-all"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Imprimer / Télécharger Reçu PDF</span>
                  </button>

                  <button
                    onClick={handleResetScan}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-card border border-border font-bold text-xs hover:bg-secondary transition-all"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Effectuer un autre scan</span>
                  </button>
                </div>
              </div>
            ) : (
              /* INVALID / FAUX REÇU ALERT CARD */
              <div className="p-6 rounded-3xl bg-red-500/10 border border-red-500/30 space-y-4 text-center">
                <div className="p-4 rounded-2xl bg-red-600 text-white w-fit mx-auto shadow-lg shadow-red-600/30">
                  <ShieldAlert className="w-10 h-10" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-lg font-black text-red-600 uppercase tracking-tight">⚠️ ATTENTION : QR CODE NON RECONNU / FAUX REÇU !</h2>
                  <p className="text-xs text-red-600/90 max-w-md mx-auto font-medium whitespace-pre-line">
                    {scanResult.reason}
                  </p>
                </div>

                <div className="pt-3 border-t border-red-500/20">
                  <button
                    onClick={handleResetScan}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 text-white font-bold text-xs shadow hover:bg-red-700 transition-all"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Effectuer un autre scan</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
