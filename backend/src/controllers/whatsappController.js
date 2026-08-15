const pool = require('../config/db');
const whatsappService = require('../services/whatsappService');
const { getCompanySettingsData } = require('./settingsController');

// Générer le texte du message de notification d'arrivée pour un client et un conteneur
function formatArrivalMessage(customTemplate, companyName, companyPhone, clientName, containerNumber, origin, productDesc, totalDue, remainingDue, pickupLocationsText, currency = 'FCFA') {
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

  let msg = (customTemplate && customTemplate.trim()) ? customTemplate : defaultTemplate;

  // 1. Nom Société
  msg = msg.replace(/\[(Nom Société|Nom Entreprise|Entreprise|Société)\]/gi, companyName || 'CargoNotify');

  // 2. Nom du Client
  msg = msg.replace(/\[(Nom du Client|Nom Client|Client)\]/gi, clientName || 'Client');

  // 3. Code Conteneur
  msg = msg.replace(/\[(Code Conteneur|N° Conteneur|Numero Conteneur|Conteneur)\]/gi, containerNumber || '');

  // 4. Provenance
  msg = msg.replace(/\[(Provenance|Origine)\]/gi, origin || '');

  // 5. Description marchandises
  msg = msg.replace(/\[(Description des marchandise|Description des marchandises|Marchandises|Marchandise|Colis)\]/gi, productDesc || '');

  // 6. Montant Total
  const formattedTotal = `${parseFloat(totalDue || 0).toLocaleString('fr-FR')} ${currency}`;
  msg = msg.replace(/\[(Montant FCFA|Montant Total|Montant)\]/gi, formattedTotal);

  // 7. Solde / Reste à régler
  const formattedRemaining = `${parseFloat(remainingDue || 0).toLocaleString('fr-FR')} ${currency}`;
  msg = msg.replace(/\[(Solde FCFA|Solde|Reste à régler)\]/gi, formattedRemaining);

  // 8. Lieux de Retrait
  msg = msg.replace(/\[(Lieux de Retrait|Lieux de retrait disponibles|Lieu de Retrait|Entrepôts)\]/gi, pickupLocationsText || '');

  // 9. Téléphone Support
  msg = msg.replace(/\[(Téléphone Support|Tél Support|Contact Support|Téléphone)\]/gi, companyPhone || '');

  return msg;
}

// Obtenir l'état de la connexion WhatsApp Baileys & QR Code de l'entreprise
async function getWhatsAppStatus(req, res) {
  try {
    const companyId = req.user.company_id || 1;
    const status = await whatsappService.getStatus(companyId);
    return res.json(status);
  } catch (err) {
    console.error('Erreur getWhatsAppStatus:', err);
    return res.status(500).json({ error: 'Erreur lors de la récupération du statut WhatsApp.' });
  }
}

// Déclencher la connexion ou regénération du QR Code pour l'entreprise
async function connectWhatsApp(req, res) {
  try {
    const companyId = req.user.company_id || 1;
    const status = await whatsappService.initWhatsApp(companyId);
    return res.json(status);
  } catch (err) {
    console.error('Erreur connectWhatsApp:', err);
    return res.status(500).json({ error: 'Erreur lors de la connexion.' });
  }
}

// Déconnecter la session WhatsApp Baileys de l'entreprise
async function disconnectWhatsApp(req, res) {
  try {
    const companyId = req.user.company_id || 1;
    const result = await whatsappService.disconnect(companyId);
    return res.json(result);
  } catch (err) {
    console.error('Erreur disconnectWhatsApp:', err);
    return res.status(500).json({ error: 'Erreur lors de la déconnexion.' });
  }
}

// Obtenir ou prévisualiser les notifications d'un conteneur avec Lieux de Retrait DYNAMIQUES
async function getContainerNotificationPreview(req, res) {
  try {
    const { containerId } = req.params;
    const companyId = req.user.company_id || 1;
    const company = await getCompanySettingsData(companyId);

    const containerQuery = await pool.query('SELECT * FROM containers WHERE id = $1 AND company_id = $2', [containerId, companyId]);
    if (containerQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Conteneur non trouvé.' });
    }
    const container = containerQuery.rows[0];

    // Récupération dynamique de la liste des entrepôts de l'entreprise
    const warehousesQuery = await pool.query('SELECT * FROM warehouses WHERE company_id = $1 ORDER BY id ASC', [companyId]);
    const warehousesList = warehousesQuery.rows;

    let defaultPickupLocationsText = '';
    if (warehousesList && warehousesList.length > 0) {
      const numberEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
      defaultPickupLocationsText = warehousesList.map((w, idx) => {
        const emoji = numberEmojis[idx] || `${idx + 1}.`;
        const addr = w.address ? ` : ${w.address}` : '';
        const phone = w.phone ? ` (Tél : ${w.phone})` : '';
        return `${emoji} ${w.name}${addr}${phone}`;
      }).join('\n');
    } else {
      defaultPickupLocationsText = company.address ? `📍 ${company.address}` : `📍 Contactez notre service client au ${company.phone || 'numéro habituel'} pour le lieu de retrait.`;
    }

    const query = `
      SELECT 
        l.id AS lot_id,
        l.product_description,
        l.final_amount,
        cl.id AS client_id,
        cl.name AS client_name,
        cl.phone AS client_phone,
        w.name AS warehouse_name,
        w.address AS warehouse_address,
        w.phone AS warehouse_phone,
        COALESCE(SUM(p.amount_paid), 0) AS total_paid,
        (l.final_amount - COALESCE(SUM(p.amount_paid), 0)) AS remaining_balance
      FROM lots l
      JOIN clients cl ON l.client_id = cl.id
      LEFT JOIN warehouses w ON l.warehouse_id = w.id
      LEFT JOIN payments p ON l.id = p.lot_id
      WHERE l.container_id = $1 AND l.company_id = $2
      GROUP BY l.id, cl.id, w.id, w.name, w.address, w.phone
    `;
    const result = await pool.query(query, [containerId, companyId]);

    const notifications = result.rows.map(item => {
      const cleanPhone = item.client_phone.replace(/\D/g, '');
      const fullPhone = cleanPhone.startsWith('221') ? cleanPhone : `221${cleanPhone}`;

      // Lieu de retrait propre au lot s'il est spécifié, sinon entrepôts de l'entreprise
      const itemAddr = item.warehouse_address ? ` : ${item.warehouse_address}` : '';
      const itemPhone = item.warehouse_phone ? ` (Tél : ${item.warehouse_phone})` : '';

      const pickupLocationsText = item.warehouse_name 
        ? `📍 ${item.warehouse_name}${itemAddr}${itemPhone}`
        : defaultPickupLocationsText;

      const messageText = formatArrivalMessage(
        company.whatsapp_template,
        company.company_name,
        company.phone,
        item.client_name,
        container.container_number,
        container.origin,
        item.product_description,
        item.final_amount,
        item.remaining_balance,
        pickupLocationsText,
        company.currency || 'FCFA'
      );
      const waLink = `https://wa.me/${fullPhone}?text=${encodeURIComponent(messageText)}`;

      return {
        client_id: item.client_id,
        client_name: item.client_name,
        client_phone: item.client_phone,
        lot_id: item.lot_id,
        product_description: item.product_description,
        total_due: item.final_amount,
        remaining_balance: item.remaining_balance,
        raw_template: company.whatsapp_template,
        company_name: company.company_name,
        company_phone: company.phone,
        container_number: container.container_number,
        origin: container.origin,
        currency: company.currency || 'FCFA',
        message: messageText,
        wa_link: waLink
      };
    });

    return res.json({ container, notifications });
  } catch (err) {
    console.error('Erreur getContainerNotificationPreview:', err);
    return res.status(500).json({ error: 'Erreur lors de la préparation des notifications.' });
  }
}

// Envoyer automatiquement les notifications WhatsApp en masse via Baileys pour l'entreprise
async function sendBulkNotifications(req, res) {
  try {
    const { containerId, notifications } = req.body;
    const companyId = req.user.company_id || 1;

    if (!notifications || !Array.isArray(notifications)) {
      return res.status(400).json({ error: 'Liste de notifications requise.' });
    }

    const logs = [];
    let successCount = 0;
    let failCount = 0;

    for (const item of notifications) {
      let status = 'sent';
      let errorMsg = null;

      const cleanPhone = (item.client_phone || '').replace(/\D/g, '');
      if (!cleanPhone || cleanPhone.length < 6) {
        failCount++;
        const logRes = await pool.query(`
          INSERT INTO whatsapp_logs (company_id, client_id, container_id, phone, message, status)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING *
        `, [companyId, item.client_id || null, containerId || null, item.client_phone || 'N/A', item.message, 'failed']);
        logs.push(logRes.rows[0]);
        continue;
      }

      try {
        await whatsappService.sendTextMessage(companyId, item.client_phone, item.message);
        successCount++;
      } catch (err) {
        console.error(`Échec d'envoi à ${item.client_phone}:`, err.message);
        status = 'failed';
        errorMsg = err.message;
        failCount++;
      }

      const logRes = await pool.query(`
        INSERT INTO whatsapp_logs (company_id, client_id, container_id, phone, message, status)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [companyId, item.client_id || null, containerId || null, item.client_phone, item.message, status]);

      logs.push(logRes.rows[0]);
    }

    return res.json({
      message: `Opération terminée : ${successCount} notification(s) envoyée(s) avec succès, ${failCount} échec(s).`,
      successCount,
      failCount,
      logs
    });
  } catch (err) {
    console.error('Erreur sendBulkNotifications:', err);
    return res.status(500).json({ error: 'Erreur lors de l\'envoi des notifications.' });
  }
}

// Enregistrer l'envoi d'une notification individuelle (via Baileys ou manuel)
async function sendIndividualNotification(req, res) {
  try {
    const { client_id, container_id, phone, message } = req.body;
    const companyId = req.user.company_id || 1;

    if (!phone || !message) {
      return res.status(400).json({ error: 'Téléphone et message obligatoires.' });
    }

    let status = 'sent';
    try {
      await whatsappService.sendTextMessage(companyId, phone, message);
    } catch (err) {
      console.error(`Erreur envoi individuel Baileys à ${phone}:`, err.message);
      status = 'sent_manual';
    }

    const result = await pool.query(`
      INSERT INTO whatsapp_logs (company_id, client_id, container_id, phone, message, status)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [companyId, client_id || null, container_id || null, phone, message, status]);

    return res.json({ log: result.rows[0] });
  } catch (err) {
    console.error('Erreur sendIndividualNotification:', err);
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
}

// Obtenir l'historique des notifications de l'entreprise
async function getWhatsAppLogs(req, res) {
  try {
    const companyId = req.user.company_id || 1;
    const result = await pool.query(`
      SELECT 
        wl.*,
        cl.name AS client_name,
        c.container_number
      FROM whatsapp_logs wl
      LEFT JOIN clients cl ON wl.client_id = cl.id
      LEFT JOIN containers c ON wl.container_id = c.id
      WHERE wl.company_id = $1
      ORDER BY wl.sent_at DESC
      LIMIT 100
    `, [companyId]);
    return res.json({ logs: result.rows });
  } catch (err) {
    console.error('Erreur getWhatsAppLogs:', err);
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
}

module.exports = {
  getWhatsAppStatus,
  connectWhatsApp,
  disconnectWhatsApp,
  getContainerNotificationPreview,
  sendBulkNotifications,
  sendIndividualNotification,
  getWhatsAppLogs
};
