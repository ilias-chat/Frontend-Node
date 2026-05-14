const express = require('express');
const rootRoutes = require('./routes');

function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.get('/health', (_req, res) => {
    res.status(200).type('text').send('ok');
  });

  app.use('/', rootRoutes);

  app.use((err, _req, res, _next) => {
    console.error(err);
    if (res.headersSent) return;
    res.status(500).json({ error: 'Internal Server Error' });
  });

  return app;
}

module.exports = { createApp };
