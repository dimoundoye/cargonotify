const pool = require('../config/db');
const { logAudit } = require('../utils/auditLogger');

function getEffectiveCompanyId(req) {
  if (req.user && req.user.role === 'super_admin' && req.query.company_id) {
    return parseInt(req.query.company_id, 10);
  }
  return (req.user && req.user.company_id) ? req.user.company_id : 1;
}

// Obtenir tous les lots ou filtrer par conteneur/client
async function getLots(req, res) {
  try {
    const { container_id, client_id, pickup_status, payment_status } = req.query;
    const companyId = getEffectiveCompanyId(req);

    let query = `
      SELECT 
        l.*,
        cl.name AS client_name,
        cl.phone AS client_phone,
        c.container_number,
        c.origin AS container_origin,
        c.status AS container_status,
        c.actual_arrival,
        w.name AS warehouse_name,
        COALESCE(SUM(p.amount_paid), 0) AS total_paid,
        (l.final_amount - COALESCE(SUM(p.amount_paid), 0)) AS remaining_balance
      FROM lots l
      JOIN clients cl ON l.client_id = cl.id
      JOIN containers c ON l.container_id = c.id
      LEFT JOIN warehouses w ON l.warehouse_id = w.id
      LEFT JOIN payments p ON l.id = p.lot_id
      WHERE l.company_id = $1
    `;
    const params = [companyId];

    if (container_id) {
      params.push(container_id);
      query += ` AND l.container_id = $${params.length}`;
    }
    if (client_id) {
      params.push(client_id);
      query += ` AND l.client_id = $${params.length}`;
    }
    if (pickup_status) {
      params.push(pickup_status);
      query += ` AND l.pickup_status = $${params.length}`;
    }
    if (payment_status) {
      params.push(payment_status);
      query += ` AND l.payment_status = $${params.length}`;
    }

    query += `
      GROUP BY l.id, cl.id, c.id, w.id
      ORDER BY l.created_at DESC
    `;

    const result = await pool.query(query, params);
    return res.json({ lots: result.rows });
  } catch (err) {
    console.error('Erreur getLots:', err);
    return res.status(500).json({ error: 'Erreur lors de la récupération des lots.' });
  }
}

// Obtenir un lot par ID avec le détail des services associés
async function getLotById(req, res) {
  try {
    const { id } = req.params;
    const companyId = getEffectiveCompanyId(req);

    const query = `
      SELECT 
        l.*,
        cl.name AS client_name,
        cl.phone AS client_phone,
        cl.email AS client_email,
        c.container_number,
        c.origin AS container_origin,
        c.status AS container_status,
        c.actual_arrival,
        w.name AS warehouse_name,
        COALESCE(SUM(p.amount_paid), 0) AS total_paid,
        (l.final_amount - COALESCE(SUM(p.amount_paid), 0)) AS remaining_balance
      FROM lots l
      JOIN clients cl ON l.client_id = cl.id
      JOIN containers c ON l.container_id = c.id
      LEFT JOIN warehouses w ON l.warehouse_id = w.id
      LEFT JOIN payments p ON l.id = p.lot_id
      WHERE l.id = $1 AND l.company_id = $2
      GROUP BY l.id, cl.id, c.id, w.id
    `;
    const result = await pool.query(query, [id, companyId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lot non trouvé.' });
    }

    const lot = result.rows[0];
    const servicesQuery = await pool.query('SELECT * FROM lot_service_items WHERE lot_id = $1', [id]);
    lot.services = servicesQuery.rows;

    const paymentsQuery = await pool.query('SELECT * FROM payments WHERE lot_id = $1 ORDER BY payment_date DESC', [id]);
    lot.payments = paymentsQuery.rows;

    return res.json({ lot });
  } catch (err) {
    console.error('Erreur getLotById:', err);
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
}

async function ensureLotColumns() {
  try {
    await pool.query(`
      ALTER TABLE lots ADD COLUMN IF NOT EXISTS heavy_goods_qty NUMERIC DEFAULT 0;
      ALTER TABLE lots ADD COLUMN IF NOT EXISTS heavy_goods_amount NUMERIC DEFAULT 0;
    `);
  } catch (err) {
    console.error('Erreur ensureLotColumns:', err.message);
  }
}
ensureLotColumns();

// Créer un lot de marchandise pour un client dans un conteneur
async function createLot(req, res) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const companyId = getEffectiveCompanyId(req);
    const {
      container_id,
      client_id,
      warehouse_id,
      product_description,
      quantity,
      weight_kg,
      volume_cbm,
      cbm_rate,
      cbm_amount,
      bale_qty,
      bale_amount,
      copy_qty,
      copy_amount,
      small_packing_qty,
      small_packing_amount,
      heavy_goods_qty,
      heavy_goods_amount,
      services, // Array of { service_id, service_name, quantity, rate }
      manual_final_amount,
      notes
    } = req.body;

    if (!container_id || !client_id || !product_description) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Conteneur, client et description sont obligatoires.' });
    }

    const cbmVal = parseFloat(volume_cbm) || 0;
    const rateVal = parseFloat(cbm_rate) || 150000;
    const cbmAmtVal = (cbm_amount !== undefined && cbm_amount !== null && cbm_amount !== '') ? parseFloat(cbm_amount) : (cbmVal * rateVal);

    const bQty = parseInt(bale_qty, 10) || 0;
    const bAmt = (bale_amount !== undefined && bale_amount !== null && bale_amount !== '') ? parseFloat(bale_amount) : (bQty * 10000);

    const cQty = parseFloat(copy_qty) || 0;
    const cAmt = (copy_amount !== undefined && copy_amount !== null && copy_amount !== '') ? parseFloat(copy_amount) : (cQty * 6000);

    const spQty = parseInt(small_packing_qty, 10) || 0;
    const spAmt = (small_packing_amount !== undefined && small_packing_amount !== null && small_packing_amount !== '') ? parseFloat(small_packing_amount) : (spQty * 1000);

    const hgQty = parseFloat(heavy_goods_qty) || 0;
    const hgAmt = (heavy_goods_amount !== undefined && heavy_goods_amount !== null && heavy_goods_amount !== '') ? parseFloat(heavy_goods_amount) : (hgQty * 15000);

    let suggested_amount = cbmAmtVal + bAmt + cAmt + spAmt + hgAmt;

    if (Array.isArray(services) && services.length > 0) {
      for (const s of services) {
        const qty = parseFloat(s.quantity) || 1;
        const rate = parseFloat(s.rate) || 0;
        const lineTotal = qty * rate;
        suggested_amount += lineTotal;
      }
    }

    const final_amount = (manual_final_amount !== undefined && manual_final_amount !== null && manual_final_amount !== '')
      ? parseFloat(manual_final_amount)
      : suggested_amount;

    const lotInsertResult = await client.query(`
      INSERT INTO lots (
        company_id, container_id, client_id, warehouse_id, product_description,
        quantity, weight_kg, volume_cbm, cbm_rate, cbm_amount,
        bale_qty, bale_amount, copy_qty, copy_amount,
        small_packing_qty, small_packing_amount,
        heavy_goods_qty, heavy_goods_amount,
        suggested_amount, final_amount, payment_status, pickup_status, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, 'unpaid', 'pending', $21)
      RETURNING *
    `, [
      companyId,
      container_id,
      client_id,
      warehouse_id || null,
      product_description,
      parseInt(quantity, 10) || 1,
      parseFloat(weight_kg) || 0,
      cbmVal,
      rateVal,
      cbmAmtVal,
      bQty,
      bAmt,
      cQty,
      cAmt,
      spQty,
      spAmt,
      hgQty,
      hgAmt,
      suggested_amount,
      final_amount,
      notes || null
    ]);

    const createdLot = lotInsertResult.rows[0];

    await client.query('COMMIT');
    
    let clientName = `Client #${createdLot.client_id}`;
    let containerNum = `Conteneur #${createdLot.container_id}`;
    try {
      const cRes = await pool.query('SELECT name FROM clients WHERE id = $1', [createdLot.client_id]);
      if (cRes.rows.length > 0) clientName = cRes.rows[0].name;

      const contRes = await pool.query('SELECT container_number, origin FROM containers WHERE id = $1', [createdLot.container_id]);
      if (contRes.rows.length > 0) containerNum = `${contRes.rows[0].container_number} (${contRes.rows[0].origin})`;
    } catch (e) {}

    logAudit(req, {
      action: 'CREATE_LOT',
      action_type: 'create',
      entity_type: 'lot',
      entity_id: createdLot.id,
      description: `Création du lot "${createdLot.product_description || 'Lot #' + createdLot.id}" (${createdLot.volume_cbm} CBM) pour le client ${clientName} (Conteneur ${containerNum})`
    });

    return res.status(201).json({ lot: createdLot });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erreur createLot:', err);
    return res.status(500).json({ error: 'Erreur lors de la création du lot.' });
  } finally {
    client.release();
  }
}

// Mettre à jour le statut de retrait d'un lot
async function updatePickupStatus(req, res) {
  try {
    const { id } = req.params;
    const companyId = getEffectiveCompanyId(req);
    const { pickup_status, pickup_date, warehouse_id } = req.body;

    const dateVal = pickup_status === 'picked_up' ? (pickup_date || new Date().toISOString().split('T')[0]) : null;

    const result = await pool.query(`
      UPDATE lots
      SET pickup_status = $1,
          pickup_date = $2,
          warehouse_id = COALESCE($3, warehouse_id),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $4 AND company_id = $5
      RETURNING *
    `, [pickup_status, dateVal, warehouse_id || null, id, companyId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lot non trouvé.' });
    }

    return res.json({ lot: result.rows[0] });
  } catch (err) {
    console.error('Erreur updatePickupStatus:', err);
    return res.status(500).json({ error: 'Erreur lors de la mise à jour du statut de retrait.' });
  }
}

// Mettre à jour le lot
async function updateLot(req, res) {
  try {
    const { id } = req.params;
    const companyId = getEffectiveCompanyId(req);
    const {
      product_description, quantity, weight_kg, volume_cbm,
      cbm_rate, cbm_amount, bale_qty, bale_amount, copy_qty, copy_amount,
      small_packing_qty, small_packing_amount, heavy_goods_qty, heavy_goods_amount, final_amount, warehouse_id, notes
    } = req.body;

    const result = await pool.query(`
      UPDATE lots
      SET product_description = COALESCE($1, product_description),
          quantity = COALESCE($2, quantity),
          weight_kg = COALESCE($3, weight_kg),
          volume_cbm = COALESCE($4, volume_cbm),
          cbm_rate = COALESCE($5, cbm_rate),
          cbm_amount = COALESCE($6, cbm_amount),
          bale_qty = COALESCE($7, bale_qty),
          bale_amount = COALESCE($8, bale_amount),
          copy_qty = COALESCE($9, copy_qty),
          copy_amount = COALESCE($10, copy_amount),
          small_packing_qty = COALESCE($11, small_packing_qty),
          small_packing_amount = COALESCE($12, small_packing_amount),
          heavy_goods_qty = COALESCE($13, heavy_goods_qty),
          heavy_goods_amount = COALESCE($14, heavy_goods_amount),
          final_amount = COALESCE($15, final_amount),
          warehouse_id = COALESCE($16, warehouse_id),
          notes = $17,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $18 AND company_id = $19
      RETURNING *
    `, [
      product_description, quantity, weight_kg, volume_cbm,
      cbm_rate, cbm_amount, bale_qty, bale_amount, copy_qty, copy_amount,
      small_packing_qty, small_packing_amount, heavy_goods_qty, heavy_goods_amount, final_amount, warehouse_id || null, notes || null, id, companyId
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lot non trouvé.' });
    }

    return res.json({ lot: result.rows[0] });
  } catch (err) {
    console.error('Erreur updateLot:', err);
    return res.status(500).json({ error: 'Erreur lors de la modification du lot.' });
  }
}

// Supprimer un lot
async function deleteLot(req, res) {
  try {
    const { id } = req.params;
    const companyId = getEffectiveCompanyId(req);

    const lotQuery = await pool.query(`
      SELECT l.product_description, cl.name AS client_name 
      FROM lots l 
      LEFT JOIN clients cl ON l.client_id = cl.id 
      WHERE l.id = $1 AND l.company_id = $2
    `, [id, companyId]);

    const lotInfo = lotQuery.rows[0];

    await pool.query('DELETE FROM lots WHERE id = $1 AND company_id = $2', [id, companyId]);

    logAudit(req, {
      action: 'DELETE_LOT',
      action_type: 'delete',
      entity_type: 'lot',
      entity_id: id,
      description: lotInfo 
        ? `Suppression du lot "${lotInfo.product_description}" du client ${lotInfo.client_name || 'Inconnu'}`
        : `Suppression du lot ID #${id}`
    });

    return res.json({ message: 'Lot supprimé avec succès.' });
  } catch (err) {
    console.error('Erreur deleteLot:', err);
    return res.status(500).json({ error: 'Erreur lors de la suppression.' });
  }
}

module.exports = {
  getLots,
  getLotById,
  createLot,
  updatePickupStatus,
  updateLot,
  deleteLot
};
