const express = require('express');
const userController = require('../controllers/userController');
const userCommentController = require('../controllers/userCommentController');
const { createAuthMiddleware } = require('../middleware/authMiddleware');

/**
 * @param {{ verifyIdToken?: (token: string) => Promise<{ uid: string, email?: string }> }} [options]
 */
function createUserRoutes(options = {}) {
  const { verifyFirebaseToken, loadMongoUser, requireAdmin } = createAuthMiddleware(options);
  const router = express.Router();

  /**
   * @openapi
   * /api/users/sync:
   *   post:
   *     tags: [Users]
   *     summary: Create or update profile after Firebase registration
   *     description: Upserts the MongoDB user. Body firebaseUID must match the Firebase ID token uid.
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/SyncUserBody'
   *     responses:
   *       '200':
   *         description: Saved user
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/User'
   *       '400':
   *         description: Validation error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       '401':
   *         description: Missing or invalid token
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       '403':
   *         description: firebaseUID does not match token
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  router.post('/sync', verifyFirebaseToken, userController.sync);

  /**
   * @openapi
   * /api/users/login:
   *   post:
   *     tags: [Users]
   *     summary: Token exchange — return MongoDB user including role
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       '200':
   *         description: Current user
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/User'
   *       '401':
   *         description: Invalid token
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       '404':
   *         description: User not synced yet
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  router.post('/login', verifyFirebaseToken, loadMongoUser, userController.login);

  /**
   * @openapi
   * /api/users/me:
   *   get:
   *     tags: [Users]
   *     summary: Get current user profile and permissions
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       '200':
   *         description: Current user
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/User'
   *       '401':
   *         description: Invalid token
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       '404':
   *         description: User not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  router.get('/me', verifyFirebaseToken, loadMongoUser, userController.getMe);

  /**
   * @openapi
   * /api/users/me/comments:
   *   get:
   *     tags: [Users]
   *     summary: List scout reports (comments) authored by the current user
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *     responses:
   *       '200':
   *         description: Paginated comments with player summary
   *       '401':
   *         description: Invalid token
   */
  router.get('/me/comments', verifyFirebaseToken, userCommentController.listMyComments);

  /**
   * @openapi
   * /api/users/{uid}:
   *   put:
   *     tags: [Users]
   *     summary: Update own profile (name, avatar)
   *     description: Path uid must be the caller's Firebase UID.
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: uid
   *         required: true
   *         schema:
   *           type: string
   *         description: Firebase UID (must match token)
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateProfileBody'
   *     responses:
   *       '200':
   *         description: Updated user
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/User'
   *       '400':
   *         description: No updatable fields
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       '401':
   *         description: Invalid token
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       '403':
   *         description: uid does not match caller
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       '404':
   *         description: User not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  router.put('/:uid', verifyFirebaseToken, userController.updateProfile);

  /**
   * @openapi
   * /api/users:
   *   get:
   *     tags: [Users]
   *     summary: List all users (admin only)
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       '200':
   *         description: Array of users
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/User'
   *       '401':
   *         description: Invalid token
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       '403':
   *         description: Not an admin
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       '404':
   *         description: Admin user record not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  router.get('/', verifyFirebaseToken, loadMongoUser, requireAdmin, userController.listUsers);

  /**
   * @openapi
   * /api/users/{uid}/role:
   *   patch:
   *     tags: [Users]
   *     summary: Change a user's role (admin only)
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: uid
   *         required: true
   *         schema:
   *           type: string
   *         description: Target user's Firebase UID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/PatchRoleBody'
   *     responses:
   *       '200':
   *         description: Updated user
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/User'
   *       '400':
   *         description: Invalid role or self-demotion blocked
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       '401':
   *         description: Invalid token
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       '403':
   *         description: Not an admin
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       '404':
   *         description: Target user not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  router.patch('/:uid/role', verifyFirebaseToken, loadMongoUser, requireAdmin, userController.patchRole);

  return router;
}

module.exports = createUserRoutes;
