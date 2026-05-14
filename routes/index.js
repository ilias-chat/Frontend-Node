const express = require('express');
const createUserRoutes = require('./userRoutes');

/**
 * @param {{ verifyIdToken?: (token: string) => Promise<{ uid: string, email?: string }> }} [userRouteOptions]
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

  return router;
}

module.exports = createRootRouter;
