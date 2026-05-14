const express = require('express');
const createRootRouter = require('./routes');

/**
 * @param {{ verifyIdToken?: (token: string) => Promise<{ uid: string, email?: string }> }} [options] Test-only Firebase override.
 */
function createApp(options = {}) {
  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.status(200).type('text').send('ok');
  });

  const rootRoutes = createRootRouter(options);
  app.use('/', rootRoutes);

  app.use((err, _req, res, _next) => {
    console.error(err);
    if (res.headersSent) return;
    res.status(500).json({ error: 'Internal Server Error' });
  });

  return app;
}

module.exports = { createApp };
