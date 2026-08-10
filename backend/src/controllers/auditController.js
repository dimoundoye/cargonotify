const pool = require('../config/db');

function getEffectiveCompanyId(req) {
  if (req.user && req.user.role === 'super_admin' && req.query.company_id) {
    return parseInt(req.query.company_id, 10);
  }
  return (req.user && req.user.company_id) ? req.user.company_id : 1;
}

// Récupérer la liste des logs d'audit avec filtres
async function getAuditLogs(req, res) {
  try {
    const companyId = getEffectiveCompanyId(req);
    const { user_id, action_type, search } = req.query;

    let query = `
      SELECT *
      FROM audit_logs
      WHERE company_id = $1
    `;
    const params = [companyId];

    if (user_id && user_id !== 'all') {
      params.push(parseInt(user_id, 10));
      query += ` AND user_id = $${params.length}`;
    }

    if (action_type && action_type !== 'all') {
      params.push(action_type);
      query += ` AND action_type = $${params.length}`;
    }

    if (search && search.trim() !== '') {
      params.push(`%${search.trim()}%`);
      query += ` AND (description ILIKE $${params.length} OR user_name ILIKE $${params.length} OR user_email ILIKE $${params.length} OR action ILIKE $${params.length})`;
    }

    query += ` ORDER BY created_at DESC LIMIT 200`;

    const result = await pool.query(query, params);
    const logs = result.rows;

    // Métriques récapitulatives sur les 30 derniers jours
    const kpiRes = await pool.query(`
      SELECT 
        COUNT(*) AS total_logs,
        COUNT(CASE WHEN action_type = 'create' THEN 1 END) AS create_count,
        COUNT(CASE WHEN action_type = 'update' THEN 1 END) AS update_count,
        COUNT(CASE WHEN action_type = 'delete' THEN 1 END) AS delete_count,
        COUNT(CASE WHEN action_type = 'auth' THEN 1 END) AS auth_count,
        COUNT(CASE WHEN action_type = 'communication' THEN 1 END) AS comm_count
      FROM audit_logs
      WHERE company_id = $1
    `, [companyId]);

    const summary = kpiRes.rows[0];

    return res.json({
      logs,
      summary: {
        total_logs: parseInt(summary.total_logs, 10),
        create_count: parseInt(summary.create_count, 10),
        update_count: parseInt(summary.update_count, 10),
        delete_count: parseInt(summary.delete_count, 10),
        auth_count: parseInt(summary.auth_count, 10),
        comm_count: parseInt(summary.comm_count, 10)
      }
    });
  } catch (err) {
    console.error('Erreur getAuditLogs:', err);
    return res.status(500).json({ error: 'Erreur lors du chargement du journal d\'audit.' });
  }
}

module.exports = { getAuditLogs };
