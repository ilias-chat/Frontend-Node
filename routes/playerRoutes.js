const express = require('express');
const playerController = require('../controllers/playerController');
const playerCommentController = require('../controllers/playerCommentController');
const { createAuthMiddleware } = require('../middleware/authMiddleware');
const { getApiFootballService } = require('../services/apiFootballService');

/**
 * @param {{ verifyIdToken?: (token: string) => Promise<{ uid: string, email?: string }>, apiFootballService?: object }} [options]
 */
function createPlayerRoutes(options = {}) {
  const { verifyFirebaseToken, loadMongoUser } = createAuthMiddleware(options);
  const authChain = [verifyFirebaseToken, loadMongoUser];
  const router = express.Router();

  function resolveApiFootballService() {
    if (options.apiFootballService) return options.apiFootballService;
    return getApiFootballService();
  }

  /**
   * @openapi
   * /api/players/search:
   *   get:
   *     tags: [Players]
   *     summary: Text search by player name
   *     parameters:
   *       - in: query
   *         name: q
   *         required: true
   *         schema:
   *           type: string
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           minimum: 1
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 100
   *     responses:
   *       '200':
   *         description: Paginated players
   *       '400':
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  router.get('/search', playerController.searchPlayers);

  /**
   * @openapi
   * /api/players/nearby:
   *   get:
   *     tags: [Players]
   *     summary: Players and stadiums within radius (public)
   *     parameters:
   *       - in: query
   *         name: lat
   *         required: true
   *         schema:
   *           type: number
   *       - in: query
   *         name: lng
   *         required: true
   *         schema:
   *           type: number
   *       - in: query
   *         name: radiusKm
   *         schema:
   *           type: number
   *           description: Radius in km (use this or distance)
   *       - in: query
   *         name: distance
   *         schema:
   *           type: number
   *           description: Radius in meters (alternative to radiusKm)
   *     responses:
   *       '200':
   *         description: Players and deduped stadiums
   *       '400':
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  router.get('/nearby', playerController.nearbyPlayers);

  /**
   * @openapi
   * /api/players:
   *   post:
   *     tags: [Players]
   *     summary: Register a player manually (authenticated)
   *     description: Resolves team/league/venue from API-Football. Requires device or stadium coordinates.
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreatePlayerBody'
   *     responses:
   *       '201':
   *         description: Created player document
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
   *       '409':
   *         description: Duplicate name on same team
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       '422':
   *         description: Could not resolve stadium coordinates
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       '503':
   *         description: API-Football service unavailable
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  router.post('/', ...authChain, (req, res, next) => {
    let apiFootballService;
    try {
      apiFootballService = resolveApiFootballService();
    } catch (err) {
      return res.status(503).json({ error: err instanceof Error ? err.message : String(err) });
    }
    return playerController.createPlayer(req, res, next, apiFootballService);
  });

  /**
   * @openapi
   * /api/players/{id}/comments:
   *   get:
   *     tags: [Players]
   *     summary: List comments for a player
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       '200':
   *         description: Comment list
   *       '400':
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       '404':
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *   post:
   *     tags: [Players]
   *     summary: Add a comment and rating (requires Firebase token)
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/AddCommentBody'
   *     responses:
   *       '201':
   *         description: Created comment subdocument
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
   *       '404':
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  router.get('/:id/comments', playerCommentController.listComments);
  router.post('/:id/comments', verifyFirebaseToken, playerCommentController.addComment);

  /**
   * @openapi
   * /api/players/{id}/comments/{commentId}:
   *   delete:
   *     tags: [Players]
   *     summary: Delete own comment or moderate as admin
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *       - in: path
   *         name: commentId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       '204':
   *         description: Removed
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
  router.delete(
    '/:id/comments/:commentId',
    verifyFirebaseToken,
    playerCommentController.assertCommentDeleteAllowed,
    playerCommentController.deleteComment
  );

  /**
   * @openapi
   * /api/players/{id}:
   *   get:
   *     tags: [Players]
   *     summary: Player detail including stats and location
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       '200':
   *         description: Full player document
   *       '400':
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
  router.get('/:id', playerController.getPlayerById);

  /**
   * @openapi
   * /api/players:
   *   get:
   *     tags: [Players]
   *     summary: List players with optional filters
   *     parameters:
   *       - in: query
   *         name: team
   *         schema:
   *           type: string
   *       - in: query
   *         name: position
   *         schema:
   *           type: string
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *       - in: query
   *         name: q
   *         schema:
   *           type: string
   *         description: Search name, team, or league (case-insensitive)
   *       - in: query
   *         name: registeredOn
   *         schema:
   *           type: string
   *           format: date
   *         description: Filter by registration day (YYYY-MM-DD)
   *     responses:
   *       '200':
   *         description: Paginated players
   *       '400':
   *         description: Invalid registeredOn
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  router.get('/', playerController.listPlayers);

  return router;
}

module.exports = createPlayerRoutes;
