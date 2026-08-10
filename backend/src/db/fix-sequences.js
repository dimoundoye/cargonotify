const pool = require('../config/db');

async function fixSequences() {
  try {
    await pool.query("SELECT setval(pg_get_serial_sequence('companies', 'id'), COALESCE(MAX(id), 1)) FROM companies;");
    await pool.query("SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE(MAX(id), 1)) FROM users;");
    await pool.query("SELECT setval(pg_get_serial_sequence('containers', 'id'), COALESCE(MAX(id), 1)) FROM containers;");
    await pool.query("SELECT setval(pg_get_serial_sequence('clients', 'id'), COALESCE(MAX(id), 1)) FROM clients;");
    await pool.query("SELECT setval(pg_get_serial_sequence('lots', 'id'), COALESCE(MAX(id), 1)) FROM lots;");
    await pool.query("SELECT setval(pg_get_serial_sequence('payments', 'id'), COALESCE(MAX(id), 1)) FROM payments;");
    console.log('✅ Toutes les séquences d’auto-incrément PostgreSQL ont été synchronisées avec succès !');
  } catch (err) {
    console.error('❌ Erreur resync sequences:', err);
  } finally {
    process.exit(0);
  }
}

fixSequences();
