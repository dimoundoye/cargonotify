const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');

async function initDatabase() {
  const client = await pool.connect();
  try {
    console.log('🔄 Connexion à PostgreSQL et initialisation du schéma...');
    
    const schemaPath = path.join(__dirname, 'schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');

    await client.query(sql);

    const companyName = process.env.COMPANY_NAME || 'CargoNotify Transit & Logistique';
    const companyPhone = process.env.COMPANY_PHONE || '+221 77 872 16 15';
    const companyEmail = process.env.COMPANY_EMAIL || 'contact@cargonotify.sn';
    const companyAddress = process.env.COMPANY_ADDRESS || 'Dakar, Sénégal';
    const companyCurrency = process.env.COMPANY_CURRENCY || 'FCFA';

    // Migration alter statements for existing tables if needed
    const alterQueries = [
      "CREATE TABLE IF NOT EXISTS companies (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, phone VARCHAR(100), email VARCHAR(255), address TEXT, currency VARCHAR(50) DEFAULT 'FCFA', is_active BOOLEAN DEFAULT TRUE, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP);",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) ON DELETE CASCADE DEFAULT 1;",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS allowed_tabs JSONB DEFAULT NULL;",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;",
      "ALTER TABLE containers ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) ON DELETE CASCADE DEFAULT 1;",
      "ALTER TABLE clients ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) ON DELETE CASCADE DEFAULT 1;",
      "ALTER TABLE lots ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) ON DELETE CASCADE DEFAULT 1;",
      "ALTER TABLE payments ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) ON DELETE CASCADE DEFAULT 1;",
      "ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) ON DELETE CASCADE DEFAULT 1;",
      "ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS city VARCHAR(100) DEFAULT 'Dakar';",
      "ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS phone VARCHAR(100);",
      "ALTER TABLE pricing_services ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) ON DELETE CASCADE DEFAULT 1;",
      "ALTER TABLE pricing_services DROP CONSTRAINT IF EXISTS pricing_services_code_key;",
      "ALTER TABLE pricing_services DROP CONSTRAINT IF EXISTS pricing_services_company_id_code_key;",
      "ALTER TABLE pricing_services ADD CONSTRAINT pricing_services_company_id_code_key UNIQUE (company_id, code);",
      "ALTER TABLE whatsapp_logs ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) ON DELETE CASCADE DEFAULT 1;",
      "ALTER TABLE containers ADD COLUMN IF NOT EXISTS bl_number VARCHAR(100);",
      "ALTER TABLE containers ADD COLUMN IF NOT EXISTS shipping_line VARCHAR(100);",
      "ALTER TABLE containers ADD COLUMN IF NOT EXISTS agent_name VARCHAR(255);",
      "ALTER TABLE lots ADD COLUMN IF NOT EXISTS cbm_rate NUMERIC(15, 2) DEFAULT 150000;",
      "ALTER TABLE lots ADD COLUMN IF NOT EXISTS cbm_amount NUMERIC(15, 2) DEFAULT 0;",
      "ALTER TABLE lots ADD COLUMN IF NOT EXISTS bale_qty INT DEFAULT 0;",
      "ALTER TABLE lots ADD COLUMN IF NOT EXISTS bale_amount NUMERIC(15, 2) DEFAULT 0;",
      "ALTER TABLE lots ADD COLUMN IF NOT EXISTS copy_qty NUMERIC(10, 2) DEFAULT 0;",
      "ALTER TABLE lots ADD COLUMN IF NOT EXISTS copy_amount NUMERIC(15, 2) DEFAULT 0;",
      "ALTER TABLE lots ADD COLUMN IF NOT EXISTS small_packing_qty INT DEFAULT 0;",
      "ALTER TABLE lots ADD COLUMN IF NOT EXISTS small_packing_amount NUMERIC(15, 2) DEFAULT 0;",
      "ALTER TABLE lots ADD COLUMN IF NOT EXISTS exit_date VARCHAR(100);",
      "CREATE TABLE IF NOT EXISTS expenses (id SERIAL PRIMARY KEY, company_id INT REFERENCES companies(id) ON DELETE CASCADE DEFAULT 1, container_id INT REFERENCES containers(id) ON DELETE SET NULL, category VARCHAR(100) NOT NULL DEFAULT 'other', title VARCHAR(255) NOT NULL, amount NUMERIC(15, 2) NOT NULL DEFAULT 0, expense_date DATE DEFAULT CURRENT_DATE, notes TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP);",
      "CREATE TABLE IF NOT EXISTS audit_logs (id SERIAL PRIMARY KEY, company_id INT REFERENCES companies(id) ON DELETE CASCADE DEFAULT 1, user_id INT REFERENCES users(id) ON DELETE SET NULL, user_name VARCHAR(255), user_email VARCHAR(255), action VARCHAR(100) NOT NULL, action_type VARCHAR(50) DEFAULT 'info', entity_type VARCHAR(100), entity_id INT, description TEXT NOT NULL, metadata JSONB DEFAULT NULL, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP);",
      "ALTER TABLE container_costs ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) ON DELETE CASCADE DEFAULT 1;"
    ];

    for (const q of alterQueries) {
      await client.query(q);
    }

    await client.query(`
      INSERT INTO companies (id, name, phone, email, address, currency) 
      VALUES (1, $1, $2, $3, $4, $5) 
      ON CONFLICT (id) DO NOTHING;
    `, [companyName, companyPhone, companyEmail, companyAddress, companyCurrency]);

    console.log('✅ Tables et colonnes créées / mises à jour avec succès.');



    // Seed Service Pricing
    const pricingCheck = await client.query('SELECT COUNT(*) FROM pricing_services');
    if (parseInt(pricingCheck.rows[0].count, 10) === 0) {
      await client.query(`
        INSERT INTO pricing_services (code, name, default_rate, unit_type, description) VALUES
        ('CBM_BASE', 'Tarif de base au CBM', 150000.00, 'per_cbm', 'Prix au mètre cube (CBM) standard'),
        ('BALE', 'Service Balle', 10000.00, 'per_unit', 'Frais par balle ou unité'),
        ('COPY', 'Frais de Copie / Doc', 6000.00, 'per_cbm', 'Frais de dossier par CBM'),
        ('SAC', 'Frais par Sac', 10000.00, 'per_unit', 'Frais par sac individuel'),
        ('HEAVY_GOODS', 'Marchandises Lourdes', 15000.00, 'per_cbm', 'Supplément marchandises lourdes par CBM');
      `);
      console.log('✅ Barèmes de tarification par défaut ajoutés.');
    }

    // Seed Super Admin User (Seul compte système par défaut)
    const superAdminCheck = await client.query("SELECT * FROM users WHERE email = 'superadmin@cargonotify.sn'");
    if (superAdminCheck.rows.length === 0) {
      const superPass = process.env.DB_PASS || 'Passer@2026#';
      const passwordHash = await bcrypt.hash(superPass, 10);
      await client.query(`
        INSERT INTO users (name, email, password_hash, role, company_id) VALUES
        ('Super Administrateur Application', 'superadmin@cargonotify.sn', $1, 'super_admin', NULL);
      `, [passwordHash]);
      console.log('✅ Compte Super Administrateur (superadmin@cargonotify.sn) créé.');
    }

    // Supprimer définitivement l'ancien compte démo 'admin@cargonotify.sn'
    await client.query("DELETE FROM users WHERE email = 'admin@cargonotify.sn';");

    // Synchroniser les séquences auto-increment
    await client.query("SELECT setval(pg_get_serial_sequence('companies', 'id'), COALESCE(MAX(id), 1)) FROM companies;");
    await client.query("SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE(MAX(id), 1)) FROM users;");

    console.log('🎉 Initialisation de la base de données terminée avec succès !');
  } catch (err) {
    console.error('❌ Erreur lors de l\'initialisation de la base de données:', err);
  } finally {
    client.release();
    process.exit(0);
  }
}

initDatabase();
