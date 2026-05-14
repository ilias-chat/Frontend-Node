require('dotenv').config();

const { connectDatabase } = require('./config/database');
const { createApp } = require('./app');

async function main() {
  const app = createApp();
  const PORT = Number(process.env.PORT) || 3000;

  // Cloud Run requires the process to listen on $PORT during startup, before long work
  // (e.g. MongoDB). If we await connectDatabase() first, deploy can fail with
  // "container failed to start and listen on the port ... within the allocated timeout".
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
