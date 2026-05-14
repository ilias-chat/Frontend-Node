const User = require('../models/User');
const { verifyIdToken: defaultVerifyIdToken } = require('../config/firebase');

/**
 * @param {{ verifyIdToken?: (token: string) => Promise<{ uid: string, email?: string }> }} [options]
 */
function createAuthMiddleware(options = {}) {
  const verifyIdToken = options.verifyIdToken || defaultVerifyIdToken;

  async function verifyFirebaseToken(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }
    let idToken = header.slice(7).trim();
    // Swagger UI already sends "Bearer "; users often paste "Bearer eyJ..." and end up with "Bearer Bearer eyJ...".
    if (idToken.startsWith('Bearer ')) {
      idToken = idToken.slice(7).trim();
    }
    if (!idToken) {
      return res.status(401).json({ error: 'Missing token' });
    }
    try {
      req.firebase = await verifyIdToken(idToken);
      next();
    } catch (err) {
      const code = err?.code || err?.errorInfo?.code;
      console.error('Firebase verifyIdToken failed:', code || err?.message || err);
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  }

  async function loadMongoUser(req, res, next) {
    try {
      const user = await User.findOne({ firebaseUID: req.firebase.uid });
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      req.mongoUser = user;
      next();
    } catch (err) {
      next(err);
    }
  }

  function requireAdmin(req, res, next) {
    if (!req.mongoUser || req.mongoUser.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  }

  return { verifyFirebaseToken, loadMongoUser, requireAdmin };
}

module.exports = { createAuthMiddleware };
