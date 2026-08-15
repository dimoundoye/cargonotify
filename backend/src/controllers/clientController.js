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

function normalizePhone(p) {
  if (!p) return '';
  return String(p).replace(/[^\d+]/g, '');
}

// Obtenir tous les clients avec solde global et nombre de lots
async function getClients(req, res) {
  try {
    const companyId = getEffectiveCompanyId(req);
    const query = `
      SELECT 
        cl.*,
        COUNT(DISTINCT l.id) AS total_lots,
        COALESCE(SUM(l.final_amount), 0) AS total_billed,
        COALESCE(SUM(p.amount_paid), 0) AS total_paid,
        (COALESCE(SUM(l.final_amount), 0) - COALESCE(SUM(p.amount_paid), 0)) AS total_due
      FROM clients cl
      LEFT JOIN lots l ON cl.id = l.client_id
      LEFT JOIN payments p ON cl.id = p.client_id
      WHERE cl.company_id = $1
      GROUP BY cl.id
      ORDER BY cl.name ASC
    `;
    const result = await pool.query(query, [companyId]);
    return res.json({ clients: result.rows });
  } catch (err) {
    console.error('Erreur getClients:', err);
    return res.status(500).json({ error: 'Erreur lors de la récupération des clients.' });
  }
}

// Obtenir un client avec son historique de lots et paiements
async function getClientById(req, res) {
  try {
    const { id } = req.params;
    const companyId = getEffectiveCompanyId(req);

    const clientQuery = await pool.query('SELECT * FROM clients WHERE id = $1 AND company_id = $2', [id, companyId]);
    if (clientQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Client non trouvé.' });
    }

    const client = clientQuery.rows[0];

    // Lots du client
    const lotsQuery = await pool.query(`
      SELECT 
        l.*,
        c.container_number,
        c.origin,
        c.status AS container_status,
        c.actual_arrival,
        w.name AS warehouse_name,
        COALESCE(SUM(p.amount_paid), 0) AS total_paid,
        (l.final_amount - COALESCE(SUM(p.amount_paid), 0)) AS remaining_balance
      FROM lots l
      JOIN containers c ON l.container_id = c.id
      LEFT JOIN warehouses w ON l.warehouse_id = w.id
      LEFT JOIN payments p ON l.id = p.lot_id
      WHERE l.client_id = $1 AND l.company_id = $2
      GROUP BY l.id, c.id, w.id
      ORDER BY l.created_at DESC
    `, [id, companyId]);
    client.lots = lotsQuery.rows;

    // Paiements du client avec numéro de conteneur
    const paymentsQuery = await pool.query(`
      SELECT p.*, l.product_description, c.container_number
      FROM payments p
      JOIN lots l ON p.lot_id = l.id
      LEFT JOIN containers c ON l.container_id = c.id
      WHERE p.client_id = $1 AND p.company_id = $2
      ORDER BY p.payment_date DESC
    `, [id, companyId]);
    client.payments = paymentsQuery.rows;

    return res.json({ client });
  } catch (err) {
    console.error('Erreur getClientById:', err);
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
}

// Créer un client
async function createClient(req, res) {
  try {
    const companyId = getEffectiveCompanyId(req);
    const { name, phone, email, address, notes } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ error: 'Le nom et le numéro de téléphone sont obligatoires.' });
    }

    const cleanName = name.trim();
    const cleanPhone = phone.trim();
    const normalizedNew = normalizePhone(cleanPhone);

    // Vérifier l'unicité du couple (Nom + Numéro de téléphone) pour l'entreprise
    if (normalizedNew && normalizedNew !== '+221' && normalizedNew.length > 5) {
      const existing = await pool.query(`
        SELECT id, name, phone FROM clients 
        WHERE company_id = $1 
          AND LOWER(TRIM(name)) = LOWER(TRIM($2))
          AND REPLACE(REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '.', ''), '+', '') = $3
        LIMIT 1
      `, [companyId, cleanName, normalizedNew.replace('+', '')]);

      if (existing.rows.length > 0) {
        const match = existing.rows[0];
        return res.status(400).json({
          error: `DOUBLON DÉTECTÉ : Le client "${match.name}" avec le numéro ${cleanPhone} existe déjà dans votre base de données.`
        });
      }
    }

    const result = await pool.query(`
      INSERT INTO clients (company_id, name, phone, email, address, notes)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [companyId, cleanName, cleanPhone, email || null, address || null, notes || null]);

    return res.status(201).json({ client: result.rows[0] });
  } catch (err) {
    console.error('Erreur createClient:', err);
    return res.status(500).json({ error: 'Erreur lors de la création du client.' });
  }
}

// Mettre à jour un client
async function updateClient(req, res) {
  try {
    const { id } = req.params;
    const companyId = getEffectiveCompanyId(req);
    const { name, phone, email, address, notes } = req.body;

    const currentRes = await pool.query('SELECT name, phone FROM clients WHERE id = $1 AND company_id = $2', [id, companyId]);
    if (currentRes.rows.length === 0) {
      return res.status(404).json({ error: 'Client non trouvé.' });
    }
    const current = currentRes.rows[0];

    const targetName = (name !== undefined && name !== null ? name : current.name).trim();
    const targetPhone = (phone !== undefined && phone !== null ? phone : current.phone).trim();
    const normalizedNew = normalizePhone(targetPhone);

    if (normalizedNew && normalizedNew !== '+221' && normalizedNew.length > 5) {
      const existing = await pool.query(`
        SELECT id, name, phone FROM clients 
        WHERE company_id = $1 
          AND id != $2
          AND LOWER(TRIM(name)) = LOWER(TRIM($3))
          AND REPLACE(REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '.', ''), '+', '') = $4
        LIMIT 1
      `, [companyId, id, targetName, normalizedNew.replace('+', '')]);

      if (existing.rows.length > 0) {
        const match = existing.rows[0];
        return res.status(400).json({
          error: `DOUBLON DÉTECTÉ : Un autre client nommé "${match.name}" avec le même numéro (${targetPhone}) existe déjà.`
        });
      }
    }

    const result = await pool.query(`
      UPDATE clients
      SET name = COALESCE($1, name),
          phone = COALESCE($2, phone),
          email = $3,
          address = $4,
          notes = $5
      WHERE id = $6 AND company_id = $7
      RETURNING *
    `, [name ? name.trim() : current.name, phone ? phone.trim() : current.phone, email || null, address || null, notes || null, id, companyId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Client non trouvé.' });
    }

    return res.json({ client: result.rows[0] });
  } catch (err) {
    console.error('Erreur updateClient:', err);
    return res.status(500).json({ error: 'Erreur lors de la mise à jour du client.' });
  }
}

// Supprimer un client
async function deleteClient(req, res) {
  try {
    const { id } = req.params;
    const companyId = getEffectiveCompanyId(req);
    const result = await pool.query('DELETE FROM clients WHERE id = $1 AND company_id = $2 RETURNING *', [id, companyId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Client non trouvé.' });
    }
    return res.json({ message: 'Client supprimé avec succès.' });
  } catch (err) {
    console.error('Erreur deleteClient:', err);
    return res.status(500).json({ error: 'Erreur lors de la suppression du client.' });
  }
}

module.exports = {
  getClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient
};
