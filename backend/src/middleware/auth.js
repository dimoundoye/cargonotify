const jwt = require('jsonwebtoken');

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.split(' ')[1];
  if (!token && req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Accès non autorisé. Token manquant.' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'cargo_notify_super_secret_key_2026_senegal_fret', (err, user) => {
    if (err) {
      return res.status(401).json({ error: 'Token invalide ou expiré.' });
    }
    req.user = user;
    next();
  });
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(403).json({ error: 'Permissions insuffisantes pour cette action.' });
    }

    const userRole = req.user.role;

    // Le compte super_admin a tous les droits d'accès
    if (userRole === 'super_admin') {
      return next();
    }

    const allowedRoles = roles.flat();
    if (allowedRoles.includes(userRole)) {
      return next();
    }

    return res.status(403).json({ error: 'Permissions insuffisantes pour cette action.' });
  };
}

module.exports = { authenticateToken, requireRole };

