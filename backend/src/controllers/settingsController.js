const pool = require('../config/db');

// Assurer l'existence des tables et colonnes de configuration et de contrôle d'accès
async function ensureTablesAndColumns() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS company_settings (
      id INT PRIMARY KEY DEFAULT 1,
      company_name VARCHAR(255) NOT NULL DEFAULT 'CargoNotify Transit & Logistique',
      phone VARCHAR(100) NOT NULL DEFAULT '+221 77 872 16 15',
      email VARCHAR(255) NOT NULL DEFAULT 'contact@cargonotify.sn',
      address TEXT NOT NULL DEFAULT 'Dakar, Sénégal',
      currency VARCHAR(50) NOT NULL DEFAULT 'FCFA',
      maintenance_mode BOOLEAN DEFAULT FALSE,
      maintenance_message TEXT DEFAULT 'CargoNotify est actuellement en cours de maintenance. Nous serons de retour très bientôt !',
      signature_base64 TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    INSERT INTO company_settings (id, company_name, phone, email, address, currency)
    VALUES (1, 'CargoNotify Transit & Logistique', '+221 77 872 16 15', 'contact@cargonotify.sn', 'Dakar, Sénégal', 'FCFA')
    ON CONFLICT (id) DO NOTHING;

    ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS maintenance_mode BOOLEAN DEFAULT FALSE;
    ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS maintenance_message TEXT DEFAULT 'CargoNotify est actuellement en cours de maintenance. Nous serons de retour très bientôt !';
    ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS signature_base64 TEXT;

    ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
  `);
}

ensureTablesAndColumns().catch(err => console.error('Erreur init DB settings:', err));

// Helper d'accès direct au profil et statut maintenance
async function getCompanySettingsData() {
  try {
    const res = await pool.query('SELECT * FROM company_settings WHERE id = 1');
    if (res.rows.length > 0) return res.rows[0];
  } catch (e) {
    console.error('Erreur getCompanySettingsData:', e);
  }
  return {
    company_name: 'CargoNotify Transit & Logistique',
    phone: '+221 77 872 16 15',
    email: 'contact@cargonotify.sn',
    address: 'Dakar, Sénégal',
    currency: 'FCFA',
    maintenance_mode: false,
    maintenance_message: 'CargoNotify est actuellement en cours de maintenance. Nous serons de retour très bientôt !',
    signature_base64: null
  };
}

// Route API: Obtenir le profil de l'entreprise & statut système
async function getCompanySettings(req, res) {
  try {
    const data = await getCompanySettingsData();
    return res.json({ settings: data });
  } catch (err) {
    console.error('Erreur getCompanySettings:', err);
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
}

// Route API: Mettre à jour le profil & Cachet/Signature (Admin)
async function updateCompanySettings(req, res) {
  try {
    const { company_name, phone, email, address, currency, maintenance_mode, maintenance_message, signature_base64 } = req.body;

    const result = await pool.query(`
      INSERT INTO company_settings (id, company_name, phone, email, address, currency, maintenance_mode, maintenance_message, signature_base64, updated_at)
      VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE
      SET company_name = COALESCE(EXCLUDED.company_name, company_settings.company_name),
          phone = COALESCE(EXCLUDED.phone, company_settings.phone),
          email = COALESCE(EXCLUDED.email, company_settings.email),
          address = COALESCE(EXCLUDED.address, company_settings.address),
          currency = COALESCE(EXCLUDED.currency, company_settings.currency),
          maintenance_mode = EXCLUDED.maintenance_mode,
          maintenance_message = COALESCE(EXCLUDED.maintenance_message, company_settings.maintenance_message),
          signature_base64 = COALESCE(EXCLUDED.signature_base64, company_settings.signature_base64),
          updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [
      company_name || 'CargoNotify Transit & Logistique',
      phone || '+221 77 872 16 15',
      email || 'contact@cargonotify.sn',
      address || 'Dakar, Sénégal',
      currency || 'FCFA',
      maintenance_mode === true,
      maintenance_message || 'CargoNotify est actuellement en cours de maintenance. Nous serons de retour très bientôt !',
      signature_base64 || null
    ]);

    return res.json({ settings: result.rows[0], message: 'Paramètres enregistrés avec succès !' });
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
