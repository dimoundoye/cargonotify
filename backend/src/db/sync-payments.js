const pool = require('../config/db');

async function syncPayments() {
  const client = await pool.connect();
  try {
    console.log('🔄 Synchronisation des règlements pour les lots marqués payés...');

    const lots = await client.query(`
      SELECT l.*, COALESCE(p.total_paid, 0) AS current_paid
      FROM lots l
      LEFT JOIN (
        SELECT lot_id, SUM(amount_paid) AS total_paid
        FROM payments
        GROUP BY lot_id
      ) p ON l.id = p.lot_id
      WHERE l.payment_status = 'paid'
    `);

    let syncCount = 0;
    let totalAdded = 0;

    for (const lot of lots.rows) {
      const finalAmount = parseFloat(lot.final_amount);
      const currentPaid = parseFloat(lot.current_paid);
      const remaining = finalAmount - currentPaid;

      if (remaining > 0) {
        const receiptNumber = `REC-IMPORT-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;
        await client.query(`
          INSERT INTO payments (company_id, lot_id, client_id, amount_paid, payment_method, receipt_number, notes)
          VALUES ($1, $2, $3, $4, 'cash', $5, 'Règlement solde importé (Excel)')
        `, [
          lot.company_id || 1,
          lot.id,
          lot.client_id,
          remaining,
          receiptNumber
        ]);
        syncCount++;
        totalAdded += remaining;
      }
    }

    console.log(`✅ ${syncCount} règlement(s) synchronisé(s) pour un total de ${totalAdded.toLocaleString('fr-FR')} FCFA.`);
  } catch (err) {
    console.error('❌ Erreur syncPayments:', err);
  } finally {
    client.release();
    process.exit(0);
  }
}

syncPayments();
