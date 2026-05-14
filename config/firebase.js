const admin = require('firebase-admin');

function initializeFirebaseAdmin() {
  if (admin.apps.length > 0) {
    return admin.app();
  }

  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const cred = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    return admin.initializeApp({
      credential: admin.credential.cert(cred),
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
