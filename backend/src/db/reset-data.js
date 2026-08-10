const pool = require('../config/db');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

async function resetAllApplicationData() {
  const client = await pool.connect();
  try {
    console.log('🔄 Nettoyage total et absolu de toutes les tables de la base de données...');
    await client.query('BEGIN');

    // Assurer que company_id peut être NULL pour le Super Admin (Gestionnaire SaaS)
    await client.query('ALTER TABLE users ALTER COLUMN company_id DROP NOT NULL;');

    // 1. Purger absolument toutes les tables y compris companies
    await client.query(`
      TRUNCATE TABLE 
        payments, 
        lot_service_items, 
        lots, 
        container_costs, 
        containers, 
        clients, 
        whatsapp_logs,
        warehouses,
        pricing_services,
        companies
      RESTART IDENTITY CASCADE;
    `);
    console.log('🧹 Purge 100% complète de toutes les tables métier et sociétés.');

    // 2. Créer l'unique compte Super Admin de la plateforme (sans entreprise rattachée, company_id = NULL)
    const defaultPass = process.env.DB_PASS || 'Passer@2026#';
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(defaultPass, salt);

    await client.query(`
      INSERT INTO users (id, company_id, name, email, password_hash, role, is_active)
      VALUES (1, NULL, 'Super Administrateur Application', 'superadmin@cargonotify.sn', $1, 'super_admin', TRUE)
      ON CONFLICT (email) DO UPDATE 
      SET company_id = NULL, password_hash = $1, role = 'super_admin', is_active = TRUE;
    `, [passwordHash]);

    // 3. Réinitialiser et resynchroniser au millimètre toutes les séquences auto-incrément PostgreSQL
    await client.query("SELECT setval(pg_get_serial_sequence('companies', 'id'), 1, false);");
    await client.query("SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE((SELECT MAX(id) FROM users), 1));");
    await client.query("SELECT setval(pg_get_serial_sequence('containers', 'id'), 1, false);");
    await client.query("SELECT setval(pg_get_serial_sequence('lots', 'id'), 1, false);");
    await client.query("SELECT setval(pg_get_serial_sequence('clients', 'id'), 1, false);");
    await client.query("SELECT setval(pg_get_serial_sequence('payments', 'id'), 1, false);");
    await client.query("SELECT setval(pg_get_serial_sequence('warehouses', 'id'), 1, false);");
    await client.query("SELECT setval(pg_get_serial_sequence('pricing_services', 'id'), 1, false);");
    await client.query("SELECT setval(pg_get_serial_sequence('whatsapp_logs', 'id'), 1, false);");

    await client.query('COMMIT');
    console.log('👑 Seul le compte Super Admin de la plateforme a été conservé (company_id = NULL).');

    // 4. Purger physiquement les dossiers de sessions WhatsApp
    const sessionsDir = path.join(__dirname, '../../whatsapp_sessions');
    if (fs.existsSync(sessionsDir)) {
      fs.rmSync(sessionsDir, { recursive: true, force: true });
    }
    const legacySessionDir = path.join(__dirname, '../../whatsapp_session');
    if (fs.existsSync(legacySessionDir)) {
      fs.rmSync(legacySessionDir, { recursive: true, force: true });
    }
    console.log('📱 Sessions WhatsApp totalement réinitialisées.');

    console.log('🎉 TOUTES LES TABLES SONT PURGÉES ! (companies = 0 ligne)');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Erreur lors du nettoyage total:', err);
  } finally {
    client.release();
    process.exit(0);
  }
}

resetAllApplicationData();
