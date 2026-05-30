const express = require('express');
const lineupController = require('../controllers/lineupController');
const { getGrokService } = require('../services/grokService');

/**
 * @param {{ grokService?: object }} [options]
 */
function createLineupRoutes(options = {}) {
  const router = express.Router();

  function resolveGrokService() {
    if (options.grokService) return options.grokService;
    return getGrokService();
  }

  /** Attach Grok service for controller (test injection). */
  function attachGrokService(req, _res, next) {
    try {
      req.grokService = resolveGrokService();
      next();
    } catch (err) {
      next(err);
    }
  }

  /**
   * @openapi
   * /api/lineup/suggest:
   *   post:
   *     tags: [Lineup]
   *     summary: Suggest a best XI from locally stored players (xAI Grok)
   *     description: |
   *       Loads all players from MongoDB and asks Grok to pick the best starting XI.
   *       Requires at least 25 players in the database and `GROK_API_KEY` on the server.
   *       **TEMP:** Public (no auth) for Swagger testing — re-enable bearerAuth before production.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [formation]
   *             properties:
   *               formation:
   *                 type: string
   *                 example: "4-4-2"
   *                 description: "4-4-2, 4-3-3, 3-5-2, 4-2-3-1, 3-4-3, 5-3-2, 4-5-1"
   *     responses:
   *       '200':
   *         description: AI lineup suggestion
   *       '400':
   *         description: Missing or invalid formation
   *       '422':
   *         description: Fewer than 25 players in the database
   *       '503':
   *         description: GROK_API_KEY not configured
   *       '502':
   *         description: Grok error or invalid AI response
   */
  // TEMP: public for Swagger testing — restore ...authChain before production
  router.post('/suggest', attachGrokService, lineupController.suggestLineup);

  return router;
}

module.exports = createLineupRoutes;
