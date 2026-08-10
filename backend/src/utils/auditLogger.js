const pool = require('../config/db');

/**
 * Utilitaire centralisé pour enregistrer les traces d'audit des actions utilisateurs
 */
async function logAudit(req, { action, action_type = 'info', entity_type = null, entity_id = null, description, metadata = null }) {
  try {
    if (!description) return;
    const user = req && req.user ? req.user : null;
    const companyId = user && user.company_id ? user.company_id : 1;
    const userId = user && user.id ? user.id : null;
    const userName = user && user.name ? user.name : 'Système / Automatique';
    const userEmail = user && user.email ? user.email : 'system@cargonotify.com';

    let validUserId = null;
    if (userId) {
      try {
        const uCheck = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
        if (uCheck.rows.length > 0) validUserId = userId;
      } catch (e) {}
    }

    await pool.query(`
      INSERT INTO audit_logs (company_id, user_id, user_name, user_email, action, action_type, entity_type, entity_id, description, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [
      companyId,
      validUserId,
      userName,
      userEmail,
      action,
      action_type,
      entity_type,
      entity_id ? parseInt(entity_id, 10) : null,
      description,
      metadata ? JSON.stringify(metadata) : null
    ]);
  } catch (err) {
    console.error('Erreur enregistrement audit_log:', err.message);
  }
}

module.exports = { logAudit };
