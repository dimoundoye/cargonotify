const pool = require('../config/db');

const DEFAULT_WHATSAPP_TEMPLATE = `📦 *[Nom Société] — Notification d'arrivée de Marchandise*

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

// Assurer l'existence des tables et colonnes de configuration et de contrôle d'accès
async function ensureTablesAndColumns() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS company_settings (
      id INT PRIMARY KEY DEFAULT 1,
      company_name VARCHAR(255) NOT NULL DEFAULT 'CargoNotify Transit & Logistique',
      phone VARCHAR(100) NOT NULL DEFAULT '+221',
      email VARCHAR(255) NOT NULL DEFAULT 'contact@cargonotify.sn',
      address TEXT NOT NULL DEFAULT 'Dakar, Sénégal',
      currency VARCHAR(50) NOT NULL DEFAULT 'FCFA',
      maintenance_mode BOOLEAN DEFAULT FALSE,
      maintenance_message TEXT DEFAULT 'CargoNotify est actuellement en cours de maintenance. Nous serons de retour très bientôt !',
      signature_base64 TEXT,
      whatsapp_template TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    INSERT INTO company_settings (id, company_name, phone, email, address, currency)
    VALUES (1, 'CargoNotify Transit & Logistique', '+221', 'contact@cargonotify.sn', 'Dakar, Sénégal', 'FCFA')
    ON CONFLICT (id) DO NOTHING;

    ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS maintenance_mode BOOLEAN DEFAULT FALSE;
    ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS maintenance_message TEXT DEFAULT 'CargoNotify est actuellement en cours de maintenance. Nous serons de retour très bientôt !';
    ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS signature_base64 TEXT;
    ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS whatsapp_template TEXT;

    ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
  `);
}

ensureTablesAndColumns().catch(err => console.error('Erreur init DB settings:', err));

// Helper d'accès direct au profil et statut maintenance par entreprise
async function getCompanySettingsData(companyId = 1) {
  try {
    const targetCompanyId = companyId || 1;

    // 1. Récupérer les infos officielles de l'entreprise depuis la table `companies`
    const compRes = await pool.query('SELECT * FROM companies WHERE id = $1', [targetCompanyId]);
    const company = compRes.rows[0];

    // 2. Récupérer la configuration additionnelle (cachet, maintenance) depuis `company_settings`
    const settingsRes = await pool.query('SELECT * FROM company_settings WHERE id = $1', [targetCompanyId]);
    const settings = settingsRes.rows[0] || {};

    if (company || settings.company_name) {
      return {
        id: targetCompanyId,
        company_name: (company && company.name) || settings.company_name || 'CargoNotify Transit & Logistique',
        phone: (company && company.phone) || settings.phone || '+221',
        email: (company && company.email) || settings.email || 'contact@cargonotify.sn',
        address: (company && company.address) || settings.address || 'Dakar, Sénégal',
        currency: (company && company.currency) || settings.currency || 'FCFA',
        maintenance_mode: settings.maintenance_mode || false,
        maintenance_message: settings.maintenance_message || 'CargoNotify est actuellement en cours de maintenance. Nous serons de retour très bientôt !',
        signature_base64: settings.signature_base64 || null,
        whatsapp_template: settings.whatsapp_template || DEFAULT_WHATSAPP_TEMPLATE
      };
    }
  } catch (e) {
    console.error('Erreur getCompanySettingsData:', e);
  }
  return {
    id: companyId || 1,
    company_name: 'CargoNotify Transit & Logistique',
    phone: '+221',
    email: 'contact@cargonotify.sn',
    address: 'Dakar, Sénégal',
    currency: 'FCFA',
    maintenance_mode: false,
    maintenance_message: 'CargoNotify est actuellement en cours de maintenance. Nous serons de retour très bientôt !',
    signature_base64: null,
    whatsapp_template: DEFAULT_WHATSAPP_TEMPLATE
  };
}

// Route API: Obtenir le profil de l'entreprise & statut système
async function getCompanySettings(req, res) {
  try {
    const companyId = req.user?.company_id || 1;
    const data = await getCompanySettingsData(companyId);
    return res.json({ settings: data });
  } catch (err) {
    console.error('Erreur getCompanySettings:', err);
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
}

// Route API: Mettre à jour le profil & Cachet/Signature & Modèle WhatsApp (Admin)
async function updateCompanySettings(req, res) {
  try {
    const companyId = req.user?.company_id || 1;
    const { company_name, phone, email, address, currency, maintenance_mode, maintenance_message, signature_base64, whatsapp_template } = req.body;

    // 1. Mettre à jour la table principale des entreprises `companies`
    if (company_name) {
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

    // 2. Mettre à jour la table des paramètres additionnels `company_settings`
    await pool.query(`
      INSERT INTO company_settings (id, company_name, phone, email, address, currency, maintenance_mode, maintenance_message, signature_base64, whatsapp_template, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE
      SET company_name = COALESCE(EXCLUDED.company_name, company_settings.company_name),
          phone = COALESCE(EXCLUDED.phone, company_settings.phone),
          email = COALESCE(EXCLUDED.email, company_settings.email),
          address = COALESCE(EXCLUDED.address, company_settings.address),
          currency = COALESCE(EXCLUDED.currency, company_settings.currency),
          maintenance_mode = EXCLUDED.maintenance_mode,
          maintenance_message = COALESCE(EXCLUDED.maintenance_message, company_settings.maintenance_message),
          signature_base64 = COALESCE(EXCLUDED.signature_base64, company_settings.signature_base64),
          whatsapp_template = COALESCE(EXCLUDED.whatsapp_template, company_settings.whatsapp_template),
          updated_at = CURRENT_TIMESTAMP
    `, [
      companyId,
      company_name || 'CargoNotify Transit & Logistique',
      phone || '+221',
      email || 'contact@cargonotify.sn',
      address || 'Dakar, Sénégal',
      currency || 'FCFA',
      maintenance_mode === true,
      maintenance_message || 'CargoNotify est actuellement en cours de maintenance. Nous serons de retour très bientôt !',
      signature_base64 || null,
      whatsapp_template || null
    ]);

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
