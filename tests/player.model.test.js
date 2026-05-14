const { describe, test } = require('node:test');
const assert = require('node:assert');
const Player = require('../models/Player');

const validPoint = { type: 'Point', coordinates: [-0.1278, 51.5074] };

describe('Player model validation', () => {
  test('accepts a valid player document', () => {
    const player = new Player({
      name: 'John Doe',
      team: 'Arsenal',
      league: 'Premier League',
      location: validPoint,
    });

    const err = player.validateSync();
    assert.strictEqual(err, undefined);
  });

  test('accepts optional position stats and venueName', () => {
    const player = new Player({
      name: 'Jane',
      team: 'Real Madrid',
      league: 'La Liga',
      location: validPoint,
      position: 'Attacker',
      stats: { goals: 10, appearances: 20 },
      venueName: 'Santiago Bernabéu',
    });
    assert.strictEqual(player.validateSync(), undefined);
  });

  test('rejects comment text longer than 1000 characters', () => {
    const player = new Player({
      name: 'A',
      team: 'B',
      league: 'C',
      location: validPoint,
      comments: [
        {
          author: 'fan',
          text: 'x'.repeat(1001),
          rating: 3,
          location: validPoint,
        },
      ],
    });

    const err = player.validateSync();
    assert.ok(err);
    assert.ok(err.errors['comments.0.text']);
  });

  test('rejects comment rating above 5', () => {
    const player = new Player({
      name: 'A',
      team: 'B',
      league: 'C',
      location: validPoint,
      comments: [
        {
          author: 'fan',
          text: 'ok',
          rating: 6,
          location: validPoint,
        },
      ],
    });

    const err = player.validateSync();
    assert.ok(err);
  });

  test('rejects invalid GeoJSON coordinates', () => {
    const player = new Player({
      name: 'A',
      team: 'B',
      league: 'C',
      location: { type: 'Point', coordinates: [200, 0] },
    });

    const err = player.validateSync();
    assert.ok(err);
  });
});
