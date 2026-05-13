const mongoose = require('mongoose');

/**
 * Connects to MongoDB Atlas using MONGO_URI from environment.
 * @returns {Promise<typeof mongoose>}
 */
async function connectDatabase() {
  const uri = process.env.MONGO_URI;

  if (!uri || !String(uri).trim()) {
    const message = 'MONGO_URI is missing or empty. Set it in your .env file.';
    console.error('Database connection error:', message);
    throw new Error(message);
  }

  try {
    await mongoose.connect(uri);
    console.log('Successfully connected to MongoDB Atlas.');
    return mongoose;
  } catch (err) {
    console.error('Database connection error:', err.message);
    throw err;
  }
}

module.exports = { connectDatabase };
