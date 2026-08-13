-- ─────────────────────────────────────────────────────────────────────
-- CargoNotify — Données initiales (seed)
-- Exécuté automatiquement après 01-schema.sql au premier démarrage
-- ─────────────────────────────────────────────────────────────────────

-- Company par défaut (ID=1 requis par les FK du schéma)
INSERT INTO companies (id, name, phone, email, address, currency)
VALUES (
    1,
    'CargoNotify Transit & Logistique',
    '+221',
    'contact@cargonotify.com',
    'Dakar, Sénégal',
    'FCFA'
)
ON CONFLICT (id) DO NOTHING;

-- Synchronisation de la séquence après l'INSERT manuel avec id=1
SELECT setval(pg_get_serial_sequence('companies', 'id'), COALESCE(MAX(id), 1)) FROM companies;

-- Barèmes de tarification par défaut
INSERT INTO pricing_services (company_id, code, name, default_rate, unit_type, description)
VALUES
    (1, 'CBM_BASE',    'Tarif de base au CBM',      150000.00, 'per_cbm',  'Prix au mètre cube (CBM) standard'),
    (1, 'BALE',        'Service Balle',               10000.00, 'per_unit', 'Frais par balle ou unité'),
    (1, 'COPY',        'Frais de Copie / Doc',         6000.00, 'per_cbm',  'Frais de dossier par CBM'),
    (1, 'SAC',         'Frais par Sac',               10000.00, 'per_unit', 'Frais par sac individuel'),
    (1, 'HEAVY_GOODS', 'Marchandises Lourdes',        15000.00, 'per_cbm',  'Supplément marchandises lourdes par CBM')
ON CONFLICT (company_id, code) DO NOTHING;

-- Note : le compte Super Administrateur est créé via :
--   docker compose exec backend node src/db/init-db.js
-- (nécessite bcryptjs pour hasher le mot de passe)
