const pool = require('../config/db');

// Obtenir la liste de toutes les entreprises clientes SaaS (Super Admin)
async function getCompanies(req, res) {
  try {
    const result = await pool.query(`
      SELECT 
        c.*,
        COUNT(DISTINCT u.id) AS user_count,
        COUNT(DISTINCT cnt.id) AS container_count
      FROM companies c
      LEFT JOIN users u ON c.id = u.company_id
      LEFT JOIN containers cnt ON c.id = cnt.company_id
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `);
    return res.json({ companies: result.rows });
  } catch (err) {
    console.error('Erreur getCompanies:', err);
    return res.status(500).json({ error: 'Erreur lors de la récupération des entreprises.' });
  }
}

// Créer une nouvelle société de transit cliente (Super Admin)
async function createCompany(req, res) {
  try {
    const { name, phone, email, address, currency } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Le nom de la société est obligatoire.' });
    }

    const result = await pool.query(`
      INSERT INTO companies (name, phone, email, address, currency)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [
      name.trim(),
      phone ? phone.trim() : '+221',
      email ? email.trim().toLowerCase() : null,
      address ? address.trim() : null,
      currency || 'FCFA'
    ]);

    return res.status(201).json({ company: result.rows[0], message: 'Société cliente créée avec succès !' });
  } catch (err) {
    console.error('Erreur createCompany:', err);
    return res.status(500).json({ error: 'Erreur lors de la création de la société.' });
  }
}

// Mettre à jour les informations d'une société cliente (Super Admin)
async function updateCompany(req, res) {
  try {
    const { id } = req.params;
    const { name, phone, email, address, currency, is_active } = req.body;

    const result = await pool.query(`
      UPDATE companies
      SET name = COALESCE($1, name),
          phone = COALESCE($2, phone),
          email = COALESCE($3, email),
          address = COALESCE($4, address),
          currency = COALESCE($5, currency),
          is_active = COALESCE($6, is_active)
      WHERE id = $7
      RETURNING *
    `, [name, phone, email, address, currency, is_active, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Société non trouvée.' });
    }

    return res.json({ company: result.rows[0], message: 'Informations de la société mises à jour.' });
  } catch (err) {
    console.error('Erreur updateCompany:', err);
    return res.status(500).json({ error: 'Erreur lors de la mise à jour.' });
  }
}

module.exports = {
  getCompanies,
  createCompany,
  updateCompany
};
