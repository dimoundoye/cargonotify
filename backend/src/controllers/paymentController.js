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

// Enregistrer un règlement
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

    const receiptNumber = `REC-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;

    // Créer le paiement
    const paymentResult = await client.query(`
      INSERT INTO payments (company_id, lot_id, client_id, amount_paid, payment_method, receipt_number, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [companyId, lot_id, lot.client_id, parseFloat(amount_paid), payment_method || 'cash', receiptNumber, notes || null]);

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

// Générer le reçu de paiement PDF
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

    // Helpers pour formatage PDF propre (espace standard sans problème de glyphe Unicode & virgule française)
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

    // Header dynamique depuis la base de données
    doc.fillColor('#1E293B').fontSize(18).font('Helvetica-Bold').text(company.company_name, 50, 45);
    doc.fontSize(9.5).font('Helvetica').fillColor('#64748B').text('Import-Export, Transit & Dédouanement', 50, 68);
    doc.text(`${company.address} | Contact: ${company.phone}`, 50, 82);

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

    // Payment details & QR
    doc.font('Helvetica').fillColor('#475569').fontSize(9)
      .text(`Mode de Règlement : ${p.payment_method.toUpperCase()}`, 50, 480)
      .text(`Date du Règlement : ${new Date(p.payment_date).toLocaleString('fr-FR')}`, 50, 495);

    if (noteText) {
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#1E293B').text('Observation / Note :', 50, 515);
      doc.font('Helvetica-Oblique').fontSize(8.5).fillColor('#334155').text(noteText, 50, 528, { width: 380 });
    }

    // QR Image
    doc.image(qrCodeImage, 450, 475, { width: 85 });

    // Footer
    doc.fontSize(8).fillColor('#94A3B8').text(`Ce reçu est délivré par ${company.company_name}. Gardez ce document pour le retrait de vos colis en entrepôt.`, 50, 720, { align: 'center' });

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
    console.error('Erreur verifyReceiptQR:', err);
    return res.status(500).json({ valid: false, error: 'Erreur lors de la vérification du QR Code.' });
  }
}

module.exports = {
  createPayment,
  getPayments,
  generateReceiptPDF,
  verifyReceiptQR
};
