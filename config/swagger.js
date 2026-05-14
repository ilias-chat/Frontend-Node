const path = require('path');
const swaggerJsdoc = require('swagger-jsdoc');

const rootDir = path.join(__dirname, '..');

/** @type {import('swagger-jsdoc').Options} */
const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'TRWM Backend API',
      version: require('../package.json').version,
      description:
        'REST API for TRWM. Secured user routes expect a **Firebase ID token** in `Authorization: Bearer <token>`.',
    },
    servers: [{ url: '/', description: 'Current host' }],
    tags: [
      { name: 'System', description: 'Health and root' },
      { name: 'Users', description: 'Profiles, auth exchange, admin' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Firebase ID token from the client after sign-in.',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string', description: 'Human-readable message' },
          },
          required: ['error'],
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'MongoDB document id' },
            firebaseUID: { type: 'string' },
            email: { type: 'string', format: 'email' },
            role: { type: 'string', enum: ['user', 'admin'] },
            name: { type: 'string', nullable: true },
            avatar: { type: 'string', description: 'Image URL; may be empty string', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        SyncUserBody: {
          type: 'object',
          required: ['firebaseUID', 'email'],
          properties: {
            firebaseUID: {
              type: 'string',
              description: 'Must match the uid in the Firebase ID token.',
            },
            email: { type: 'string', format: 'email' },
            name: { type: 'string' },
            avatar: { type: 'string', description: 'Optional profile image URL' },
          },
        },
        UpdateProfileBody: {
          type: 'object',
          description: 'At least one field required.',
          properties: {
            name: { type: 'string' },
            avatar: { type: 'string', description: 'Empty string clears avatar' },
          },
        },
        PatchRoleBody: {
          type: 'object',
          required: ['role'],
          properties: {
            role: { type: 'string', enum: ['user', 'admin'] },
          },
        },
      },
    },
  },
  apis: [
    path.join(rootDir, 'app.js'),
    path.join(rootDir, 'routes', 'index.js'),
    path.join(rootDir, 'routes', 'userRoutes.js'),
  ],
};

let specCache;

function buildSwaggerSpec() {
  if (!specCache) {
    specCache = swaggerJsdoc(options);
  }
  return specCache;
}

module.exports = { buildSwaggerSpec };
