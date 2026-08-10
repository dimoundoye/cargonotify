const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const pool = new Pool(process.env.DATABASE_URL ? {
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  keepAlive: true
} : {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS,
  database: process.env.DB_NAME || 'cargoNotify',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  keepAlive: true
});

pool.on('error', (err) => {
  console.error('[DB Pool] Erreur de connexion PostgreSQL:', err.message);
});

module.exports = pool;
