const pool = require('../config/db');
const { logAudit } = require('../utils/auditLogger');

function getEffectiveCompanyId(req) {
  if (req.user && req.user.role === 'super_admin' && req.query.company_id) {
    return parseInt(req.query.company_id, 10);
  }
  return (req.user && req.user.company_id) ? req.user.company_id : 1;
}

// Obtenir toutes les dépenses avec filtres (catégorie, conteneur, mois, année)
async function getExpenses(req, res) {
  try {
    const companyId = getEffectiveCompanyId(req);
    const { category, container_id, year, month } = req.query;

    let query = `
      SELECT 
        e.*,
        c.container_number,
        c.origin AS container_origin
      FROM expenses e
      LEFT JOIN containers c ON e.container_id = c.id
      WHERE e.company_id = $1
    `;
    const params = [companyId];

    if (category && category !== 'all') {
      params.push(category);
      query += ` AND e.category = $${params.length}`;
    }

    if (container_id && container_id !== 'all') {
      params.push(parseInt(container_id, 10));
      query += ` AND e.container_id = $${params.length}`;
    }

    if (year && year !== 'all' && !isNaN(parseInt(year, 10))) {
      params.push(parseInt(year, 10));
      query += ` AND EXTRACT(YEAR FROM e.expense_date) = $${params.length}`;
    }

    if (month && month !== 'all' && !isNaN(parseInt(month, 10))) {
      params.push(parseInt(month, 10));
      query += ` AND EXTRACT(MONTH FROM e.expense_date) = $${params.length}`;
    }

    query += ` ORDER BY e.expense_date DESC, e.created_at DESC`;

    const result = await pool.query(query, params);
    const expenses = result.rows;

    // Calcul des totaux récapitulatifs par catégorie
    let total_expenses = 0;
    let salary_total = 0;
    let transport_total = 0;
    let handling_total = 0;
    let container_expenses_total = 0;
    let rent_total = 0;
    let other_total = 0;

    for (const exp of expenses) {
      const amt = parseFloat(exp.amount) || 0;
      total_expenses += amt;

      if (exp.category === 'salary') salary_total += amt;
      else if (exp.category === 'transport') transport_total += amt;
      else if (exp.category === 'handling') handling_total += amt;
      else if (exp.category === 'container') container_expenses_total += amt;
      else if (exp.category === 'rent') rent_total += amt;
      else other_total += amt;
    }

    return res.json({
      expenses,
      summary: {
        total_expenses,
        salary_total,
        transport_total,
        handling_total,
        container_expenses_total,
        rent_total,
        other_total
      }
    });
  } catch (err) {
    console.error('Erreur getExpenses:', err);
    return res.status(500).json({ error: 'Erreur lors de la récupération des dépenses.' });
  }
}

// Enregistrer une nouvelle dépense
async function createExpense(req, res) {
  try {
    const companyId = getEffectiveCompanyId(req);
    const { title, category, amount, container_id, expense_date, notes } = req.body;

    if (!title || !amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Veuillez préciser un libellé et un montant valide.' });
    }

    const validCategory = ['salary', 'transport', 'handling', 'container', 'rent', 'other'].includes(category) 
      ? category 
      : 'other';

    const dateVal = expense_date ? expense_date : new Date().toISOString().split('T')[0];

    const result = await pool.query(`
      INSERT INTO expenses (company_id, container_id, category, title, amount, expense_date, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      companyId,
      container_id ? parseInt(container_id, 10) : null,
      validCategory,
      title.trim(),
      parseFloat(amount),
      dateVal,
      notes ? notes.trim() : null
    ]);

    const exp = result.rows[0];

    let containerInfo = '';
    if (exp.container_id) {
      try {
        const cRes = await pool.query('SELECT container_number, origin FROM containers WHERE id = $1', [exp.container_id]);
        if (cRes.rows.length > 0) containerInfo = ` (Conteneur ${cRes.rows[0].container_number})`;
      } catch (e) {}
    }

    const formattedAmount = new Intl.NumberFormat('fr-FR').format(parseFloat(exp.amount)) + ' FCFA';

    logAudit(req, {
      action: 'CREATE_EXPENSE',
      action_type: 'create',
      entity_type: 'expense',
      entity_id: exp.id,
      description: `Saisie de la dépense "${exp.title}" (${formattedAmount})${containerInfo}`
    });

    return res.status(201).json({ expense: exp });
  } catch (err) {
    console.error('Erreur createExpense:', err);
    return res.status(500).json({ error: 'Erreur lors de l\'enregistrement de la dépense.' });
  }
}

// Modifier une dépense existante
async function updateExpense(req, res) {
  try {
    const { id } = req.params;
    const companyId = getEffectiveCompanyId(req);
    const { title, category, amount, container_id, expense_date, notes } = req.body;

    const checkQuery = await pool.query('SELECT id FROM expenses WHERE id = $1 AND company_id = $2', [id, companyId]);
    if (checkQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Dépense introuvable.' });
    }

    const validCategory = ['salary', 'transport', 'handling', 'container', 'rent', 'other'].includes(category) 
      ? category 
      : 'other';

    const result = await pool.query(`
      UPDATE expenses
      SET title = COALESCE($1, title),
          category = COALESCE($2, category),
          amount = COALESCE($3, amount),
          container_id = $4,
          expense_date = COALESCE($5, expense_date),
          notes = $6
      WHERE id = $7 AND company_id = $8
      RETURNING *
    `, [
      title ? title.trim() : null,
      validCategory,
      amount ? parseFloat(amount) : null,
      container_id ? parseInt(container_id, 10) : null,
      expense_date || null,
      notes !== undefined ? (notes ? notes.trim() : null) : null,
      id,
      companyId
    ]);

    return res.json({ expense: result.rows[0] });
  } catch (err) {
    console.error('Erreur updateExpense:', err);
    return res.status(500).json({ error: 'Erreur lors de la modification de la dépense.' });
  }
}

// Supprimer une dépense
async function deleteExpense(req, res) {
  try {
    const { id } = req.params;
    const companyId = getEffectiveCompanyId(req);

    const result = await pool.query('DELETE FROM expenses WHERE id = $1 AND company_id = $2 RETURNING *', [id, companyId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dépense introuvable.' });
    }

    return res.json({ message: 'Dépense supprimée avec succès.' });
  } catch (err) {
    console.error('Erreur deleteExpense:', err);
    return res.status(500).json({ error: 'Erreur lors de la suppression de la dépense.' });
  }
}

module.exports = {
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense
};
