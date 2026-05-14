/**
 * Writes cloudrun-env.json for google-github-actions/deploy-cloudrun env_vars_file.
 * JSON avoids shell/YAML quoting issues with MongoDB URIs (&, =, etc.) and
 * multi-line Firebase private keys.
 */
const fs = require('fs');

const uri = process.env.MONGO_URI;
if (!uri || !String(uri).trim()) {
  console.error('::error::MONGO_URI is empty. Set the MONGO_URI repository secret.');
  process.exit(1);
}

const env = { MONGO_URI: uri.trim() };

const firebaseRaw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (firebaseRaw && String(firebaseRaw).trim()) {
  const firebaseJson = String(firebaseRaw).trim();
  try {
    JSON.parse(firebaseJson);
  } catch {
    console.error('::error::FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.');
    process.exit(1);
  }
  env.FIREBASE_SERVICE_ACCOUNT_JSON = firebaseJson;
} else {
  console.log(
    '::warning::FIREBASE_SERVICE_ACCOUNT_JSON is not set. User routes that call verifyIdToken will fail unless Cloud Run uses a runtime service account with Firebase-compatible ADC. Add the FIREBASE_SERVICE_ACCOUNT_JSON repository secret to fix this.'
  );
}

fs.writeFileSync('cloudrun-env.json', JSON.stringify(env));
