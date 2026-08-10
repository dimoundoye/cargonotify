const pool = require('../config/db');

function getEffectiveCompanyId(req) {
  if (req.user && req.user.role === 'super_admin' && req.query.company_id) {
    return parseInt(req.query.company_id, 10);
  }
  return (req.user && req.user.company_id) ? req.user.company_id : 1;
}

async function getDashboardStats(req, res) {
  try {
    const companyId = getEffectiveCompanyId(req);
    const selectedYearStr = req.query.year;
    const targetYear = (selectedYearStr && selectedYearStr !== 'all' && !isNaN(parseInt(selectedYearStr, 10))) 
      ? parseInt(selectedYearStr, 10) 
      : null;

    // Détection dynamique des années comptables disponibles en BDD
    const availableYearsQuery = await pool.query(`
      SELECT DISTINCT year FROM (
        SELECT EXTRACT(YEAR FROM created_at)::int AS year FROM containers WHERE company_id = $1
        UNION
        SELECT EXTRACT(YEAR FROM created_at)::int AS year FROM lots WHERE company_id = $1
        UNION
        SELECT EXTRACT(YEAR FROM payment_date)::int AS year FROM payments WHERE company_id = $1
      ) y WHERE year IS NOT NULL ORDER BY year DESC
    `, [companyId]);

    const available_years = availableYearsQuery.rows.map(r => r.year);
    if (!available_years.includes(new Date().getFullYear())) {
      available_years.unshift(new Date().getFullYear());
    }

    // Total Chiffre d'affaires & Reste à recouvrer
    const revenueQuery = targetYear
      ? await pool.query(`
          SELECT 
            COALESCE(SUM(final_amount), 0) AS total_revenue,
            COALESCE(SUM(suggested_amount), 0) AS total_suggested_revenue,
            COUNT(id) AS total_lots
          FROM lots
          WHERE company_id = $1 AND EXTRACT(YEAR FROM created_at) = $2
        `, [companyId, targetYear])
      : await pool.query(`
          SELECT 
            COALESCE(SUM(final_amount), 0) AS total_revenue,
            COALESCE(SUM(suggested_amount), 0) AS total_suggested_revenue,
            COUNT(id) AS total_lots
          FROM lots
          WHERE company_id = $1
        `, [companyId]);

    const total_revenue = parseFloat(revenueQuery.rows[0].total_revenue);

    // Total Encaissements
    const paymentsQuery = targetYear
      ? await pool.query(`
          SELECT COALESCE(SUM(amount_paid), 0) AS total_collected 
          FROM payments 
          WHERE company_id = $1 AND EXTRACT(YEAR FROM payment_date) = $2
        `, [companyId, targetYear])
      : await pool.query(`
          SELECT COALESCE(SUM(amount_paid), 0) AS total_collected 
          FROM payments 
          WHERE company_id = $1
        `, [companyId]);

    const total_collected = parseFloat(paymentsQuery.rows[0].total_collected);
    const total_due = Math.max(0, total_revenue - total_collected);

    // Total Coûts Conteneurs (Fret, Douane, Transport)
    const costsQuery = targetYear
      ? await pool.query(`
          SELECT COALESCE(SUM(cc.amount), 0) AS total_costs 
          FROM container_costs cc
          JOIN containers c ON cc.container_id = c.id
          WHERE c.company_id = $1 AND (EXTRACT(YEAR FROM cc.created_at) = $2 OR EXTRACT(YEAR FROM c.created_at) = $2)
        `, [companyId, targetYear])
      : await pool.query(`
          SELECT COALESCE(SUM(cc.amount), 0) AS total_costs 
          FROM container_costs cc
          JOIN containers c ON cc.container_id = c.id
          WHERE c.company_id = $1
        `, [companyId]);

    // Dépenses globales d'exploitation (Salaires, Transports, Imprévus, etc.)
    const companyExpensesQuery = targetYear
      ? await pool.query(`
          SELECT COALESCE(SUM(amount), 0) AS total_expenses
          FROM expenses
          WHERE company_id = $1 AND EXTRACT(YEAR FROM expense_date) = $2
        `, [companyId, targetYear])
      : await pool.query(`
          SELECT COALESCE(SUM(amount), 0) AS total_expenses
          FROM expenses
          WHERE company_id = $1
        `, [companyId]);

    const total_container_costs = parseFloat(costsQuery.rows[0].total_costs);
    const total_company_expenses = parseFloat(companyExpensesQuery.rows[0].total_expenses);
    const total_costs = total_container_costs + total_company_expenses;
    const net_profit = total_revenue - total_costs;

    // Compte des Conteneurs par Statut
    const containerStatsQuery = targetYear
      ? await pool.query(`
          SELECT 
            COUNT(*) AS total_containers,
            COUNT(CASE WHEN status = 'in_transit' THEN 1 END) AS in_transit_count,
            COUNT(CASE WHEN status = 'arrived' THEN 1 END) AS arrived_count,
            COUNT(CASE WHEN status = 'closed' THEN 1 END) AS closed_count
          FROM containers
          WHERE company_id = $1 AND EXTRACT(YEAR FROM created_at) = $2
        `, [companyId, targetYear])
      : await pool.query(`
          SELECT 
            COUNT(*) AS total_containers,
            COUNT(CASE WHEN status = 'in_transit' THEN 1 END) AS in_transit_count,
            COUNT(CASE WHEN status = 'arrived' THEN 1 END) AS arrived_count,
            COUNT(CASE WHEN status = 'closed' THEN 1 END) AS closed_count
          FROM containers
          WHERE company_id = $1
        `, [companyId]);

    // Compte des Clients
    const clientCountQuery = await pool.query('SELECT COUNT(*) AS total_clients FROM clients WHERE company_id = $1', [companyId]);

    // Statistiques par conteneur pour le graphique de rentabilité
    const containerProfitabilityQuery = targetYear
      ? await pool.query(`
          SELECT 
            c.id,
            c.container_number,
            c.origin,
            c.status,
            COALESCE(SUM(DISTINCT cc_sum.total_cost), 0) AS container_costs,
            COALESCE(SUM(DISTINCT l_sum.total_revenue), 0) AS container_revenue,
            (COALESCE(SUM(DISTINCT l_sum.total_revenue), 0) - COALESCE(SUM(DISTINCT cc_sum.total_cost), 0)) AS net_profit
          FROM containers c
          LEFT JOIN (
            SELECT container_id, SUM(amount) AS total_cost FROM container_costs GROUP BY container_id
          ) cc_sum ON c.id = cc_sum.container_id
          LEFT JOIN (
            SELECT container_id, SUM(final_amount) AS total_revenue FROM lots WHERE company_id = $1 GROUP BY container_id
          ) l_sum ON c.id = l_sum.container_id
          WHERE c.company_id = $1 AND EXTRACT(YEAR FROM c.created_at) = $2
          GROUP BY c.id
          ORDER BY c.created_at DESC
          LIMIT 10
        `, [companyId, targetYear])
      : await pool.query(`
          SELECT 
            c.id,
            c.container_number,
            c.origin,
            c.status,
            COALESCE(SUM(DISTINCT cc_sum.total_cost), 0) AS container_costs,
            COALESCE(SUM(DISTINCT l_sum.total_revenue), 0) AS container_revenue,
            (COALESCE(SUM(DISTINCT l_sum.total_revenue), 0) - COALESCE(SUM(DISTINCT cc_sum.total_cost), 0)) AS net_profit
          FROM containers c
          LEFT JOIN (
            SELECT container_id, SUM(amount) AS total_cost FROM container_costs GROUP BY container_id
          ) cc_sum ON c.id = cc_sum.container_id
          LEFT JOIN (
            SELECT container_id, SUM(final_amount) AS total_revenue FROM lots WHERE company_id = $1 GROUP BY container_id
          ) l_sum ON c.id = l_sum.container_id
          WHERE c.company_id = $1
          GROUP BY c.id
          ORDER BY c.created_at DESC
          LIMIT 10
        `, [companyId]);

    // Conteneurs récents avec statut de retrait
    const recentContainersQuery = targetYear
      ? await pool.query(`
          SELECT 
            c.*,
            COUNT(DISTINCT l.id) AS lots_count,
            COUNT(DISTINCT l.client_id) AS clients_count,
            COALESCE(SUM(l.final_amount), 0) AS revenue
          FROM containers c
          LEFT JOIN lots l ON c.id = l.container_id
          WHERE c.company_id = $1 AND EXTRACT(YEAR FROM c.created_at) = $2
          GROUP BY c.id
          ORDER BY c.created_at DESC
          LIMIT 5
        `, [companyId, targetYear])
      : await pool.query(`
          SELECT 
            c.*,
            COUNT(DISTINCT l.id) AS lots_count,
            COUNT(DISTINCT l.client_id) AS clients_count,
            COALESCE(SUM(l.final_amount), 0) AS revenue
          FROM containers c
          LEFT JOIN lots l ON c.id = l.container_id
          WHERE c.company_id = $1
          GROUP BY c.id
          ORDER BY c.created_at DESC
          LIMIT 5
        `, [companyId]);

    return res.json({
      stats: {
        total_revenue,
        total_collected,
        total_due,
        total_costs,
        net_profit,
        total_clients: parseInt(clientCountQuery.rows[0].total_clients, 10),
        total_containers: parseInt(containerStatsQuery.rows[0].total_containers, 10),
        in_transit_count: parseInt(containerStatsQuery.rows[0].in_transit_count, 10),
        arrived_count: parseInt(containerStatsQuery.rows[0].arrived_count, 10),
        closed_count: parseInt(containerStatsQuery.rows[0].closed_count, 10)
      },
      container_profitability: containerProfitabilityQuery.rows,
      recent_containers: recentContainersQuery.rows,
      available_years,
      selected_year: targetYear ? String(targetYear) : 'all'
    });
  } catch (err) {
    console.error('Erreur getDashboardStats:', err);
    return res.status(500).json({ error: 'Erreur lors du chargement du tableau de bord.' });
  }
}

module.exports = { getDashboardStats };
