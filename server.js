require('dotenv').config();

const express = require('express');
const { connectDatabase } = require('./config/database');
const rootRoutes = require('./routes');

async function main() {
  await connectDatabase();

  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use('/', rootRoutes);

  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

main().catch(() => {
  process.exit(1);
});
