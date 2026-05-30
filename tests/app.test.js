const { describe, test } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const { createApp } = require('../app');

describe('HTTP API', () => {
  test('GET /health returns ok', async () => {
    const app = createApp();
    const res = await request(app).get('/health').expect(200).expect('Content-Type', /text/);
    assert.strictEqual(res.text, 'ok');
  });

  test('GET / returns Hello World JSON', async () => {
    const app = createApp();
    const res = await request(app).get('/').expect(200).expect('Content-Type', /json/);

    assert.deepStrictEqual(res.body, { message: 'Hello World' });
  });

  test('GET /api/docs.json returns OpenAPI spec with all API paths', async () => {
    const app = createApp();
    const res = await request(app).get('/api/docs.json').expect(200).expect('Content-Type', /json/);
    assert.strictEqual(res.body.openapi, '3.0.3');
    const expectedPaths = [
      '/',
      '/health',
      '/api/users/sync',
      '/api/users/login',
      '/api/users/me',
      '/api/users/me/comments',
      '/api/users/{uid}',
      '/api/users',
      '/api/users/{uid}/role',
      '/api/admin/leagues',
      '/api/admin/teams',
      '/api/admin/squad-players',
      '/api/admin/import-players',
      '/api/admin/players/{id}',
      '/api/players/search',
      '/api/players/nearby',
      '/api/players',
      '/api/players/{id}/comments',
      '/api/players/{id}/comments/{commentId}',
      '/api/players/{id}',
      '/api/lineup/suggest',
    ];
    for (const path of expectedPaths) {
      assert.ok(res.body.paths[path], `missing OpenAPI path: ${path}`);
    }
    assert.ok(res.body.paths['/api/players'].post, 'POST /api/players should be documented');
    assert.ok(res.body.paths['/api/players'].get, 'GET /api/players should be documented');
    assert.ok(res.body.paths['/api/admin/players/{id}'].patch, 'PATCH /api/admin/players/{id} should be documented');
    assert.ok(res.body.paths['/api/admin/players/{id}'].delete, 'DELETE /api/admin/players/{id} should be documented');
    assert.ok(res.body.components?.securitySchemes?.bearerAuth);
  });
});
