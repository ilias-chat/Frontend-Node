const { describe, test } = require('node:test');
const assert = require('node:assert');
const { mapImportPlayerRow } = require('../services/apiFootballService');

const location = { type: 'Point', coordinates: [-0.1, 51.5] };

describe('mapImportPlayerRow', () => {
  test('maps player.photo to image URL', () => {
    const doc = mapImportPlayerRow(
      {
        player: {
          id: 42,
          name: 'Test Striker',
          photo: 'https://media.api-sports.io/football/players/42.png',
        },
        statistics: [{ games: { position: 'Attacker' } }],
      },
      'Test FC',
      'Premier League',
      'Test Arena',
      location
    );
    assert.ok(doc);
    assert.strictEqual(doc.image, 'https://media.api-sports.io/football/players/42.png');
    assert.strictEqual(doc.externalId, 42);
    assert.strictEqual(doc.position, 'Attacker');
  });

  test('omits image when photo is missing', () => {
    const doc = mapImportPlayerRow(
      { player: { id: 7, name: 'No Photo' } },
      'Test FC',
      'League',
      'Arena',
      location
    );
    assert.ok(doc);
    assert.strictEqual(doc.image, undefined);
  });
});
