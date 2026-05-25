const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const createRootRouter = require('./routes');
const { buildSwaggerSpec } = require('./config/swagger');

function parseCorsOrigins() {
  /** Local dev: Angular CLI often :4200, Ionic CLI often :8100; native wrappers use custom schemes */
  const localDevOrigins = [
    'http://localhost:4200',
    'http://127.0.0.1:4200',
    'http://localhost:8100',
    'http://127.0.0.1:8100',
    'ionic://localhost',
    'capacitor://localhost',
  /** Capacitor 8 Android WebView (default androidScheme: https) */
    'https://localhost',
  ];
  const raw = process.env.FRONTEND_ORIGIN || process.env.CORS_ORIGINS || '';
  const fromEnv = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (fromEnv.length === 0) {
    return localDevOrigins;
  }
  return [...new Set([...fromEnv, ...localDevOrigins])];
}

/**
 * @param {{ verifyIdToken?: (token: string) => Promise<{ uid: string, email?: string }>, apiFootballService?: object }} [options] Test-only overrides (Firebase verify, API-Football service mock).
 */
function createApp(options = {}) {
  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  const corsOrigins = parseCorsOrigins();
  app.use(
    cors({
      origin: corsOrigins.length === 1 ? corsOrigins[0] : corsOrigins,
      credentials: true,
    })
  );

  app.use(express.json({ limit: '4mb' }));

  const swaggerSpec = buildSwaggerSpec();
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.get('/api/docs.json', (_req, res) => {
    res.json(swaggerSpec);
  });

  /**
   * @openapi
   * /health:
   *   get:
   *     tags: [System]
   *     summary: Liveness probe
   *     responses:
   *       '200':
   *         description: Service is up
   *         content:
   *           text/plain:
   *             schema:
   *               type: string
   *               example: ok
   */
  app.get('/health', (_req, res) => {
    res.status(200).type('text').send('ok');
  });

  const rootRoutes = createRootRouter(options);
  app.use('/', rootRoutes);

  app.use((err, _req, res, _next) => {
    console.error(err);
    if (res.headersSent) return;
    if (err?.type === 'entity.too.large') {
      return res
        .status(413)
        .type('application/json')
        .json({ error: 'Request body too large. Use a smaller photo (max ~2MB).' });
    }
    res.status(500).type('application/json').json({ error: 'Internal Server Error' });
  });

  return app;
}

module.exports = { createApp };
