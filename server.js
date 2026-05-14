require('dotenv').config();

const { connectDatabase } = require('./config/database');
const { createApp } = require('./app');

async function main() {
  const app = createApp();
  const PORT = Number(process.env.PORT) || 3000;

  // Listen before DB so platforms like Cloud Run see the port open during startup.
  // (Cloud Run fails the revision if nothing listens on $PORT in time.)
  // Cloud Run (and Docker) need IPv4 all-interfaces bind; default can be localhost-only.
  await new Promise((resolve, reject) => {
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server listening on port ${PORT}`);
      resolve(server);
    });
    server.on('error', reject);
  });

  await connectDatabase();
}

main().catch(() => {
  process.exit(1);
});
