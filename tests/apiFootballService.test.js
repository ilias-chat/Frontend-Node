const { describe, test } = require('node:test');
const assert = require('node:assert');
const {
  mapImportPlayerRow,
  mapLeagueRows,
  mapTeamRows,
  filterTopLeagues,
  TOP_LEAGUE_IDS,
} = require('../services/apiFootballService');

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

  test('maps league rows with logo and country flag fallback', () => {
    const leagues = mapLeagueRows([
      {
        league: { id: 39, name: 'Premier League', type: 'League', logo: 'https://media.api-sports.io/leagues/39.png' },
        country: { name: 'England', flag: 'https://media.api-sports.io/flags/gb.svg' },
      },
      {
        league: { id: 39, name: 'Premier League', type: 'League' },
        country: { name: 'England', flag: 'https://media.api-sports.io/flags/gb.svg' },
      },
    ]);
    assert.strictEqual(leagues.length, 1);
    assert.strictEqual(leagues[0].id, 39);
    assert.strictEqual(leagues[0].logo, 'https://media.api-sports.io/leagues/39.png');
  });

  test('filterTopLeagues returns at most 10 in curated order', () => {
    const all = mapLeagueRows([
      { league: { id: 999, name: 'Minor League' }, country: { name: 'X' } },
      { league: { id: 39, name: 'Premier League' }, country: { name: 'England' } },
      { league: { id: 140, name: 'La Liga' }, country: { name: 'Spain' } },
      { league: { id: 135, name: 'Serie A' }, country: { name: 'Italy' } },
    ]);
    const top = filterTopLeagues(all);
    assert.ok(top.length <= TOP_LEAGUE_IDS.length);
    assert.strictEqual(top[0].id, 39);
    assert.strictEqual(top[1].id, 140);
    assert.ok(!top.some((l) => l.id === 999));
  });

  test('maps team rows with logo', () => {
    const teams = mapTeamRows([
      { team: { id: 33, name: 'Manchester United', logo: 'https://media.api-sports.io/teams/33.png' } },
    ]);
    assert.strictEqual(teams.length, 1);
    assert.strictEqual(teams[0].id, 33);
    assert.strictEqual(teams[0].logo, 'https://media.api-sports.io/teams/33.png');
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
