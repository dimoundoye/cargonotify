const bcrypt = require('bcryptjs');
const pool = require('../config/db');

function getEffectiveCompanyId(req) {
  if (req.user && req.user.role === 'super_admin' && req.query.company_id) {
    return parseInt(req.query.company_id, 10);
  }
  return (req.user && req.user.company_id) ? req.user.company_id : 1;
}

// Obtenir tous les utilisateurs / collaborateurs avec statut d'activation
async function getUsers(req, res) {
  try {
    const isSuperAdmin = req.user && req.user.role === 'super_admin';
    let query = '';
    let params = [];

    if (isSuperAdmin && !req.query.company_id) {
      query = `
        SELECT 
          u.id,
          u.company_id,
          c.name AS company_name,
          u.name,
          u.email,
          u.role,
          u.warehouse_id,
          u.allowed_tabs,
          COALESCE(u.is_active, TRUE) AS is_active,
          u.created_at,
          w.name AS warehouse_name
        FROM users u
        LEFT JOIN companies c ON u.company_id = c.id
        LEFT JOIN warehouses w ON u.warehouse_id = w.id
        ORDER BY u.created_at DESC
      `;
    } else {
      const companyId = getEffectiveCompanyId(req);
      query = `
        SELECT 
          u.id,
          u.company_id,
          u.name,
          u.email,
          u.role,
          u.warehouse_id,
          u.allowed_tabs,
          COALESCE(u.is_active, TRUE) AS is_active,
          u.created_at,
          w.name AS warehouse_name
        FROM users u
        LEFT JOIN warehouses w ON u.warehouse_id = w.id
        WHERE u.company_id = $1
        ORDER BY u.created_at DESC
      `;
      params = [companyId];
    }

    const result = await pool.query(query, params);
    return res.json({ users: result.rows });
  } catch (err) {
    console.error('Erreur getUsers:', err);
    return res.status(500).json({ error: 'Erreur lors de la récupération des utilisateurs.' });
  }
}

// Créer un nouveau collaborateur
async function createUser(req, res) {
  try {
    const companyId = (req.body.company_id && req.user.role === 'super_admin') 
      ? parseInt(req.body.company_id, 10) 
      : getEffectiveCompanyId(req);

    const { name, email, password, role, warehouse_id, is_active, allowed_tabs } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nom, email et mot de passe sont obligatoires.' });
    }

    // Vérifier si l'email existe déjà
    const checkQuery = await pool.query('SELECT id FROM users WHERE email = $1', [email.trim().toLowerCase()]);
    if (checkQuery.rows.length > 0) {
      return res.status(400).json({ error: 'Un compte avec cet email existe déjà.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const allowedTabsValue = Array.isArray(allowed_tabs) ? JSON.stringify(allowed_tabs) : null;

    const result = await pool.query(`
      INSERT INTO users (company_id, name, email, password_hash, role, warehouse_id, allowed_tabs, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, company_id, name, email, role, warehouse_id, allowed_tabs, is_active, created_at
    `, [
      companyId,
      name.trim(), 
      email.trim().toLowerCase(), 
      passwordHash, 
      role || 'logistics', 
      warehouse_id ? parseInt(warehouse_id, 10) : null,
      allowedTabsValue,
      is_active !== undefined ? is_active : true
    ]);

    return res.status(201).json({ user: result.rows[0] });
  } catch (err) {
    console.error('Erreur createUser:', err);
    return res.status(500).json({ error: 'Erreur lors de la création du collaborateur.' });
  }
}

// Mettre à jour les informations, rôles et statut d'activation d'un collaborateur
async function updateUser(req, res) {
  try {
    const { id } = req.params;
    const isSuperAdmin = req.user && req.user.role === 'super_admin';
    const companyId = getEffectiveCompanyId(req);
    const { name, email, role, warehouse_id, is_active, password, allowed_tabs } = req.body;

    let passwordHashUpdate = null;
    if (password && password.trim() !== '') {
      const salt = await bcrypt.genSalt(10);
      passwordHashUpdate = await bcrypt.hash(password, salt);
    }

    const allowedTabsValue = Array.isArray(allowed_tabs) 
      ? JSON.stringify(allowed_tabs) 
      : (allowed_tabs === null ? null : undefined);

    let query = '';
    let params = [];

    if (passwordHashUpdate) {
      query = `
        UPDATE users
        SET name = COALESCE($1, name),
            email = COALESCE($2, email),
            role = COALESCE($3, role),
            warehouse_id = $4,
            is_active = COALESCE($5, is_active),
            password_hash = $6,
            allowed_tabs = ${allowedTabsValue !== undefined ? '$7' : 'allowed_tabs'}
        WHERE id = ${allowedTabsValue !== undefined ? '$8' : '$7'} ${isSuperAdmin ? '' : 'AND company_id = ' + (allowedTabsValue !== undefined ? '$9' : '$8')}
        RETURNING id, company_id, name, email, role, warehouse_id, allowed_tabs, is_active, created_at
      `;
      params = isSuperAdmin 
        ? (allowedTabsValue !== undefined ? [name, email, role, warehouse_id || null, is_active, passwordHashUpdate, allowedTabsValue, id] : [name, email, role, warehouse_id || null, is_active, passwordHashUpdate, id])
        : (allowedTabsValue !== undefined ? [name, email, role, warehouse_id || null, is_active, passwordHashUpdate, allowedTabsValue, id, companyId] : [name, email, role, warehouse_id || null, is_active, passwordHashUpdate, id, companyId]);
    } else {
      query = `
        UPDATE users
        SET name = COALESCE($1, name),
            email = COALESCE($2, email),
            role = COALESCE($3, role),
            warehouse_id = $4,
            is_active = COALESCE($5, is_active),
            allowed_tabs = ${allowedTabsValue !== undefined ? '$6' : 'allowed_tabs'}
        WHERE id = ${allowedTabsValue !== undefined ? '$7' : '$6'} ${isSuperAdmin ? '' : 'AND company_id = ' + (allowedTabsValue !== undefined ? '$8' : '$7')}
        RETURNING id, company_id, name, email, role, warehouse_id, allowed_tabs, is_active, created_at
      `;
      params = isSuperAdmin
        ? (allowedTabsValue !== undefined ? [name, email, role, warehouse_id || null, is_active, allowedTabsValue, id] : [name, email, role, warehouse_id || null, is_active, id])
        : (allowedTabsValue !== undefined ? [name, email, role, warehouse_id || null, is_active, allowedTabsValue, id, companyId] : [name, email, role, warehouse_id || null, is_active, id, companyId]);
    }

    const result = await pool.query(query, params);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouvé.' });
    }

    return res.json({ user: result.rows[0] });
  } catch (err) {
    console.error('Erreur updateUser:', err);
    return res.status(500).json({ error: 'Erreur lors de la mise à jour.' });
  }
}

// Supprimer un collaborateur
async function deleteUser(req, res) {
  try {
    const { id } = req.params;
    const isSuperAdmin = req.user && req.user.role === 'super_admin';
    const companyId = getEffectiveCompanyId(req);

    if (parseInt(id, 10) === req.user.id) {
      return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte.' });
    }

    const query = isSuperAdmin
      ? 'DELETE FROM users WHERE id = $1 RETURNING *'
      : 'DELETE FROM users WHERE id = $1 AND company_id = $2 RETURNING *';
    const params = isSuperAdmin ? [id] : [id, companyId];

    const result = await pool.query(query, params);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouvé.' });
    }

    return res.json({ message: 'Collaborateur supprimé avec succès.' });
  } catch (err) {
    console.error('Erreur deleteUser:', err);
    return res.status(500).json({ error: 'Erreur lors de la suppression du collaborateur.' });
  }
}

module.exports = {
  getUsers,
  createUser,
  updateUser,
  deleteUser
};
