const pool = require('../config/db');

async function purgeCompaniesTable() {
  try {
    await pool.query('ALTER TABLE users ALTER COLUMN company_id DROP NOT NULL;');
    await pool.query("UPDATE users SET company_id = NULL WHERE role = 'super_admin';");
    await pool.query('TRUNCATE TABLE companies RESTART IDENTITY CASCADE;');
    await pool.query("SELECT setval(pg_get_serial_sequence('companies', 'id'), 1, false);");
    
    const resComp = await pool.query('SELECT COUNT(*) FROM companies');
    const resUser = await pool.query('SELECT COUNT(*) FROM users');
    
    console.log('✅ Table companies purgée à 100% (0 ligne) !');
    console.log('Nombre de sociétés (companies):', resComp.rows[0].count);
    console.log('Nombre d’utilisateurs (Super Admin):', resUser.rows[0].count);
  } catch (err) {
    console.error('❌ Erreur purge companies:', err);
  } finally {
    process.exit(0);
  }
}

purgeCompaniesTable();
