const pool = require('../config/db');
const { logAudit } = require('../utils/auditLogger');

function getEffectiveCompanyId(req) {
  if (req.user && req.user.role === 'super_admin' && req.query.company_id) {
    return parseInt(req.query.company_id, 10);
  }
  return (req.user && req.user.company_id) ? req.user.company_id : 1;
}

// Fonction de synchronisation automatique : passe les conteneurs en 'closed' si tous les lots sont réglés (paid)
async function autoSyncClosedContainers(companyId) {
  try {
    await pool.query(`
      UPDATE containers c
      SET status = 'closed', updated_at = CURRENT_TIMESTAMP
      WHERE c.company_id = $1
        AND c.status != 'closed'
        AND EXISTS (SELECT 1 FROM lots WHERE container_id = c.id)
        AND NOT EXISTS (
          SELECT 1 FROM lots WHERE container_id = c.id AND payment_status != 'paid'
        )
    `, [companyId]);
  } catch (err) {
    console.error('Erreur autoSyncClosedContainers:', err);
  }
}

// Obtenir tous les conteneurs avec résumé des lots et coûts
async function getContainers(req, res) {
  try {
    const companyId = getEffectiveCompanyId(req);
    await autoSyncClosedContainers(companyId);

    const query = `
      SELECT 
        c.*,
        COALESCE(cost_agg.total_costs, 0) AS total_costs,
        COALESCE(lot_agg.total_lots, 0) AS total_lots,
        COALESCE(lot_agg.total_clients, 0) AS total_clients,
        COALESCE(lot_agg.total_revenue, 0) AS total_revenue,
        COALESCE(lot_agg.total_suggested_revenue, 0) AS total_suggested_revenue
      FROM containers c
      LEFT JOIN (
        SELECT container_id, SUM(amount) AS total_costs
        FROM container_costs
        GROUP BY container_id
      ) cost_agg ON c.id = cost_agg.container_id
      LEFT JOIN (
        SELECT 
          container_id, 
          COUNT(id) AS total_lots, 
          COUNT(DISTINCT client_id) AS total_clients, 
          SUM(final_amount) AS total_revenue,
          SUM(suggested_amount) AS total_suggested_revenue
        FROM lots
        GROUP BY container_id
      ) lot_agg ON c.id = lot_agg.container_id
      WHERE c.company_id = $1
      ORDER BY c.created_at DESC
    `;
    const result = await pool.query(query, [companyId]);
    return res.json({ containers: result.rows });
  } catch (err) {
    console.error('Erreur getContainers:', err);
    return res.status(500).json({ error: 'Erreur lors de la récupération des conteneurs.' });
  }
}

// Obtenir un conteneur par ID avec le détail des coûts et lots
async function getContainerById(req, res) {
  try {
    const { id } = req.params;
    const companyId = getEffectiveCompanyId(req);
    await autoSyncClosedContainers(companyId);

    const containerQuery = await pool.query('SELECT * FROM containers WHERE id = $1 AND company_id = $2', [id, companyId]);
    if (containerQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Conteneur non trouvé.' });
    }
    const container = containerQuery.rows[0];

    const costsQuery = await pool.query('SELECT * FROM container_costs WHERE container_id = $1 ORDER BY id ASC', [id]);
    container.costs = costsQuery.rows;

    const lotsQuery = await pool.query(`
      SELECT 
        l.*,
        cl.name AS client_name,
        cl.phone AS client_phone,
        w.name AS warehouse_name,
        COALESCE(SUM(p.amount_paid), 0) AS total_paid,
        (l.final_amount - COALESCE(SUM(p.amount_paid), 0)) AS remaining_balance
      FROM lots l
      JOIN clients cl ON l.client_id = cl.id
      LEFT JOIN warehouses w ON l.warehouse_id = w.id
      LEFT JOIN payments p ON l.id = p.lot_id
      WHERE l.container_id = $1 AND l.company_id = $2
      GROUP BY l.id, cl.id, w.id
      ORDER BY l.id ASC
    `, [id, companyId]);
    container.lots = lotsQuery.rows;

    return res.json({ container });
  } catch (err) {
    console.error('Erreur getContainerById:', err);
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
}

// Créer un conteneur
async function createContainer(req, res) {
  try {
    const companyId = getEffectiveCompanyId(req);
    const {
      container_number,
      bl_number,
      shipping_line,
      agent_name,
      origin,
      loading_date,
      expected_arrival,
      notes
    } = req.body;

    if (!container_number) {
      return res.status(400).json({ error: 'Le numéro de conteneur est obligatoire.' });
    }

    const check = await pool.query('SELECT id FROM containers WHERE container_number = $1 AND company_id = $2', [container_number, companyId]);
    if (check.rows.length > 0) {
      return res.status(400).json({ error: 'Un conteneur avec ce numéro existe déjà.' });
    }

    const result = await pool.query(`
      INSERT INTO containers (
        company_id, container_number, bl_number, shipping_line, agent_name,
        origin, loading_date, expected_arrival, notes, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'in_transit')
      RETURNING *
    `, [
      companyId,
      container_number.trim(),
      bl_number || null,
      shipping_line || null,
      agent_name || null,
      origin || 'Chine (Guangzhou)',
      loading_date || null,
      expected_arrival || null,
      notes || null
    ]);

    return res.status(201).json({ container: result.rows[0] });
  } catch (err) {
    console.error('Erreur createContainer:', err);
    return res.status(500).json({ error: 'Erreur lors de la création du conteneur.' });
  }
}

// Mettre à jour un conteneur
async function updateContainer(req, res) {
  try {
    const { id } = req.params;
    const companyId = getEffectiveCompanyId(req);
    const {
      container_number,
      bl_number,
      shipping_line,
      agent_name,
      origin,
      loading_date,
      expected_arrival,
      actual_arrival,
      status,
      notes
    } = req.body;

    const result = await pool.query(`
      UPDATE containers
      SET container_number = COALESCE($1, container_number),
          bl_number = $2,
          shipping_line = $3,
          agent_name = $4,
          origin = COALESCE($5, origin),
          loading_date = $6,
          expected_arrival = $7,
          actual_arrival = $8,
          status = COALESCE($9, status),
          notes = $10,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $11 AND company_id = $12
      RETURNING *
    `, [
      container_number,
      bl_number || null,
      shipping_line || null,
      agent_name || null,
      origin,
      loading_date || null,
      expected_arrival || null,
      actual_arrival || null,
      status,
      notes || null,
      id,
      companyId
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Conteneur non trouvé.' });
    }

    return res.json({ container: result.rows[0] });
  } catch (err) {
    console.error('Erreur updateContainer:', err);
    return res.status(500).json({ error: 'Erreur lors de la mise à jour du conteneur.' });
  }
}

// Supprimer un conteneur
async function deleteContainer(req, res) {
  try {
    const { id } = req.params;
    const companyId = getEffectiveCompanyId(req);
    const result = await pool.query('DELETE FROM containers WHERE id = $1 AND company_id = $2 RETURNING *', [id, companyId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Conteneur non trouvé.' });
    }
    return res.json({ message: 'Conteneur supprimé avec succès.' });
  } catch (err) {
    console.error('Erreur deleteContainer:', err);
    return res.status(500).json({ error: 'Erreur lors de la suppression du conteneur.' });
  }
}

// Ajouter un coût annexe au conteneur
async function addContainerCost(req, res) {
  try {
    const { id } = req.params;
    const companyId = getEffectiveCompanyId(req);
    const { category, amount, description } = req.body;

    if (!category || !amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Catégorie et montant valide requis.' });
    }

    const result = await pool.query(`
      INSERT INTO container_costs (company_id, container_id, category, amount, description)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [companyId, id, category, parseFloat(amount), description || null]);

    const cost = result.rows[0];

    let containerLabel = `Conteneur #${id}`;
    try {
      const contRes = await pool.query('SELECT container_number, origin FROM containers WHERE id = $1', [id]);
      if (contRes.rows.length > 0) {
        containerLabel = `${contRes.rows[0].container_number} (${contRes.rows[0].origin})`;
      }
    } catch (e) {}

    const categoryLabels = {
      freight: 'Fret Maritime',
      customs: 'Frais de Douane',
      transport: 'Transport & Camionnage',
      handling: 'Manutention & Déchargement',
      other: 'Frais Divers'
    };
    const catName = categoryLabels[cost.category] || cost.category;
    const formattedAmount = new Intl.NumberFormat('fr-FR').format(parseFloat(cost.amount)) + ' FCFA';

    logAudit(req, {
      action: 'ADD_CONTAINER_COST',
      action_type: 'create',
      entity_type: 'container',
      entity_id: id,
      description: `Ajout d'un coût annexe (${catName} - ${formattedAmount}) au conteneur ${containerLabel}`
    });

    return res.status(201).json({ cost });
  } catch (err) {
    console.error('Erreur addContainerCost:', err);
    return res.status(500).json({ error: 'Erreur lors de l\'ajout du coût.' });
  }
}

// Supprimer un coût annexe
async function deleteContainerCost(req, res) {
  try {
    const { costId } = req.params;
    const companyId = getEffectiveCompanyId(req);
    const result = await pool.query('DELETE FROM container_costs WHERE id = $1 AND company_id = $2 RETURNING *', [costId, companyId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Coût non trouvé.' });
    }
    return res.json({ message: 'Coût supprimé avec succès.' });
  } catch (err) {
    console.error('Erreur deleteContainerCost:', err);
    return res.status(500).json({ error: 'Erreur lors de la suppression du coût.' });
  }
}

module.exports = {
  getContainers,
  getContainerById,
  createContainer,
  updateContainer,
  deleteContainer,
  addContainerCost,
  deleteContainerCost
};
