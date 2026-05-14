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

  test('GET /api/docs.json returns OpenAPI spec', async () => {
    const app = createApp();
    const res = await request(app).get('/api/docs.json').expect(200).expect('Content-Type', /json/);
    assert.strictEqual(res.body.openapi, '3.0.3');
    assert.ok(res.body.paths['/health']);
    assert.ok(res.body.paths['/api/users/sync']);
    assert.ok(res.body.components?.securitySchemes?.bearerAuth);
  });
});
