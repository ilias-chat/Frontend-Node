const admin = require('firebase-admin');

function initializeFirebaseAdmin() {
  if (admin.apps.length > 0) {
    return admin.app();
  }

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (raw && String(raw).trim()) {
    let cred;
    try {
      cred = JSON.parse(String(raw).trim());
    } catch (e) {
      console.error('FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON:', e.message);
      throw e;
    }
    if (!cred.project_id) {
      console.error('FIREBASE_SERVICE_ACCOUNT_JSON is missing project_id');
    }
    return admin.initializeApp({
      credential: admin.credential.cert(cred),
      projectId: cred.project_id,
    });
  }

  return admin.initializeApp();
}

/**
 * @param {string} idToken
 * @returns {Promise<import('firebase-admin').auth.DecodedIdToken>}
 */
async function verifyIdToken(idToken) {
  initializeFirebaseAdmin();
  return admin.auth().verifyIdToken(idToken);
}

module.exports = {
  verifyIdToken,
  initializeFirebaseAdmin,
};
