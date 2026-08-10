const pool = require('../config/db');

// Assurer l'existence des tables et colonnes de configuration
async function ensureTablesAndColumns() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS platform_settings (
      id INT PRIMARY KEY DEFAULT 1,
      maintenance_mode BOOLEAN DEFAULT FALSE,
      maintenance_message TEXT DEFAULT 'CargoNotify est actuellement en cours de maintenance. Nous serons de retour très bientôt !',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    INSERT INTO platform_settings (id, maintenance_mode, maintenance_message)
    VALUES (1, FALSE, 'CargoNotify est actuellement en cours de maintenance. Nous serons de retour très bientôt !')
    ON CONFLICT (id) DO NOTHING;

    ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
  `);
}

ensureTablesAndColumns().catch(err => console.error('Erreur init DB settings:', err));

// Helper d'accès au profil d'une entreprise et au statut de maintenance
async function getCompanySettingsData(companyId = 1) {
  try {
    const compRes = await pool.query('SELECT * FROM companies WHERE id = $1', [companyId]);
    const platformRes = await pool.query('SELECT * FROM platform_settings WHERE id = 1');

    const comp = compRes.rows[0] || {};
    const platform = platformRes.rows[0] || {};

    return {
      company_name: comp.name || '',
      phone: comp.phone || '',
      email: comp.email || '',
      address: comp.address || '',
      currency: comp.currency || 'FCFA',
      maintenance_mode: platform.maintenance_mode || false,
      maintenance_message: platform.maintenance_message || 'CargoNotify est actuellement en cours de maintenance.'
    };
  } catch (e) {
    console.error('Erreur getCompanySettingsData:', e);
    return {
      company_name: '',
      phone: '',
      email: '',
      address: '',
      currency: 'FCFA',
      maintenance_mode: false,
      maintenance_message: 'CargoNotify est actuellement en cours de maintenance.'
    };
  }
}

// Route API: Obtenir le profil de l'entreprise connectée
async function getCompanySettings(req, res) {
  try {
    const companyId = (req.user && req.user.company_id) ? req.user.company_id : 1;
    const data = await getCompanySettingsData(companyId);
    return res.json({ settings: data });
  } catch (err) {
    console.error('Erreur getCompanySettings:', err);
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
}

// Route API: Mettre à jour le mode maintenance (Super Admin) ou le profil société
async function updateCompanySettings(req, res) {
  try {
    const { company_name, phone, email, address, currency, maintenance_mode, maintenance_message } = req.body;
    const companyId = (req.user && req.user.company_id) ? req.user.company_id : 1;

    // Mise à jour de la société de l'utilisateur s'il y a des modifications de profil
    if (company_name || phone || email || address || currency) {
      await pool.query(`
        UPDATE companies
        SET name = COALESCE($1, name),
            phone = COALESCE($2, phone),
            email = COALESCE($3, email),
            address = COALESCE($4, address),
            currency = COALESCE($5, currency)
        WHERE id = $6
      `, [company_name, phone, email, address, currency, companyId]);
    }

    // Si Super Admin modifie le mode maintenance global
    if (req.user && req.user.role === 'super_admin' && maintenance_mode !== undefined) {
      await pool.query(`
        UPDATE platform_settings
        SET maintenance_mode = $1,
            maintenance_message = COALESCE($2, maintenance_message),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = 1
      `, [maintenance_mode === true, maintenance_message]);
    }

    const updatedData = await getCompanySettingsData(companyId);
    return res.json({ settings: updatedData, message: 'Paramètres enregistrés avec succès !' });
  } catch (err) {
    console.error('Erreur updateCompanySettings:', err);
    return res.status(500).json({ error: 'Erreur lors de l’enregistrement des paramètres.' });
  }
}

module.exports = {
  getCompanySettings,
  updateCompanySettings,
  getCompanySettingsData
};
