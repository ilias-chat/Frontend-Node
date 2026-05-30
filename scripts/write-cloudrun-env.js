/**
 * Writes cloudrun-env.json for google-github-actions/deploy-cloudrun env_vars_file.
 * JSON avoids shell/YAML quoting issues with MongoDB URIs (&, =, etc.) and
 * multi-line Firebase private keys.
 *
 * Environment variables (set in GitHub Actions for CD):
 *   MONGO_URI (required)
 *   FIREBASE_SERVICE_ACCOUNT_JSON (optional)
 *   API_FOOTBALL_KEY (optional; required for admin import against API-Football in production)
 *   GROK_API_KEY (optional; required for POST /api/lineup/suggest)
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

const apiFootballKey = process.env.API_FOOTBALL_KEY;
if (apiFootballKey && String(apiFootballKey).trim()) {
  env.API_FOOTBALL_KEY = String(apiFootballKey).trim();
} else {
  console.log(
    '::warning::API_FOOTBALL_KEY is not set. POST /api/admin/import-players will return 503 on Cloud Run until you add the API_FOOTBALL_KEY repository secret and redeploy.'
  );
}

const grokKey = process.env.GROK_API_KEY;
if (grokKey && String(grokKey).trim()) {
  env.GROK_API_KEY = String(grokKey).trim();
} else {
  console.log(
    '::warning::GROK_API_KEY is not set. POST /api/lineup/suggest will return 503 on Cloud Run until you add the GROK_API_KEY repository secret and redeploy.'
  );
}

fs.writeFileSync('cloudrun-env.json', JSON.stringify(env));
