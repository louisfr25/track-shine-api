import jwt from 'jsonwebtoken';
import { db } from '../connect.js';

// Verify JWT and attach user information (id + role) to req.user
export const authMiddleware = async (req, res, next) => {
  try {
    // Accept cookie or Authorization header
    const token = req.cookies?.access_token || req.header('Authorization')?.replace?.('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: "Accès refusé. Token d'authentification requis." });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded?.id;
    if (!userId) return res.status(401).json({ error: 'Token invalide' });

    // Load minimal user info from DB so downstream middleware/controllers can use role
    try {
      const [rows] = await db.query('SELECT id, role, firstName, lastName, email FROM users WHERE id = ?', [userId]);
      const userRow = rows && rows[0];
      if (!userRow || !userRow.id) {
        return res.status(401).json({ error: 'Utilisateur introuvable' });
      }
      req.user = {
        id: userRow.id,
        role: userRow.role || 'default',
        isAdmin: (userRow.role === 'admin'),
        firstName: userRow.firstName,
        lastName: userRow.lastName,
        email: userRow.email
      };
      next();
    } catch (dbErr) {
      console.error('authMiddleware DB error', dbErr);
      return res.status(500).json({ error: 'Erreur serveur lors de la vérification de l\'utilisateur' });
    }
  } catch (error) {
    console.error('authMiddleware verify error', error?.message ?? error);
    return res.status(401).json({ error: 'Token invalide.' });
  }
};

export const adminMiddleware = (req, res, next) => {
  // req.user.role is populated by authMiddleware
  if (req.user && (req.user.role === 'admin' || req.user.isAdmin === true)) {
    return next();
  }
  return res.status(403).json({ error: 'Accès refusé. Privilèges administrateur requis.' });
};
