require('dotenv').config();

const { describe, test, before, after } = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const request = require('supertest');
const { createApp } = require('../app');
const User = require('../models/User');
const Player = require('../models/Player');
const { createGrokService, resolveProvider } = require('../services/grokService');
const {
  suggestLineupFromDb,
  MIN_PLAYERS_FOR_LINEUP,
} = require('../services/lineupService');

function mockVerify(claims = { uid: 'firebase-test-lineup-user', email: 'lineup@test.com' }) {
  return async (token) => {
    if (token === 'bad-token') {
      throw new Error('invalid');
    }
    return claims;
  };
}

const londonPoint = { type: 'Point', coordinates: [-0.1278, 51.5074] };

function mockGrokService() {
  return {
    async suggestLineup(players, options = {}) {
      const starters = players.slice(0, 11).map((p, i) => ({
        playerId: p.id,
        slot: i === 0 ? 'GK' : `P${i}`,
        role: p.position,
      }));
      return {
        formation: options.formation || '4-4-2',
        reasoning: 'Mock lineup for automated tests.',
        starters,
        bench: players.slice(11, 18).map((p, i) => ({
          playerId: p.id,
          slot: `SUB${i + 1}`,
          role: p.position,
        })),
      };
    },
  };
}

const positionCycle = ['Goalkeeper', 'Defender', 'Midfielder', 'Attacker'];

const mongoDescribe = process.env.MONGO_URI ? describe : describe.skip;

mongoDescribe('POST /api/lineup/suggest', () => {
  const uid = 'firebase-test-lineup-user';
  const team = 'Lineup Test FC';

  before(async () => {
    await mongoose.connect(process.env.MONGO_URI);
    await User.deleteMany({ firebaseUID: uid });
    await Player.deleteMany({ team });
    await User.create({ firebaseUID: uid, email: 'lineup@test.com', role: 'user' });

    await Player.insertMany(
      Array.from({ length: MIN_PLAYERS_FOR_LINEUP }, (_, index) => ({
        name: `Lineup Player ${index + 1}`,
        team,
        league: 'Test League',
        position: positionCycle[index % positionCycle.length],
        location: londonPoint,
        comments:
          index % 2 === 0
            ? [{ author: uid, text: 'Solid', rating: 4, location: londonPoint }]
            : [],
      }))
    );
  });

  after(async () => {
    await Player.deleteMany({ team });
    await User.deleteMany({ firebaseUID: uid });
    await mongoose.disconnect();
  });

  test('works without bearer token while endpoint is public (TEMP)', async () => {
    const total = await Player.countDocuments({});
    if (total < MIN_PLAYERS_FOR_LINEUP) {
      return;
    }

    const app = createApp({
      grokService: mockGrokService(),
    });
    const res = await request(app).post('/api/lineup/suggest').send({ formation: '4-4-2' });
    assert.equal(res.status, 200);
    assert.equal(res.body.starters.length, 11);
  });

  test('returns 400 when formation is missing', async () => {
    const app = createApp({
      grokService: mockGrokService(),
    });
    const res = await request(app)
      .post('/api/lineup/suggest')
      .set('Authorization', 'Bearer good-token')
      .send({});
    assert.equal(res.status, 400);
    assert.match(res.body.error, /formation is required/i);
  });

  test('returns 400 for invalid formation', async () => {
    const app = createApp({
      grokService: mockGrokService(),
    });
    const res = await request(app)
      .post('/api/lineup/suggest')
      .set('Authorization', 'Bearer good-token')
      .send({ formation: '9-9-9' });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /Invalid formation/i);
  });

  test('returns AI lineup with 11 starters from full local database', async () => {
    const total = await Player.countDocuments({});
    assert.ok(
      total >= MIN_PLAYERS_FOR_LINEUP,
      `test database needs at least ${MIN_PLAYERS_FOR_LINEUP} players`
    );

    const app = createApp({
      grokService: mockGrokService(),
    });
    const res = await request(app)
      .post('/api/lineup/suggest')
      .set('Authorization', 'Bearer good-token')
      .send({ formation: '4-4-2' });

    assert.equal(res.status, 200);
    assert.equal(res.body.formation, '4-4-2');
    assert.equal(res.body.starters.length, 11);
    assert.ok(res.body.starters[0].name);
    assert.ok(res.body.starters[0].playerId);
    assert.match(res.body.reasoning, /Mock lineup/i);
    assert.ok(res.body.playerCount >= MIN_PLAYERS_FOR_LINEUP);
    assert.ok(res.body.rosterSentToAi >= MIN_PLAYERS_FOR_LINEUP);
  });
});

describe('lineupService roster validation', () => {
  test('rejects when fewer than 25 players are in the database', async () => {
    const originalCount = Player.countDocuments;
    Player.countDocuments = async () => 20;
    try {
      await assert.rejects(
        () =>
          suggestLineupFromDb({
            formation: '4-4-2',
            grokService: mockGrokService(),
          }),
        (err) => {
          assert.equal(err.statusCode, 422);
          assert.match(err.message, /at least 25 players/i);
          return true;
        }
      );
    } finally {
      Player.countDocuments = originalCount;
    }
  });
});

describe('Grok service', () => {
  test('returns 503 when API key placeholder is used', async () => {
    const svc = createGrokService({ apiKey: 'your_grok_api_key_here' });
    await assert.rejects(
      () => svc.suggestLineup([{ id: '1', name: 'A', team: 'T' }]),
      (err) => {
        assert.equal(err.statusCode, 503);
        assert.match(err.message, /GROK_API_KEY/i);
        return true;
      }
    );
  });

  test('routes gsk_ keys to Groq API', () => {
    const cfg = resolveProvider('gsk_test_key');
    assert.equal(cfg.name, 'Groq');
    assert.match(cfg.baseUrl, /groq\.com/);
    assert.match(cfg.model, /llama/i);
  });

  test('routes xai- keys to xAI API', () => {
    const cfg = resolveProvider('xai-test-key');
    assert.equal(cfg.name, 'xAI Grok');
    assert.match(cfg.baseUrl, /api\.x\.ai/);
    assert.match(cfg.model, /grok/i);
  });
});
