const express = require('express');
const rootRoutes = require('./routes');

function createApp() {
  const app = express();
  app.use('/', rootRoutes);
  return app;
}

module.exports = { createApp };
