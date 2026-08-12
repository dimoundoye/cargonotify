-- ─────────────────────────────────────────────────────────────────────
-- CargoNotify — Schéma de base de données (Multi-Tenant)
-- Exécuté automatiquement par PostgreSQL au premier démarrage du volume
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS companies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(100),
    email VARCHAR(255),
    address TEXT,
    currency VARCHAR(50) DEFAULT 'FCFA',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS warehouses (
    id SERIAL PRIMARY KEY,
    company_id INT REFERENCES companies(id) ON DELETE CASCADE DEFAULT 1,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    city VARCHAR(100) DEFAULT 'Dakar',
    phone VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    company_id INT REFERENCES companies(id) ON DELETE CASCADE DEFAULT 1,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'admin',
    warehouse_id INT REFERENCES warehouses(id) ON DELETE SET NULL,
    allowed_tabs JSONB DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS containers (
    id SERIAL PRIMARY KEY,
    company_id INT REFERENCES companies(id) ON DELETE CASCADE DEFAULT 1,
    container_number VARCHAR(100) UNIQUE NOT NULL,
    bl_number VARCHAR(100),
    shipping_line VARCHAR(100),
    agent_name VARCHAR(255),
    origin VARCHAR(255) NOT NULL,
    loading_date DATE,
    expected_arrival DATE,
    actual_arrival DATE,
    status VARCHAR(50) DEFAULT 'in_transit',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS container_costs (
    id SERIAL PRIMARY KEY,
    company_id INT REFERENCES companies(id) ON DELETE CASCADE DEFAULT 1,
    container_id INT NOT NULL REFERENCES containers(id) ON DELETE CASCADE,
    category VARCHAR(100) NOT NULL,
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS clients (
    id SERIAL PRIMARY KEY,
    company_id INT REFERENCES companies(id) ON DELETE CASCADE DEFAULT 1,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    address TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pricing_services (
    id SERIAL PRIMARY KEY,
    company_id INT REFERENCES companies(id) ON DELETE CASCADE DEFAULT 1,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    default_rate NUMERIC(15, 2) NOT NULL DEFAULT 0,
    unit_type VARCHAR(50) NOT NULL DEFAULT 'per_cbm',
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pricing_services_company_id_code_key UNIQUE (company_id, code)
);

CREATE TABLE IF NOT EXISTS lots (
    id SERIAL PRIMARY KEY,
    company_id INT REFERENCES companies(id) ON DELETE CASCADE DEFAULT 1,
    container_id INT NOT NULL REFERENCES containers(id) ON DELETE CASCADE,
    client_id INT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    warehouse_id INT REFERENCES warehouses(id) ON DELETE SET NULL,
    product_description TEXT NOT NULL,
    quantity INT DEFAULT 1,
    weight_kg NUMERIC(10, 2) DEFAULT 0,
    volume_cbm NUMERIC(10, 3) DEFAULT 0,
    cbm_rate NUMERIC(15, 2) DEFAULT 150000,
    cbm_amount NUMERIC(15, 2) DEFAULT 0,
    bale_qty INT DEFAULT 0,
    bale_amount NUMERIC(15, 2) DEFAULT 0,
    copy_qty NUMERIC(10, 2) DEFAULT 0,
    copy_amount NUMERIC(15, 2) DEFAULT 0,
    small_packing_qty INT DEFAULT 0,
    small_packing_amount NUMERIC(15, 2) DEFAULT 0,
    suggested_amount NUMERIC(15, 2) DEFAULT 0,
    final_amount NUMERIC(15, 2) DEFAULT 0,
    payment_status VARCHAR(50) DEFAULT 'unpaid',
    pickup_status VARCHAR(50) DEFAULT 'pending',
    pickup_date DATE,
    exit_date VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lot_service_items (
    id SERIAL PRIMARY KEY,
    lot_id INT NOT NULL REFERENCES lots(id) ON DELETE CASCADE,
    service_id INT REFERENCES pricing_services(id) ON DELETE SET NULL,
    service_name VARCHAR(255) NOT NULL,
    quantity NUMERIC(10, 2) NOT NULL DEFAULT 1,
    rate NUMERIC(15, 2) NOT NULL DEFAULT 0,
    line_total NUMERIC(15, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    company_id INT REFERENCES companies(id) ON DELETE CASCADE DEFAULT 1,
    lot_id INT NOT NULL REFERENCES lots(id) ON DELETE CASCADE,
    client_id INT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    amount_paid NUMERIC(15, 2) NOT NULL DEFAULT 0,
    payment_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    payment_method VARCHAR(50) DEFAULT 'cash',
    receipt_number VARCHAR(100) UNIQUE NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS whatsapp_logs (
    id SERIAL PRIMARY KEY,
    company_id INT REFERENCES companies(id) ON DELETE CASCADE DEFAULT 1,
    client_id INT REFERENCES clients(id) ON DELETE CASCADE,
    container_id INT REFERENCES containers(id) ON DELETE CASCADE,
    phone VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'sent',
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS expenses (
    id SERIAL PRIMARY KEY,
    company_id INT REFERENCES companies(id) ON DELETE CASCADE DEFAULT 1,
    container_id INT REFERENCES containers(id) ON DELETE SET NULL,
    category VARCHAR(100) NOT NULL DEFAULT 'other',
    title VARCHAR(255) NOT NULL,
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    expense_date DATE DEFAULT CURRENT_DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    company_id INT REFERENCES companies(id) ON DELETE CASCADE DEFAULT 1,
    user_id INT REFERENCES users(id) ON DELETE SET NULL,
    user_name VARCHAR(255),
    user_email VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    action_type VARCHAR(50) DEFAULT 'info',
    entity_type VARCHAR(100),
    entity_id INT,
    description TEXT NOT NULL,
    metadata JSONB DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
