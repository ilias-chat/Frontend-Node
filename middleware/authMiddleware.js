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
      const msg = err?.message || String(err);
      console.error('Firebase verifyIdToken failed:', code || msg);
      const payload = { error: 'Invalid or expired token' };
      const devHints =
        process.env.NODE_ENV === 'development' || process.env.AUTH_VERBOSE === '1';
      if (devHints) {
        if (code) payload.code = code;
        if (/Could not load|default credentials|application default credentials/i.test(msg)) {
          payload.hint =
            'Add FIREBASE_SERVICE_ACCOUNT_JSON to .env (Firebase Console → Project settings → Service accounts → Generate new private key, full JSON on one line).';
        } else if (code === 'auth/argument-error' || code === 'auth/invalid-id-token') {
          payload.hint =
            'Use a Firebase ID token from your app after sign-in (user.getIdToken()). In Swagger Authorize, paste only the JWT (no "Bearer " prefix). Project must match service account project_id.';
        } else if (code === 'auth/id-token-expired') {
          payload.hint = 'Token expired; sign in again and copy a fresh ID token.';
        } else if (code === 'auth/project-not-found') {
          payload.hint =
            'Service account project_id does not match the Firebase project that issued the token. Regenerate the key from the correct Firebase project.';
        }
      }
      return res.status(401).json(payload);
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
