const Player = require('../models/Player');
const { GrokError, getGrokService } = require('./grokService');

const MIN_PLAYERS_FOR_LINEUP = 25;
const MAX_ROSTER_FOR_AI = 100;

const VALID_FORMATIONS = new Set([
  '4-4-2',
  '4-3-3',
  '3-5-2',
  '4-2-3-1',
  '3-4-3',
  '5-3-2',
  '4-5-1',
]);

class LineupError extends Error {
  /**
   * @param {string} message
   * @param {number} [statusCode=400]
   */
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'LineupError';
    this.statusCode = statusCode;
  }
}

/**
 * @param {Array<{ rating?: number }>} comments
 * @returns {number | null}
 */
function averageRating(comments) {
  if (!Array.isArray(comments) || comments.length === 0) return null;
  const sum = comments.reduce((acc, c) => acc + (Number(c?.rating) || 0), 0);
  return Math.round((sum / comments.length) * 10) / 10;
}

/**
 * @param {Record<string, unknown> | undefined} stats
 * @returns {string | undefined}
 */
function summarizeStats(stats) {
  if (!stats || typeof stats !== 'object') return undefined;
  const goals = stats.goals?.total ?? stats.goals;
  const assists = stats.goals?.assists ?? stats.assists;
  const appearances = stats.games?.appearences ?? stats.games?.appearances ?? stats.appearances;
  const parts = [];
  if (goals != null && goals !== '') parts.push(`goals:${goals}`);
  if (assists != null && assists !== '') parts.push(`assists:${assists}`);
  if (appearances != null && appearances !== '') parts.push(`apps:${appearances}`);
  return parts.length ? parts.join(', ') : undefined;
}

/**
 * @param {import('mongoose').LeanDocument<any>} player
 */
function toLineupInput(player) {
  return {
    id: String(player._id),
    name: player.name,
    team: player.team,
    position: player.position || undefined,
    avgRating: averageRating(player.comments),
    reviewCount: Array.isArray(player.comments) ? player.comments.length : 0,
    statsSummary: summarizeStats(player.stats),
    image: player.image || undefined,
  };
}

/**
 * @param {{ formation: string, grokService?: ReturnType<typeof getGrokService> }} options
 */
async function suggestLineupFromDb(options) {
  const formationRaw = options.formation?.trim();
  if (!formationRaw || !VALID_FORMATIONS.has(formationRaw)) {
    throw new LineupError(
      `Invalid formation. Use one of: ${[...VALID_FORMATIONS].join(', ')}`,
      400
    );
  }
  const formation = formationRaw;

  const totalPlayers = await Player.countDocuments({});
  if (totalPlayers < MIN_PLAYERS_FOR_LINEUP) {
    throw new LineupError(
      `Need at least ${MIN_PLAYERS_FOR_LINEUP} players in the local database. Found ${totalPlayers}.`,
      422
    );
  }

  const players = await Player.find({}).sort({ name: 1 }).limit(MAX_ROSTER_FOR_AI).lean();
  const roster = players.map(toLineupInput);
  const grok = options.grokService ?? getGrokService();
  const suggestion = await grok.suggestLineup(roster, { formation });

  const pool = new Map(roster.map((p) => [p.id, p]));
  const validated = validateAndEnrich(suggestion, pool);

  return {
    formation: validated.formation,
    reasoning: validated.reasoning,
    playerCount: totalPlayers,
    rosterSentToAi: roster.length,
    starters: validated.starters,
    bench: validated.bench,
  };
}

/**
 * @param {import('./grokService').LineupSuggestion} suggestion
 * @param {Map<string, ReturnType<typeof toLineupInput>>} pool
 */
function validateAndEnrich(suggestion, pool) {
  const used = new Set();

  const enrich = (entries, label) => {
    return entries.map((entry, index) => {
      const player = pool.get(entry.playerId);
      if (!player) {
        throw new GrokError(
          `Grok picked unknown playerId "${entry.playerId}" in ${label}[${index}].`,
          502
        );
      }
      if (used.has(entry.playerId)) {
        throw new GrokError(`Duplicate playerId "${entry.playerId}" in lineup.`, 502);
      }
      used.add(entry.playerId);
      return {
        playerId: entry.playerId,
        slot: entry.slot || '',
        role: entry.role || player.position || undefined,
        name: player.name,
        team: player.team,
        position: player.position || undefined,
        avgRating: player.avgRating,
        image: player.image,
      };
    });
  };

  const starters = enrich(suggestion.starters || [], 'starters');
  if (starters.length !== 11) {
    throw new GrokError(
      `Grok returned ${starters.length} starters; expected exactly 11.`,
      502
    );
  }

  const bench = enrich(suggestion.bench || [], 'bench');

  return {
    formation: suggestion.formation,
    reasoning: suggestion.reasoning,
    starters,
    bench,
  };
}

module.exports = {
  LineupError,
  suggestLineupFromDb,
  averageRating,
  VALID_FORMATIONS,
  MIN_PLAYERS_FOR_LINEUP,
};
