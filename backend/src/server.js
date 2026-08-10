const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const apiRoutes = require('./routes/api');
const pool = require('./config/db');

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check
app.get('/health', async (req, res) => {
  try {
    const dbResult = await pool.query('SELECT NOW()');
    return res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: 'connected',
      db_time: dbResult.rows[0].now
    });
  } catch (err) {
    return res.status(500).json({
      status: 'error',
      database: 'disconnected',
      error: err.message
    });
  }
});

// API Routes
app.use('/api', apiRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('🔥 Erreur Global Server:', err.stack);
  res.status(500).json({ error: 'Erreur interne du serveur.' });
});

app.listen(PORT, () => {
  console.log(`🚀 Serveur CargoNotify lancé sur http://localhost:${PORT}`);
});
