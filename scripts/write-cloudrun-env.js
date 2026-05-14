/**
 * Writes cloudrun-env.json for google-github-actions/deploy-cloudrun env_vars_file.
 * JSON avoids shell/YAML quoting issues with MongoDB URIs (&, =, etc.).
 */
const fs = require('fs');

const uri = process.env.MONGO_URI;
if (!uri || !String(uri).trim()) {
  console.error('::error::MONGO_URI is empty. Set the MONGO_URI repository secret.');
  process.exit(1);
}

fs.writeFileSync('cloudrun-env.json', JSON.stringify({ MONGO_URI: uri.trim() }));
