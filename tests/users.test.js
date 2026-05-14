require('dotenv').config();

const { describe, test, before, after } = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const request = require('supertest');
const { createApp } = require('../app');
const User = require('../models/User');

function mockVerify(claims = { uid: 'firebase-test-1', email: 'u1@test.com' }) {
  return async (token) => {
    if (token === 'bad-token') {
      throw new Error('invalid');
    }
    return claims;
  };
}

describe('Users API — auth (no database)', () => {
  test('GET /api/users/me without Authorization returns 401', async () => {
    const app = createApp({ verifyIdToken: mockVerify() });
    const res = await request(app).get('/api/users/me').expect(401);
    assert.ok(res.body.error);
  });

  test('GET /api/users/me with invalid token returns 401', async () => {
    const app = createApp({ verifyIdToken: mockVerify() });
    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', 'Bearer bad-token')
      .expect(401);
    assert.ok(res.body.error);
  });

  test('POST /api/users/sync without Bearer returns 401', async () => {
    const app = createApp({ verifyIdToken: mockVerify() });
    await request(app)
      .post('/api/users/sync')
      .send({ firebaseUID: 'firebase-test-1', email: 'a@b.com' })
      .expect(401);
  });
});

const mongoDescribe = process.env.MONGO_URI ? describe : describe.skip;

mongoDescribe('Users API — integration (requires MONGO_URI)', { concurrency: false }, () => {
  const uid = 'firebase-test-users-api';
  const adminUid = 'firebase-test-users-api-admin';

  before(async () => {
    await mongoose.connect(process.env.MONGO_URI);
    await User.deleteMany({ firebaseUID: { $in: [uid, adminUid] } });
  });

  after(async () => {
    await User.deleteMany({ firebaseUID: { $in: [uid, adminUid] } });
    await mongoose.disconnect();
  });

  test('sync rejects mismatched firebaseUID', async () => {
    const app = createApp({ verifyIdToken: mockVerify({ uid, email: 'u@test.com' }) });
    const res = await request(app)
      .post('/api/users/sync')
      .set('Authorization', 'Bearer ok')
      .send({ firebaseUID: 'other-uid', email: 'a@b.com' })
      .expect(403);
    assert.strictEqual(res.body.error, 'firebaseUID does not match token');
  });

  test('sync upserts then login and me return profile', async () => {
    const app = createApp({ verifyIdToken: mockVerify({ uid, email: 'sync@test.com' }) });
    const syncRes = await request(app)
      .post('/api/users/sync')
      .set('Authorization', 'Bearer ok')
      .send({
        firebaseUID: uid,
        email: 'Sync@Test.com',
        name: 'Tester',
        avatar: 'https://example.com/p.png',
      })
      .expect(200);

    assert.strictEqual(syncRes.body.email, 'sync@test.com');
    assert.strictEqual(syncRes.body.name, 'Tester');
    assert.strictEqual(syncRes.body.role, 'user');
    assert.strictEqual(syncRes.body.avatar, 'https://example.com/p.png');

    const loginRes = await request(app)
      .post('/api/users/login')
      .set('Authorization', 'Bearer ok')
      .expect(200);
    assert.strictEqual(loginRes.body.firebaseUID, uid);

    const meRes = await request(app).get('/api/users/me').set('Authorization', 'Bearer ok').expect(200);
    assert.strictEqual(meRes.body.email, 'sync@test.com');
  });

  test('PUT profile updates name and clears avatar with empty string', async () => {
    const app = createApp({ verifyIdToken: mockVerify({ uid, email: 'u@test.com' }) });
    await request(app)
      .post('/api/users/sync')
      .set('Authorization', 'Bearer ok')
      .send({ firebaseUID: uid, email: 'put@test.com', name: 'N', avatar: 'https://x.com/a.png' })
      .expect(200);

    const putRes = await request(app)
      .put(`/api/users/${uid}`)
      .set('Authorization', 'Bearer ok')
      .send({ name: 'Updated', avatar: '' })
      .expect(200);
    assert.strictEqual(putRes.body.name, 'Updated');
    assert.strictEqual(putRes.body.avatar, '');

    const wrong = await request(app)
      .put(`/api/users/${adminUid}`)
      .set('Authorization', 'Bearer ok')
      .send({ name: 'X' })
      .expect(403);
    assert.strictEqual(wrong.body.error, 'Forbidden');
  });

  test('admin list and patch role; cannot self-demote', async () => {
    await User.create({
      firebaseUID: adminUid,
      email: 'admin@test.com',
      role: 'admin',
      name: 'Admin User',
    });

    const userApp = createApp({ verifyIdToken: mockVerify({ uid, email: 'u@test.com' }) });
    await request(userApp)
      .post('/api/users/sync')
      .set('Authorization', 'Bearer ok')
      .send({ firebaseUID: uid, email: 'user@test.com', name: 'Regular' });

    const listDenied = await request(userApp).get('/api/users').set('Authorization', 'Bearer ok').expect(403);

    assert.strictEqual(listDenied.body.error, 'Forbidden');

    const adminApp = createApp({ verifyIdToken: mockVerify({ uid: adminUid, email: 'admin@test.com' }) });
    const listRes = await request(adminApp).get('/api/users').set('Authorization', 'Bearer ok').expect(200);
    assert.ok(Array.isArray(listRes.body));
    assert.ok(listRes.body.length >= 2);

    const promoted = await request(adminApp)
      .patch(`/api/users/${uid}/role`)
      .set('Authorization', 'Bearer ok')
      .send({ role: 'admin' })
      .expect(200);
    assert.strictEqual(promoted.body.role, 'admin');

    const selfDemote = await request(adminApp)
      .patch(`/api/users/${adminUid}/role`)
      .set('Authorization', 'Bearer ok')
      .send({ role: 'user' })
      .expect(400);
    assert.strictEqual(selfDemote.body.error, 'Cannot demote yourself');
  });
});
