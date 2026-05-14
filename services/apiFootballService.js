/**
 * API-Football (api-sports) v3 client and import helpers.
 * @see https://www.api-football.com/documentation-v3
 */

const DEFAULT_BASE = 'https://v3.football.api-sports.io';

class ApiFootballError extends Error {
  /**
   * @param {string} message
   * @param {number} [statusCode=502]
   */
  constructor(message, statusCode = 502) {
    super(message);
    this.name = 'ApiFootballError';
    this.statusCode = statusCode;
  }
}

/**
 * @param {unknown} v
 * @returns {number|null}
 */
function toFiniteNumber(v) {
  const n = typeof v === 'string' ? Number(v) : v;
  if (typeof n !== 'number' || !Number.isFinite(n)) return null;
  return n;
}

/**
 * @param {{ apiKey?: string, baseUrl?: string, fetch?: typeof fetch }} [cfg]
 */
function createApiFootballService(cfg = {}) {
  const apiKey = cfg.apiKey ?? process.env.API_FOOTBALL_KEY;
  const baseUrl = (cfg.baseUrl ?? DEFAULT_BASE).replace(/\/$/, '');
  const fetchImpl = cfg.fetch ?? globalThis.fetch;

  if (!apiKey) {
    throw new Error('API_FOOTBALL_KEY is not set');
  }
  if (typeof fetchImpl !== 'function') {
    throw new Error('Global fetch is not available; pass fetch in options');
  }

  /**
   * @param {string} path
   * @param {Record<string, string | number>} [query]
   */
  async function request(path, query = {}) {
    const url = new URL(`${baseUrl}${path.startsWith('/') ? path : `/${path}`}`);
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
    const res = await fetchImpl(url.toString(), {
      method: 'GET',
      headers: { 'x-apisports-key': apiKey },
    });
    if (!res.ok) {
      throw new ApiFootballError(`API-Football HTTP ${res.status}`, res.status >= 400 && res.status < 600 ? res.status : 502);
    }
    /** @type {{ errors?: { message?: string }[], paging?: { current?: number, total?: number }, response?: unknown }} */
    const data = await res.json();
    if (Array.isArray(data.errors) && data.errors.length > 0) {
      const msg = data.errors.map((e) => e?.message || String(e)).join('; ');
      throw new ApiFootballError(msg || 'API-Football returned errors', 422);
    }
    return data;
  }

  /**
   * @param {number} teamId
   * @param {number} leagueId
   * @param {number} season
   */
  async function assertLeagueBelongsToTeam(teamId, leagueId, season) {
    const data = await request('/leagues', { team: teamId, season });
    const rows = Array.isArray(data.response) ? data.response : [];
    const ok = rows.some((row) => {
      const lid = row?.league?.id;
      return Number(lid) === Number(leagueId);
    });
    if (!ok) {
      throw new ApiFootballError(
        `League ${leagueId} is not associated with team ${teamId} for season ${season}`,
        422
      );
    }
    const match = rows.find((row) => Number(row?.league?.id) === Number(leagueId));
    const leagueName = match?.league?.name ? String(match.league.name) : `League ${leagueId}`;
    return { leagueName };
  }

  /**
   * @param {number} teamId
   */
  async function fetchTeam(teamId) {
    const data = await request('/teams', { id: teamId });
    const row = Array.isArray(data.response) ? data.response[0] : null;
    if (!row?.team) {
      throw new ApiFootballError(`Team ${teamId} not found`, 404);
    }
    const venueId = row.venue?.id != null ? Number(row.venue.id) : null;
    const venueName = row.venue?.name ? String(row.venue.name) : row.team?.name ? String(row.team.name) : '';
    const teamName = row.team?.name ? String(row.team.name) : `Team ${teamId}`;
    return { teamName, venueId, venueName: venueName || teamName };
  }

  /**
   * @param {number} venueId
   * @returns {{ lng: number, lat: number, venueName: string }}
   */
  async function fetchVenuePoint(venueId) {
    const data = await request('/venues', { id: venueId });
    const row = Array.isArray(data.response) ? data.response[0] : null;
    const lat = toFiniteNumber(row?.lat ?? row?.latitude);
    const lng = toFiniteNumber(row?.lng ?? row?.longitude ?? row?.lon);
    if (lat == null || lng == null) {
      throw new ApiFootballError(`Venue ${venueId} has no coordinates`, 422);
    }
    const name = row?.name ? String(row.name) : '';
    return {
      lng,
      lat,
      venueName: name,
    };
  }

  /**
   * @param {number} teamId
   * @param {number} season
   * @returns {Promise<unknown[]>}
   */
  async function fetchAllPlayersPages(teamId, season) {
    const all = [];
    let page = 1;
    let totalPages = 1;
    for (;;) {
      const data = await request('/players', { team: teamId, season, page });
      const chunk = Array.isArray(data.response) ? data.response : [];
      all.push(...chunk);
      totalPages = data.paging?.total ?? 1;
      if (page >= totalPages) break;
      page += 1;
    }
    return all;
  }

  /**
   * @param {unknown} row
   */
  function mapPlayerRow(row, teamName, leagueName, venueName, location) {
    const p = row?.player;
    if (!p || p.id == null) return null;
    const externalId = Number(p.id);
    if (!Number.isFinite(externalId)) return null;

    const stats = row?.statistics != null ? row.statistics : undefined;
    let position;
    if (Array.isArray(row?.statistics) && row.statistics[0]?.games?.position != null) {
      position = String(row.statistics[0].games.position);
    } else if (p.position != null) {
      position = String(p.position);
    } else {
      position = 'Unknown';
    }

    const name = p.name ? String(p.name) : `Player ${externalId}`;
    const image = p.photo ? String(p.photo) : undefined;

    return {
      name,
      team: teamName,
      league: leagueName,
      image,
      externalId,
      position,
      stats,
      venueName,
      location,
    };
  }

  /**
   * @param {{ leagueId: number, teamId: number, season: number }} params
   */
  async function buildImportPayloads(params) {
    const leagueId = Number(params.leagueId);
    const teamId = Number(params.teamId);
    const season = Number(params.season);
    if (![leagueId, teamId, season].every((n) => Number.isFinite(n))) {
      throw new ApiFootballError('leagueId, teamId, and season must be finite numbers', 400);
    }

    const { leagueName } = await assertLeagueBelongsToTeam(teamId, leagueId, season);
    const teamRow = await fetchTeam(teamId);
    let venueLabel = teamRow.venueName;
    /** @type {{ type: 'Point', coordinates: [number, number] }} */
    let location;
    if (teamRow.venueId != null && Number.isFinite(teamRow.venueId)) {
      const pt = await fetchVenuePoint(teamRow.venueId);
      location = { type: 'Point', coordinates: [pt.lng, pt.lat] };
      if (pt.venueName) venueLabel = pt.venueName;
    } else {
      throw new ApiFootballError('Team has no venue id; cannot resolve coordinates', 422);
    }

    const rawPlayers = await fetchAllPlayersPages(teamId, season);
    const players = [];
    for (const row of rawPlayers) {
      const doc = mapPlayerRow(row, teamRow.teamName, leagueName, venueLabel, location);
      if (doc) players.push(doc);
    }

    return { players, teamName: teamRow.teamName, leagueName, venueName: venueLabel };
  }

  return {
    request,
    assertLeagueBelongsToTeam,
    fetchTeam,
    fetchVenuePoint,
    fetchAllPlayersPages,
    buildImportPayloads,
  };
}

let defaultService;

function getApiFootballService() {
  if (!defaultService) {
    defaultService = createApiFootballService();
  }
  return defaultService;
}

module.exports = {
  createApiFootballService,
  getApiFootballService,
  ApiFootballError,
};
