const pool = require('../config/db');

function getEffectiveCompanyId(req) {
  if (req.user && req.user.role === 'super_admin' && req.query.company_id) {
    return parseInt(req.query.company_id, 10);
  }
  return (req.user && req.user.company_id) ? req.user.company_id : 1;
}

// Injecter les barèmes de tarification par défaut pour une entreprise selon le cahier des charges
async function seedDefaultCompanyPricing(companyId) {
  try {
    if (!companyId) return;
    const check = await pool.query('SELECT COUNT(*) FROM pricing_services WHERE company_id = $1', [companyId]);
    if (parseInt(check.rows[0].count, 10) === 0) {
      await pool.query(`
        INSERT INTO pricing_services (company_id, code, name, default_rate, unit_type, description) VALUES
        ($1, 'CBM_BASE', 'Tarif de base au CBM', 150000.00, 'per_cbm', 'Prix au mètre cube (CBM) standard'),
        ($1, 'BALE', 'Service Balle / Ballot', 10000.00, 'per_unit', 'Frais par balle ou ballot d’emballage'),
        ($1, 'COPY', 'Frais de Copie / Document', 6000.00, 'per_cbm', 'Frais de dossier/copie par CBM'),
        ($1, 'SAC', 'Frais par Sac / Colis', 10000.00, 'per_unit', 'Frais par sac individuel'),
        ($1, 'SMALL_PACKING', 'Petit Emballage / Carton', 5000.00, 'per_unit', 'Frais petit colis ou carton individuel'),
        ($1, 'HEAVY_GOODS', 'Marchandises Lourdes', 15000.00, 'per_cbm', 'Supplément marchandises lourdes par CBM')
        ON CONFLICT DO NOTHING;
      `, [companyId]);
    }
  } catch (err) {
    console.error('Erreur seedDefaultCompanyPricing:', err.message);
  }
}

// Obtenir tous les tarifs et services de l'entreprise
async function getPricingServices(req, res) {
  try {
    const companyId = getEffectiveCompanyId(req);
    await seedDefaultCompanyPricing(companyId);
    const result = await pool.query('SELECT * FROM pricing_services WHERE company_id = $1 ORDER BY id ASC', [companyId]);
    return res.json({ services: result.rows });
  } catch (err) {
    console.error('Erreur getPricingServices:', err);
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
}

// Mettre à jour un tarif (Admin)
async function updatePricingService(req, res) {
  try {
    const { id } = req.params;
    const companyId = getEffectiveCompanyId(req);
    const { name, default_rate, unit_type, description, is_active } = req.body;

    const result = await pool.query(`
      UPDATE pricing_services
      SET name = COALESCE($1, name),
          default_rate = COALESCE($2, default_rate),
          unit_type = COALESCE($3, unit_type),
          description = COALESCE($4, description),
          is_active = COALESCE($5, is_active)
      WHERE id = $6 AND company_id = $7
      RETURNING *
    `, [name, default_rate, unit_type, description, is_active, id, companyId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tarif non trouvé.' });
    }

    return res.json({ service: result.rows[0] });
  } catch (err) {
    console.error('Erreur updatePricingService:', err);
    return res.status(500).json({ error: 'Erreur lors de la mise à jour du tarif.' });
  }
}

// Créer un nouveau service ou barème (Admin)
async function createPricingService(req, res) {
  try {
    const companyId = getEffectiveCompanyId(req);
    const { code, name, default_rate, unit_type, description } = req.body;
    if (!code || !name || default_rate === undefined) {
      return res.status(400).json({ error: 'Code, nom et tarif de base obligatoires.' });
    }

    const result = await pool.query(`
      INSERT INTO pricing_services (company_id, code, name, default_rate, unit_type, description)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT DO NOTHING
      RETURNING *
    `, [companyId, code.toUpperCase().trim(), name.trim(), parseFloat(default_rate), unit_type || 'per_cbm', description || null]);

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Un tarif avec ce code existe déjà.' });
    }

    return res.status(201).json({ service: result.rows[0] });
  } catch (err) {
    console.error('Erreur createPricingService:', err);
    return res.status(500).json({ error: 'Erreur lors de la création du tarif.' });
  }
}

// Supprimer un service ou barème (Admin)
async function deletePricingService(req, res) {
  try {
    const { id } = req.params;
    const companyId = getEffectiveCompanyId(req);
    await pool.query('DELETE FROM pricing_services WHERE id = $1 AND company_id = $2', [id, companyId]);
    return res.json({ message: 'Tarif supprimé avec succès.' });
  } catch (err) {
    console.error('Erreur deletePricingService:', err);
    return res.status(500).json({ error: 'Erreur lors de la suppression.' });
  }
}

// Obtenir tous les entrepôts de l'entreprise
async function getWarehouses(req, res) {
  try {
    const companyId = getEffectiveCompanyId(req);
    const result = await pool.query('SELECT * FROM warehouses WHERE company_id = $1 ORDER BY id ASC', [companyId]);
    return res.json({ warehouses: result.rows });
  } catch (err) {
    console.error('Erreur getWarehouses:', err);
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
}

// Créer un entrepôt pour l'entreprise
async function createWarehouse(req, res) {
  try {
    const companyId = getEffectiveCompanyId(req);
    const { name, address, city, phone } = req.body;
    if (!name) return res.status(400).json({ error: 'Le nom de l’entrepôt est obligatoire.' });

    const result = await pool.query(
      'INSERT INTO warehouses (company_id, name, address, city, phone) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [companyId, name.trim(), address || null, city || 'Dakar', phone || null]
    );

    return res.status(201).json({ warehouse: result.rows[0] });
  } catch (err) {
    console.error('Erreur createWarehouse:', err);
    return res.status(500).json({ error: 'Erreur lors de la création de l’entrepôt.' });
  }
}

// Modifier un entrepôt
async function updateWarehouse(req, res) {
  try {
    const { id } = req.params;
    const companyId = getEffectiveCompanyId(req);
    const { name, address, city, phone } = req.body;

    const result = await pool.query(`
      UPDATE warehouses
      SET name = COALESCE($1, name),
          address = COALESCE($2, address),
          city = COALESCE($3, city),
          phone = COALESCE($4, phone)
      WHERE id = $5 AND company_id = $6
      RETURNING *
    `, [name, address, city, phone, id, companyId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Entrepôt non trouvé.' });
    }

    return res.json({ warehouse: result.rows[0] });
  } catch (err) {
    console.error('Erreur updateWarehouse:', err);
    return res.status(500).json({ error: 'Erreur lors de la modification de l’entrepôt.' });
  }
}

// Supprimer un entrepôt
async function deleteWarehouse(req, res) {
  try {
    const { id } = req.params;
    const companyId = getEffectiveCompanyId(req);
    await pool.query('DELETE FROM warehouses WHERE id = $1 AND company_id = $2', [id, companyId]);
    return res.json({ message: 'Entrepôt supprimé avec succès.' });
  } catch (err) {
    console.error('Erreur deleteWarehouse:', err);
    return res.status(500).json({ error: 'Erreur lors de la suppression.' });
  }
}

module.exports = {
  getPricingServices,
  updatePricingService,
  createPricingService,
  deletePricingService,
  getWarehouses,
  createWarehouse,
  updateWarehouse,
  deleteWarehouse,
  seedDefaultCompanyPricing
};
