require('dotenv').config();

const mongoose = require('mongoose');
const { createApp } = require('../app');

// Build the Express app once per cold start (reused across warm invocations).
const app = createApp();

/**
 * Serverless functions are stateless and can run many concurrent instances, so we
 * cache the Mongoose connection on the global object to avoid opening a new
 * connection (and exhausting Atlas connection limits) on every invocation.
 */
let cachedConnection = global.__trwmMongoConn;
if (!cachedConnection) {
  cachedConnection = global.__trwmMongoConn = { promise: null };
}

async function ensureDatabase() {
  if (mongoose.connection.readyState === 1) {
    return;
  }
  if (!cachedConnection.promise) {
    const uri = process.env.MONGO_URI;
    if (!uri || !String(uri).trim()) {
      throw new Error('MONGO_URI is missing or empty. Set it in the Vercel project environment variables.');
    }
    cachedConnection.promise = mongoose.connect(uri).catch((err) => {
      // Reset so the next request can retry instead of caching a rejected promise.
      cachedConnection.promise = null;
      throw err;
    });
  }
  await cachedConnection.promise;
}

module.exports = async (req, res) => {
  try {
    await ensureDatabase();
  } catch (err) {
    console.error('Database connection error:', err && err.message ? err.message : err);
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Database unavailable' }));
    return;
  }
  return app(req, res);
};
