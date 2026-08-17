const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { logAudit } = require('../utils/auditLogger');
const { getCompanySettingsData } = require('./settingsController');

// Assurer l'existence du compte Super Administrateur de l'Application au démarrage
async function ensureSuperAdminUser() {
  try {
    // 🛡️ S'assurer que la colonne is_active existe sur la table users
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;");

    const initialPass = process.env.INITIAL_SUPERADMIN_PASSWORD || process.env.DB_PASS || 'Passer@2026#';
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(initialPass, salt);

    // 1. Compte Super Admin Propriétaire de la Plateforme SaaS (Exclusif)
    await pool.query(`
      INSERT INTO users (name, email, password_hash, role, is_active)
      VALUES ('Super Administrateur Application', 'superadmin@cargonotify.sn', $1, 'super_admin', TRUE)
      ON CONFLICT (email) DO UPDATE 
      SET role = 'super_admin', is_active = TRUE;
    `, [passwordHash]);

    // 2. Compte Administrateur Client par défaut (Société de Transit)
    await pool.query(`
      UPDATE users SET role = 'admin', is_active = TRUE WHERE email = 'admin@cargonotify.sn';
    `);


  } catch (err) {
    console.error('Erreur init Super Admin user:', err);
  }
}

ensureSuperAdminUser().catch(err => console.error(err));

async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Veuillez fournir un email et un mot de passe.' });
    }

    const result = await pool.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email.trim()]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
    }

    const user = result.rows[0];

    // Vérification si le compte est actif
    if (user.is_active === false) {
      return res.status(403).json({ error: 'Votre compte a été suspendu ou désactivé par l\'administrateur système de la plateforme.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
    }

    // Vérification du Mode Maintenance : Seuls les Super Admins et Admins peuvent accéder pendant la maintenance
    const companySettings = await getCompanySettingsData();
    if (companySettings.maintenance_mode && user.role !== 'super_admin' && user.role !== 'admin') {
      return res.status(503).json({
        error: 'Application en Maintenance',
        maintenance_mode: true,
        maintenance_message: companySettings.maintenance_message
      });
    }

    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: user.role, warehouse_id: user.warehouse_id, company_id: user.company_id || 1, allowed_tabs: user.allowed_tabs },
      process.env.JWT_SECRET || 'cargo_notify_super_secret_key_2026_senegal_fret',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    logAudit({ user }, { 
      action: 'USER_LOGIN', 
      action_type: 'auth', 
      entity_type: 'user', 
      entity_id: user.id, 
      description: `Connexion réussie du collaborateur ${user.name} (${user.email})` 
    });

    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        warehouse_id: user.warehouse_id,
        company_id: user.company_id || 1,
        allowed_tabs: user.allowed_tabs
      }
    });
  } catch (err) {
    console.error('Erreur Login:', err);
    return res.status(500).json({ error: 'Erreur interne du serveur lors de la connexion.' });
  }
}

async function getMe(req, res) {
  try {
    const result = await pool.query(
      'SELECT id, name, email, role, warehouse_id, company_id, allowed_tabs, is_active, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouvé.' });
    }

    const user = result.rows[0];
    if (user.is_active === false) {
      return res.status(403).json({ error: 'Votre compte a été suspendu.' });
    }

    return res.json({ user });
  } catch (err) {
    console.error('Erreur getMe:', err);
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
}

async function changePassword(req, res) {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Mot de passe actuel et nouveau mot de passe requis.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Le nouveau mot de passe doit contenir au moins 6 caractères.' });
    }

    const userQuery = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (userQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouvé.' });
    }

    const user = userQuery.rows[0];
    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Le mot de passe actuel saisi est incorrect.' });
    }

    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(newPassword, salt);

    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, userId]);

    return res.json({ message: 'Votre mot de passe a été modifié avec succès !' });
  } catch (err) {
    console.error('Erreur changePassword:', err);
    return res.status(500).json({ error: 'Erreur lors de la modification du mot de passe.' });
  }
}

module.exports = { login, getMe, changePassword };
