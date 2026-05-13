const { describe, test } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const { createApp } = require('../app');

describe('HTTP API', () => {
  test('GET / returns Hello World JSON', async () => {
    const app = createApp();
    const res = await request(app).get('/').expect(200).expect('Content-Type', /json/);

    assert.deepStrictEqual(res.body, { message: 'Hello World' });
  });
});
