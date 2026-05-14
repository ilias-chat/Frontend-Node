const express = require('express');
const userController = require('../controllers/userController');
const { createAuthMiddleware } = require('../middleware/authMiddleware');

/**
 * @param {{ verifyIdToken?: (token: string) => Promise<{ uid: string, email?: string }> }} [options]
 */
function createUserRoutes(options = {}) {
  const { verifyFirebaseToken, loadMongoUser, requireAdmin } = createAuthMiddleware(options);
  const router = express.Router();

  router.post('/sync', verifyFirebaseToken, userController.sync);
  router.post('/login', verifyFirebaseToken, loadMongoUser, userController.login);
  router.get('/me', verifyFirebaseToken, loadMongoUser, userController.getMe);
  router.put('/:uid', verifyFirebaseToken, userController.updateProfile);
  router.get('/', verifyFirebaseToken, loadMongoUser, requireAdmin, userController.listUsers);
  router.patch('/:uid/role', verifyFirebaseToken, loadMongoUser, requireAdmin, userController.patchRole);

  return router;
}

module.exports = createUserRoutes;
