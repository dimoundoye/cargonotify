import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Upload, Contrast, Check, X, RotateCw, Stamp } from 'lucide-react';

interface SignatureScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (base64DataUrl: string) => void;
  existingSignatureUrl?: string | null;
}

export const SignatureScannerModal: React.FC<SignatureScannerModalProps> = ({
  isOpen,
  onClose,
  onSave,
  existingSignatureUrl
}) => {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [threshold, setThreshold] = useState<number>(200);
  const [isGrayscale, setIsGrayscale] = useState<boolean>(true);
  const [processedUrl, setProcessedUrl] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (image && canvasRef.current) {
      processImage();
    }
  }, [image, threshold, isGrayscale]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => setImage(img);
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const processImage = () => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Redimensionner le canvas pour avoir une signature nette et légère (max 450px)
    const maxWidth = 450;
    const scale = Math.min(1, maxWidth / image.width);
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);

    // Dessiner l'image originale
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    // Récupérer le buffer de pixels
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Calculer la luminosité moyenne du pixel
      const brightness = (r + g + b) / 3;

      if (brightness > threshold) {
        // Supprimer le fond blanc / clair en le rendant 100% transparent (alpha = 0)
        data[i + 3] = 0;
      } else if (isGrayscale) {
        // Renforcer l'encre noire / foncée du cachet pour un rendu très net
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
      }
    }

    ctx.putImageData(imageData, 0, 0);
    setProcessedUrl(canvas.toDataURL('image/png'));
  };

  const handleConfirmSave = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const base64Png = canvas.toDataURL('image/png');
      onSave(base64Png);
      onClose();
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-5 text-foreground">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-600">
              <Stamp className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-extrabold">Numérisation & Suppression du Fond (Cachet / Signature)</h3>
              <p className="text-xs text-muted-foreground">Le système supprime automatiquement l'arrière-plan blanc pour ne garder que votre empreinte.</p>
            </div>
          </div>

          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-secondary text-muted-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Image Input or Canvas Processing */}
        {!image ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-border rounded-2xl p-8 flex flex-col items-center justify-center gap-3 bg-secondary/30 hover:bg-secondary/50 cursor-pointer transition-colors"
          >
            <div className="p-4 rounded-2xl bg-primary/10 text-primary">
              <Upload className="w-8 h-8" />
            </div>
            <div className="text-center">
              <p className="font-extrabold text-sm text-foreground">Importer une photo de votre Cachet ou Signature</p>
              <p className="text-xs text-muted-foreground mt-1">Formats acceptés : PNG, JPG, JPEG (Photo prise au téléphone ou scan)</p>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Canvas Preview Area with Checkerboard Background */}
            <div className="relative border border-border rounded-2xl overflow-hidden min-h-[220px] flex items-center justify-center p-4 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:12px_12px] dark:bg-[radial-gradient(#334155_1px,transparent_1px)]">
              <canvas ref={canvasRef} className="max-w-full max-h-[260px] object-contain shadow-sm" />
              
              <button
                onClick={() => setImage(null)}
                className="absolute top-3 right-3 p-2 rounded-xl bg-card border border-border shadow hover:bg-secondary text-xs font-bold flex items-center gap-1.5"
                title="Changer d'image"
              >
                <RotateCw className="w-4 h-4 text-primary" />
                <span>Changer d'image</span>
              </button>
            </div>

            {/* Sliders & Processing Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-secondary/40 rounded-2xl border border-border text-xs">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-extrabold text-foreground flex items-center gap-1.5">
                    <Contrast className="w-4 h-4 text-primary" />
                    <span>Seuil de Transparence</span>
                  </span>
                  <span className="px-2 py-0.5 rounded bg-card border border-border font-black text-primary">{threshold}</span>
                </div>
                <input
                  type="range"
                  min="80"
                  max="245"
                  step="1"
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                  className="w-full accent-primary"
                />
                <p className="text-[10px] text-muted-foreground leading-tight">
                  Ajustez vers la gauche si des contours d'encre manquent, vers la droite si du fond persiste.
                </p>
              </div>

              <div className="flex flex-col justify-center space-y-2">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-foreground">
                  <input
                    type="checkbox"
                    checked={isGrayscale}
                    onChange={(e) => setIsGrayscale(e.target.checked)}
                    className="w-4 h-4 accent-primary rounded"
                  />
                  <span>Mode Noir Pur (Netteté Maximale)</span>
                </label>
                <p className="text-[10px] text-muted-foreground leading-tight">
                  Convertit les éléments d'encre en noir profond pour un résultat de signature parfait sur les reçus.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold hover:bg-secondary"
          >
            Annuler
          </button>

          <button
            type="button"
            disabled={!image}
            onClick={handleConfirmSave}
            className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs shadow-md shadow-primary/20 flex items-center gap-2 hover:bg-primary/90 disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            <span>Valider & Enregistrer le Cachet</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
