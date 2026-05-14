const express = require('express');
const playerAdminController = require('../controllers/playerAdminController');
const { createAuthMiddleware } = require('../middleware/authMiddleware');
const { getApiFootballService } = require('../services/apiFootballService');

/**
 * @param {{ verifyIdToken?: (token: string) => Promise<{ uid: string, email?: string }>, apiFootballService?: object }} [options]
 */
function createAdminRoutes(options = {}) {
  const { verifyFirebaseToken, loadMongoUser, requireAdmin } = createAuthMiddleware(options);

  const router = express.Router();
  const adminChain = [verifyFirebaseToken, loadMongoUser, requireAdmin];

  function resolveApiFootballService() {
    if (options.apiFootballService) return options.apiFootballService;
    return getApiFootballService();
  }

  /**
   * @openapi
   * /api/admin/import-players:
   *   post:
   *     tags: [Admin]
   *     summary: Import squad from API-Football into MongoDB
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/ImportPlayersBody'
   *     responses:
   *       '200':
   *         description: Bulk upsert summary
   *       '400':
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       '401':
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       '403':
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       '404':
   *         description: Team or resource not found from API
   *       '422':
   *         description: API-Football validation or venue data error
   */
  router.post('/import-players', ...adminChain, (req, res, next) => {
    let apiFootballService;
    try {
      apiFootballService = resolveApiFootballService();
    } catch (err) {
      return res.status(503).json({ error: err instanceof Error ? err.message : String(err) });
    }
    return playerAdminController.importPlayers(req, res, next, apiFootballService);
  });

  /**
   * @openapi
   * /api/admin/players/{id}:
   *   delete:
   *     tags: [Admin]
   *     summary: Remove a player from the local database
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       '204':
   *         description: Deleted
   *       '400':
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       '401':
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       '403':
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       '404':
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  router.delete('/players/:id', ...adminChain, playerAdminController.deletePlayer);

  return router;
}

module.exports = createAdminRoutes;
