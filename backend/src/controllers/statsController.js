const pool = require('../config/db');

function getEffectiveCompanyId(req) {
  if (req.user && req.user.role === 'super_admin' && req.query.company_id) {
    return parseInt(req.query.company_id, 10);
  }
  return (req.user && req.user.company_id) ? req.user.company_id : 1;
}

async function getAdvancedStats(req, res) {
  try {
    const companyId = getEffectiveCompanyId(req);
    const selectedYearStr = req.query.year || 'all';
    const selectedMonthStr = req.query.month || 'all';

    const targetYear = (selectedYearStr !== 'all' && !isNaN(parseInt(selectedYearStr, 10))) 
      ? parseInt(selectedYearStr, 10) 
      : null;

    const targetMonth = (selectedMonthStr !== 'all' && !isNaN(parseInt(selectedMonthStr, 10)))
      ? parseInt(selectedMonthStr, 10)
      : null;

    // Détection des années disponibles
    const availableYearsQuery = await pool.query(`
      SELECT DISTINCT year FROM (
        SELECT EXTRACT(YEAR FROM created_at)::int AS year FROM containers WHERE company_id = $1
        UNION
        SELECT EXTRACT(YEAR FROM created_at)::int AS year FROM lots WHERE company_id = $1
        UNION
        SELECT EXTRACT(YEAR FROM payment_date)::int AS year FROM payments WHERE company_id = $1
        UNION
        SELECT EXTRACT(YEAR FROM created_at)::int AS year FROM clients WHERE company_id = $1
      ) y WHERE year IS NOT NULL ORDER BY year DESC
    `, [companyId]);

    const available_years = availableYearsQuery.rows.map(r => r.year);
    if (!available_years.includes(new Date().getFullYear())) {
      available_years.unshift(new Date().getFullYear());
    }

    // Conditions de date SQL pour les tables
    let yearFilterSql = '';
    let monthFilterSql = '';
    const params = [companyId];

    if (targetYear) {
      params.push(targetYear);
      yearFilterSql = ` AND EXTRACT(YEAR FROM created_at) = $${params.length}`;
    }

    if (targetMonth) {
      params.push(targetMonth);
      monthFilterSql = ` AND EXTRACT(MONTH FROM created_at) = $${params.length}`;
    }

    // 1. Clients Stats
    const totalClientsRes = await pool.query('SELECT COUNT(*) AS total FROM clients WHERE company_id = $1', [companyId]);
    const periodClientsRes = await pool.query(
      `SELECT COUNT(*) AS period_total FROM clients WHERE company_id = $1 ${yearFilterSql} ${monthFilterSql}`,
      params
    );

    // 2. Lots Stats
    const lotsRes = await pool.query(`
      SELECT 
        COUNT(*) AS total_lots,
        COALESCE(SUM(volume_cbm), 0) AS total_cbm,
        COALESCE(SUM(final_amount), 0) AS total_revenue,
        COUNT(CASE WHEN payment_status = 'paid' THEN 1 END) AS paid_count,
        COUNT(CASE WHEN payment_status != 'paid' THEN 1 END) AS unpaid_count,
        COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN final_amount ELSE 0 END), 0) AS paid_revenue,
        COALESCE(SUM(CASE WHEN payment_status != 'paid' THEN final_amount ELSE 0 END), 0) AS unpaid_revenue
      FROM lots
      WHERE company_id = $1 ${yearFilterSql} ${monthFilterSql}
    `, params);

    const lotStats = lotsRes.rows[0];

    // 3. Containers Stats
    const containersRes = await pool.query(`
      SELECT 
        COUNT(*) AS total_containers,
        COUNT(CASE WHEN status = 'in_transit' THEN 1 END) AS in_transit,
        COUNT(CASE WHEN status = 'arrived' THEN 1 END) AS arrived,
        COUNT(CASE WHEN status = 'closed' THEN 1 END) AS closed
      FROM containers
      WHERE company_id = $1 ${yearFilterSql} ${monthFilterSql}
    `, params);

    const containerStats = containersRes.rows[0];

    // 4. Payments & Receipts Stats
    let paymentParams = [companyId];
    let pYearSql = '';
    let pMonthSql = '';
    if (targetYear) {
      paymentParams.push(targetYear);
      pYearSql = ` AND EXTRACT(YEAR FROM payment_date) = $${paymentParams.length}`;
    }
    if (targetMonth) {
      paymentParams.push(targetMonth);
      pMonthSql = ` AND EXTRACT(MONTH FROM payment_date) = $${paymentParams.length}`;
    }

    const paymentsRes = await pool.query(`
      SELECT 
        COUNT(*) AS receipts_count,
        COALESCE(SUM(amount_paid), 0) AS total_collected
      FROM payments
      WHERE company_id = $1 ${pYearSql} ${pMonthSql}
    `, paymentParams);

    const paymentStats = paymentsRes.rows[0];

    // 5. WhatsApp Notifications Logs Stats
    let waParams = [companyId];
    let waYearSql = '';
    let waMonthSql = '';
    if (targetYear) {
      waParams.push(targetYear);
      waYearSql = ` AND EXTRACT(YEAR FROM sent_at) = $${waParams.length}`;
    }
    if (targetMonth) {
      waParams.push(targetMonth);
      waMonthSql = ` AND EXTRACT(MONTH FROM sent_at) = $${waParams.length}`;
    }

    const waRes = await pool.query(`
      SELECT COUNT(*) AS total_sent FROM whatsapp_logs WHERE company_id = $1 ${waYearSql} ${waMonthSql}
    `, waParams);

    const whatsapp_sent = parseInt(waRes.rows[0].total_sent, 10);

    // 6. Histogramme Mensuel sur 12 Mois (pour l'année sélectionnée ou l'année en cours)
    const chartYear = targetYear;
    const monthlyChartRes = await pool.query(`
      WITH months AS (
        SELECT generate_series(1, 12) AS month_num
      ),
      monthly_lots AS (
        SELECT 
          EXTRACT(MONTH FROM created_at)::int AS month_num,
          SUM(final_amount) AS revenue,
          SUM(volume_cbm) AS volume_cbm
        FROM lots
        WHERE company_id = $1 AND ($2::int IS NULL OR EXTRACT(YEAR FROM created_at) = $2)
        GROUP BY EXTRACT(MONTH FROM created_at)::int
      ),
      monthly_payments AS (
        SELECT 
          EXTRACT(MONTH FROM payment_date)::int AS month_num,
          SUM(amount_paid) AS collected
        FROM payments
        WHERE company_id = $1 AND ($2::int IS NULL OR EXTRACT(YEAR FROM payment_date) = $2)
        GROUP BY EXTRACT(MONTH FROM payment_date)::int
      )
      SELECT 
        m.month_num,
        COALESCE(l.revenue, 0) AS revenue,
        COALESCE(p.collected, 0) AS collected,
        COALESCE(l.volume_cbm, 0) AS volume_cbm
      FROM months m
      LEFT JOIN monthly_lots l ON m.month_num = l.month_num
      LEFT JOIN monthly_payments p ON m.month_num = p.month_num
      ORDER BY m.month_num ASC
    `, [companyId, chartYear]);

    const monthNames = [
      'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ];

    const monthly_chart = monthlyChartRes.rows.map(row => ({
      month_num: row.month_num,
      month_name: monthNames[row.month_num - 1],
      revenue: parseFloat(row.revenue),
      collected: parseFloat(row.collected),
      volume_cbm: parseFloat(row.volume_cbm)
    }));

    return res.json({
      available_years,
      selected_year: selectedYearStr,
      selected_month: selectedMonthStr,
      summary: {
        total_clients: parseInt(totalClientsRes.rows[0].total, 10),
        period_clients: parseInt(periodClientsRes.rows[0].period_total, 10),
        total_lots: parseInt(lotStats.total_lots, 10),
        total_cbm: parseFloat(lotStats.total_cbm),
        total_revenue: parseFloat(lotStats.total_revenue),
        paid_count: parseInt(lotStats.paid_count, 10),
        unpaid_count: parseInt(lotStats.unpaid_count, 10),
        paid_revenue: parseFloat(lotStats.paid_revenue),
        unpaid_revenue: parseFloat(lotStats.unpaid_revenue),
        receipts_count: parseInt(paymentStats.receipts_count, 10),
        total_collected: parseFloat(paymentStats.total_collected),
        total_due: Math.max(0, parseFloat(lotStats.total_revenue) - parseFloat(paymentStats.total_collected)),
        total_containers: parseInt(containerStats.total_containers, 10),
        in_transit_count: parseInt(containerStats.in_transit, 10),
        arrived_count: parseInt(containerStats.arrived, 10),
        closed_count: parseInt(containerStats.closed, 10),
        whatsapp_sent
      },
      monthly_chart
    });
  } catch (err) {
    console.error('Erreur getAdvancedStats:', err);
    return res.status(500).json({ error: 'Erreur lors du chargement des statistiques avancées.' });
  }
}

module.exports = { getAdvancedStats };
