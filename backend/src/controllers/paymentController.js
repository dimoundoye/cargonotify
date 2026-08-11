const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const pool = require('../config/db');
const { getCompanySettingsData } = require('./settingsController');
const { logAudit } = require('../utils/auditLogger');

function getEffectiveCompanyId(req) {
  if (req.user && req.user.role === 'super_admin' && req.query.company_id) {
    return parseInt(req.query.company_id, 10);
  }
  return (req.user && req.user.company_id) ? req.user.company_id : 1;
}

// Assurer les colonnes de snapshot sur la table payments pour l'immutabilité stricte
async function ensurePaymentSnapshotColumns() {
  try {
    await pool.query(`
      ALTER TABLE payments ADD COLUMN IF NOT EXISTS signature_snapshot TEXT;
      ALTER TABLE payments ADD COLUMN IF NOT EXISTS company_name_snapshot VARCHAR(255);
      ALTER TABLE payments ADD COLUMN IF NOT EXISTS company_phone_snapshot VARCHAR(100);
      ALTER TABLE payments ADD COLUMN IF NOT EXISTS company_address_snapshot TEXT;

      -- Figer définitivement les reçus existants sans snapshot avec la signature active actuelle
      UPDATE payments p
      SET signature_snapshot = COALESCE(cs.signature_base64, 'NO_SIGNATURE'),
          company_name_snapshot = cs.company_name,
          company_phone_snapshot = cs.phone,
          company_address_snapshot = cs.address
      FROM company_settings cs
      WHERE p.company_id = cs.id AND p.signature_snapshot IS NULL;
    `);
  } catch (err) {
    console.error('Erreur migration columns snapshot payments:', err.message);
  }
}

ensurePaymentSnapshotColumns().catch(e => console.error('Init snapshot columns failed:', e));

// Enregistrer un règlement (avec figeage 100% immutable du cachet/signature)
async function createPayment(req, res) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const companyId = getEffectiveCompanyId(req);
    const { lot_id, amount_paid, payment_method, notes } = req.body;

    if (!lot_id || !amount_paid || parseFloat(amount_paid) <= 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Lot et montant valide requis.' });
    }

    const lotQuery = await client.query('SELECT * FROM lots WHERE id = $1 AND company_id = $2', [lot_id, companyId]);
    if (lotQuery.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Lot introuvable.' });
    }
    const lot = lotQuery.rows[0];

    // Obtenir la signature et le profil de l'entreprise au MOMENT PRÉCIS de la création du reçu
    const company = await getCompanySettingsData(companyId);

    const receiptNumber = `REC-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;

    // Figer la signature active dans 'signature_snapshot'. Si aucune signature n'est définie, stocker 'NO_SIGNATURE'
    const signatureSnapshot = company.signature_base64 ? company.signature_base64 : 'NO_SIGNATURE';

    // Créer le paiement avec SNAPSHOT IMMUTABLE
    const paymentResult = await client.query(`
      INSERT INTO payments (
        company_id, lot_id, client_id, amount_paid, payment_method, receipt_number, notes,
        signature_snapshot, company_name_snapshot, company_phone_snapshot, company_address_snapshot
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
      companyId, 
      lot_id, 
      lot.client_id, 
      parseFloat(amount_paid), 
      payment_method || 'cash', 
      receiptNumber, 
      notes || null,
      signatureSnapshot,
      company.company_name,
      company.phone,
      company.address
    ]);

    const payment = paymentResult.rows[0];

    // Recalculer le total payé pour ce lot
    const sumResult = await client.query('SELECT COALESCE(SUM(amount_paid), 0) AS total_paid FROM payments WHERE lot_id = $1 AND company_id = $2', [lot_id, companyId]);
    const totalPaid = parseFloat(sumResult.rows[0].total_paid);
    const finalAmount = parseFloat(lot.final_amount);

    let newPaymentStatus = 'unpaid';
    if (totalPaid >= finalAmount) {
      newPaymentStatus = 'paid';
    } else if (totalPaid > 0) {
      newPaymentStatus = 'partial';
    }

    await client.query(`
      UPDATE lots SET payment_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND company_id = $3
    `, [newPaymentStatus, lot_id, companyId]);

    // Si tous les lots de ce conteneur sont intégralement réglés (paid), passer le statut du conteneur en 'closed' (Clôturé)
    if (lot.container_id) {
      const containerLots = await client.query('SELECT payment_status FROM lots WHERE container_id = $1 AND company_id = $2', [lot.container_id, companyId]);
      if (containerLots.rows.length > 0 && containerLots.rows.every(r => r.payment_status === 'paid')) {
        await client.query(`
          UPDATE containers 
          SET status = 'closed', updated_at = CURRENT_TIMESTAMP 
          WHERE id = $1 AND company_id = $2
        `, [lot.container_id, companyId]);
      }
    }

    await client.query('COMMIT');

    let clientName = `Client #${lot.client_id}`;
    let containerNum = lot.container_id ? `Conteneur #${lot.container_id}` : '';
    try {
      const clRes = await pool.query('SELECT name FROM clients WHERE id = $1', [lot.client_id]);
      if (clRes.rows.length > 0) clientName = clRes.rows[0].name;

      if (lot.container_id) {
        const cRes = await pool.query('SELECT container_number, origin FROM containers WHERE id = $1', [lot.container_id]);
        if (cRes.rows.length > 0) containerNum = ` (Conteneur ${cRes.rows[0].container_number})`;
      }
    } catch (e) {}

    const formattedPaid = new Intl.NumberFormat('fr-FR').format(parseFloat(payment.amount_paid)) + ' FCFA';
    const dueAmount = Math.max(0, finalAmount - totalPaid);
    const dueText = dueAmount > 0 
      ? ` [Reste à solder: ${new Intl.NumberFormat('fr-FR').format(dueAmount)} FCFA]` 
      : ' [Dossier intégralement soldé]';

    logAudit(req, {
      action: 'CREATE_PAYMENT',
      action_type: 'create',
      entity_type: 'payment',
      entity_id: payment.id,
      description: `Encaissement de ${formattedPaid} sur le lot de ${clientName}${containerNum}${dueText}`
    });

    return res.status(201).json({ payment, new_status: newPaymentStatus, total_paid: totalPaid });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erreur createPayment:', err);
    return res.status(500).json({ error: 'Erreur lors de l\'enregistrement du paiement.' });
  } finally {
    client.release();
  }
}

// Obtenir tous les paiements
async function getPayments(req, res) {
  try {
    const companyId = getEffectiveCompanyId(req);
    const query = `
      SELECT 
        p.*,
        cl.name AS client_name,
        cl.phone AS client_phone,
        l.product_description,
        c.container_number
      FROM payments p
      JOIN clients cl ON p.client_id = cl.id
      JOIN lots l ON p.lot_id = l.id
      JOIN containers c ON l.container_id = c.id
      WHERE p.company_id = $1
      ORDER BY p.payment_date DESC
    `;
    const result = await pool.query(query, [companyId]);
    return res.json({ payments: result.rows });
  } catch (err) {
    console.error('Erreur getPayments:', err);
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
}

// Générer le reçu de paiement PDF (Lit STRICTEMENT le SNAPSHOT IMMUTABLE du reçu)
async function generateReceiptPDF(req, res) {
  try {
    const { id } = req.params;

    const companyId = getEffectiveCompanyId(req);
    const company = await getCompanySettingsData(companyId);

    const paymentQuery = await pool.query(`
      SELECT 
        p.*,
        cl.name AS client_name,
        cl.phone AS client_phone,
        cl.address AS client_address,
        l.product_description,
        l.volume_cbm,
        l.weight_kg,
        l.quantity,
        l.final_amount,
        l.notes AS lot_notes,
        c.container_number,
        c.origin AS container_origin,
        w.name AS warehouse_name
      FROM payments p
      JOIN clients cl ON p.client_id = cl.id
      JOIN lots l ON p.lot_id = l.id
      JOIN containers c ON l.container_id = c.id
      LEFT JOIN warehouses w ON l.warehouse_id = w.id
      WHERE p.id = $1
    `, [id]);

    if (paymentQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Reçu de paiement introuvable.' });
    }

    const p = paymentQuery.rows[0];
    const noteText = p.notes || p.lot_notes;

    // Déterminer la signature figeée pour ce reçu
    let effectiveSignature = p.signature_snapshot;
    
    // Si c'est un ancien reçu qui n'avait aucun snapshot, figer avec la signature actuelle pour la verrouiller à jamais
    if (!effectiveSignature) {
      effectiveSignature = company.signature_base64 || 'NO_SIGNATURE';
      await pool.query('UPDATE payments SET signature_snapshot = $1 WHERE id = $2', [effectiveSignature, p.id]);
    }

    // Si le snapshot indique NO_SIGNATURE, ne pas afficher de signature
    if (effectiveSignature === 'NO_SIGNATURE') {
      effectiveSignature = null;
    }

    const effectiveCompanyName = p.company_name_snapshot || company.company_name;
    const effectivePhone = p.company_phone_snapshot || company.phone;
    const effectiveAddress = p.company_address_snapshot || company.address;

    // Obtenir le cumul payé
    const sumQuery = await pool.query('SELECT COALESCE(SUM(amount_paid), 0) AS total_paid FROM payments WHERE lot_id = $1', [p.lot_id]);
    const totalPaid = parseFloat(sumQuery.rows[0].total_paid);
    const finalAmount = parseFloat(p.final_amount);
    const remainingBalance = Math.max(0, finalAmount - totalPaid);

    // QR Code data
    const qrPayload = JSON.stringify({
      app: 'CargoNotify',
      receipt: p.receipt_number,
      company_id: company.id,
      amount: p.amount_paid
    });
    const qrCodeImage = await QRCode.toDataURL(qrPayload);

    // Extraction du Buffer d'image pour la Signature figeée
    let signatureBuffer = null;
    if (effectiveSignature && typeof effectiveSignature === 'string' && effectiveSignature.startsWith('data:image')) {
      try {
        const base64Clean = effectiveSignature.replace(/^data:image\/\w+;base64,/, '');
        signatureBuffer = Buffer.from(base64Clean, 'base64');
      } catch (errSigBuf) {
        console.error('Erreur conversion signature snapshot vers buffer:', errSigBuf);
      }
    }

    // Formatters
    const formatPdfAmount = (val) => {
      const n = Math.round(Number(val) || 0);
      return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    };

    const formatPdfVolume = (val) => {
      const num = parseFloat(val) || 0;
      return num.toFixed(3).replace('.', ',');
    };

    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=Recu-${p.receipt_number}.pdf`);

    doc.pipe(res);

    // Header fige depuis le snapshot du reçu
    doc.fillColor('#1E293B').fontSize(18).font('Helvetica-Bold').text(effectiveCompanyName, 50, 45);
    doc.fontSize(9.5).font('Helvetica').fillColor('#64748B').text('Import-Export, Transit & Dédouanement', 50, 68);
    doc.text(`${effectiveAddress} | Contact: ${effectivePhone}`, 50, 82);

    doc.moveTo(50, 98).lineTo(545, 98).strokeColor('#E2E8F0').lineWidth(1).stroke();

    // Reçu Titre
    doc.fillColor('#0F172A').fontSize(15).font('Helvetica-Bold').text('REÇU DE PAIEMENT', 50, 110, { align: 'center' });
    doc.fontSize(9.5).font('Helvetica').fillColor('#64748B').text(`N° ${p.receipt_number}`, 50, 128, { align: 'center' });

    // Client & Conteneur Box
    doc.rect(50, 150, 495, 75).fillColor('#F8FAFC').fill();
    doc.fillColor('#1E293B').fontSize(10).font('Helvetica-Bold').text('Informations Client & Conteneur', 65, 162);
    doc.fontSize(9.5).font('Helvetica').fillColor('#334155')
      .text(`Client : ${p.client_name} (${p.client_phone || ''})`, 65, 182)
      .text(`Conteneur : N° ${p.container_number} (Provenance: ${p.container_origin})`, 65, 200)
      .text(`Lieu de Retrait : ${p.warehouse_name || 'Médina / Cambérène'}`, 280, 182, { width: 250, align: 'right' });

    // Description de la marchandise Box
    doc.rect(50, 240, 495, 95).strokeColor('#CBD5E1').lineWidth(1).stroke();
    doc.fillColor('#0F172A').fontSize(10).font('Helvetica-Bold').text('Description de la Marchandise', 65, 252);
    doc.fontSize(9.5).font('Helvetica').fillColor('#475569')
      .text(`Désignation : ${p.product_description}`, 65, 272)
      .text(`Volume : ${formatPdfVolume(p.volume_cbm)} CBM`, 65, 290)
      .text(`Montant Total Facturé : ${formatPdfAmount(finalAmount)} ${company.currency}`, 65, 308);

    // Bilan financier Box
    doc.rect(50, 350, 495, 110).fillColor('#F1F5F9').fill();
    doc.fillColor('#0F172A').fontSize(10).font('Helvetica-Bold').text('Récapitulatif Financier du Reçu', 65, 362);

    // Ligne 1: Montant du Présent Règlement
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#1E293B').text('Montant du Présent Règlement :', 65, 385);
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#16A34A').text(`${formatPdfAmount(p.amount_paid)} ${company.currency}`, 300, 385, { width: 230, align: 'right' });

    // Ligne 2: Cumul Total Encaissé sur ce lot
    doc.font('Helvetica').fontSize(9.5).fillColor('#1E293B').text('Cumul Total Encaissé sur ce lot :', 65, 410);
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#0F172A').text(`${formatPdfAmount(totalPaid)} ${company.currency}`, 300, 410, { width: 230, align: 'right' });

    // Ligne 3: Reste à Payer
    doc.font('Helvetica').fontSize(9.5).fillColor('#1E293B').text('Reste à Payer :', 65, 435);
    doc.font('Helvetica-Bold').fontSize(10).fillColor(remainingBalance > 0 ? '#DC2626' : '#16A34A')
      .text(`${formatPdfAmount(remainingBalance)} ${company.currency}`, 300, 435, { width: 230, align: 'right' });

    // Payment details & Notes
    doc.font('Helvetica').fillColor('#475569').fontSize(9)
      .text(`Mode de Règlement : ${p.payment_method.toUpperCase()}`, 50, 480)
      .text(`Date du Règlement : ${new Date(p.payment_date).toLocaleString('fr-FR')}`, 50, 495);

    if (noteText) {
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#1E293B').text('Observation / Note :', 50, 515);
      doc.font('Helvetica-Oblique').fontSize(8.5).fillColor('#334155').text(noteText, 50, 528, { width: 380 });
    }

    // --- QR CODE À GAUCHE ---
    doc.image(qrCodeImage, 50, 560, { width: 80 });
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#64748B').text('Authenticité QR Code', 50, 645);

    // --- CACHET & SIGNATURE FIGÉE À DROITE ---
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#1E293B').text('Cachet & Signature Officielle :', 340, 550, { width: 200, align: 'right' });

    if (signatureBuffer) {
      try {
        doc.image(signatureBuffer, 395, 565, { width: 130 });
      } catch (errSigDraw) {
        console.error('Erreur dessin signature PDFKit:', errSigDraw);
        doc.rect(385, 568, 140, 65).dash(3, { space: 3 }).strokeColor('#CBD5E1').lineWidth(1).stroke();
        doc.undash();
      }
    } else {
      doc.rect(385, 568, 140, 65).dash(3, { space: 3 }).strokeColor('#CBD5E1').lineWidth(1).stroke();
      doc.undash();
    }

    // Footer
    doc.fontSize(8).font('Helvetica').fillColor('#94A3B8').text(`Ce reçu est délivré par ${effectiveCompanyName}. Gardez ce document pour le retrait de vos colis en entrepôt.`, 50, 720, { align: 'center' });

    doc.end();
  } catch (err) {
    console.error('Erreur generateReceiptPDF:', err);
    return res.status(500).json({ error: 'Erreur lors de la génération du PDF.' });
  }
}

// Vérifier l'authenticité d'un QR Code de reçu
async function verifyReceiptQR(req, res) {
  try {
    const companyId = getEffectiveCompanyId(req);
    const code = req.body.code || req.query.code;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ 
        valid: false, 
        reason: 'Aucun code QR ou identifiant de reçu fourni.' 
      });
    }

    let targetReceiptNumber = code.trim();

    // 1. Essayer de parser le code en JSON
    try {
      const parsed = JSON.parse(code);
      if (parsed && parsed.receipt) {
        targetReceiptNumber = parsed.receipt;
      }
    } catch (e) {}

    // 2. Extraire le motif REC-xxx si c'est du texte libre
    if (!targetReceiptNumber.startsWith('REC-')) {
      const match = code.match(/REC-[A-Za-z0-9-]+/i);
      if (match) {
        targetReceiptNumber = match[0];
      }
    }

    // 3. Recherche dans la base de données
    const receiptQuery = await pool.query(`
      SELECT 
        p.*,
        l.product_description,
        l.volume_cbm,
        l.final_amount,
        l.payment_status AS lot_payment_status,
        cl.name AS client_name,
        cl.phone AS client_phone,
        c.container_number,
        c.origin AS container_origin,
        w.name AS warehouse_name
      FROM payments p
      JOIN lots l ON p.lot_id = l.id
      JOIN clients cl ON p.client_id = cl.id
      LEFT JOIN containers c ON l.container_id = c.id
      LEFT JOIN warehouses w ON l.warehouse_id = w.id
      WHERE p.company_id = $1 AND LOWER(p.receipt_number) = LOWER($2)
    `, [companyId, targetReceiptNumber]);

    if (receiptQuery.rows.length === 0) {
      logAudit(req, {
        action: 'VERIFY_QR_RECEIPT',
        action_type: 'auth',
        entity_type: 'payment',
        description: `⚠️ ALERTE FAUX REÇU : Scan du QR Code non reconnu ("${code.slice(0, 40)}")`
      });

      return res.json({
        valid: false,
        reason: "⚠️ ATTENTION : QR CODE NON RECONNU / FAUX REÇU !\nCe document n'a pas été émis par votre système CargoNotify. Risque de falsification."
      });
    }

    const p = receiptQuery.rows[0];

    // Obtenir le total payé sur ce lot
    const sumQuery = await pool.query('SELECT COALESCE(SUM(amount_paid), 0) AS total_paid FROM payments WHERE lot_id = $1', [p.lot_id]);
    const totalPaid = parseFloat(sumQuery.rows[0].total_paid);
    const finalAmount = parseFloat(p.final_amount);
    const remainingBalance = Math.max(0, finalAmount - totalPaid);

    logAudit(req, {
      action: 'VERIFY_QR_RECEIPT',
      action_type: 'auth',
      entity_type: 'payment',
      entity_id: p.id,
      description: `Vérification réussie du reçu N° ${p.receipt_number} de ${p.client_name} (Montant: ${p.amount_paid} FCFA)`
    });

    return res.json({
      valid: true,
      receipt: {
        id: p.id,
        receipt_number: p.receipt_number,
        payment_date: p.payment_date,
        amount_paid: parseFloat(p.amount_paid),
        payment_method: p.payment_method,
        notes: p.notes,
        client_name: p.client_name,
        client_phone: p.client_phone,
        container_number: p.container_number,
        container_origin: p.container_origin,
        product_description: p.product_description,
        volume_cbm: parseFloat(p.volume_cbm),
        final_amount: finalAmount,
        total_paid: totalPaid,
        remaining_balance: remainingBalance,
        lot_payment_status: p.lot_payment_status,
        warehouse_name: p.warehouse_name
      }
    });
  } catch (err) {
    console.error('Erreur generateReceiptPDF:', err);
    return res.status(500).json({ valid: false, error: 'Erreur lors de la génération du PDF.' });
  }
}

module.exports = {
  createPayment,
  getPayments,
  generateReceiptPDF,
  verifyReceiptQR
};
