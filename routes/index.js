const express = require('express');
const createUserRoutes = require('./userRoutes');
const createAdminRoutes = require('./adminRoutes');
const createPlayerRoutes = require('./playerRoutes');
const createLineupRoutes = require('./lineupRoutes');

/**
 * @param {{ verifyIdToken?: (token: string) => Promise<{ uid: string, email?: string }>, apiFootballService?: object, grokService?: object }} [userRouteOptions]
 */
function createRootRouter(userRouteOptions = {}) {
  const router = express.Router();

  /**
   * @openapi
   * /:
   *   get:
   *     tags: [System]
   *     summary: API root
   *     responses:
   *       '200':
   *         description: Welcome payload
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: Hello World
   */
  router.get('/', (req, res) => {
    res.json({ message: 'Hello World' });
  });

  router.use('/api/users', createUserRoutes(userRouteOptions));
  router.use('/api/admin', createAdminRoutes(userRouteOptions));
  router.use('/api/players', createPlayerRoutes(userRouteOptions));
  router.use('/api/lineup', createLineupRoutes(userRouteOptions));

  return router;
}

module.exports = createRootRouter;
