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
    server.once('error', (err) => {
      if (err && err.code === 'EADDRINUSE') {
        console.error(
          `Port ${PORT} is already in use. Another process (often another Node server) is bound to this port.\n` +
            `Stop it, or run: npm run dev:clean\n` +
            `On Windows you can also: netstat -ano | findstr :${PORT}  then  taskkill /PID <pid> /F`
        );
      }
      reject(err);
    });
  });

  // Connect in the background so deploy healthchecks (/health) succeed even if MongoDB
  // is slow or misconfigured — API routes will fail until MONGO_URI is valid.
  connectDatabase().catch((err) => {
    console.error(
      'Database connection failed at startup:',
      err && err.message ? err.message : err
    );
    console.error('Server keeps running for /health. Set MONGO_URI in Railway Variables.');
  });
}

main().catch((err) => {
  console.error('Startup failed:', err && err.message ? err.message : err);
  process.exit(1);
});
