/**
 * AI lineup client — supports xAI Grok (xai- keys) and Groq (gsk_ keys).
 * Grok and Groq are different services; keys are not interchangeable.
 * @see https://docs.x.ai/developers/rest-api-reference/inference/chat
 * @see https://console.groq.com/docs/quickstart
 */

const XAI_DEFAULT_MODEL = 'grok-3-mini';
const XAI_DEFAULT_BASE = 'https://api.x.ai/v1';
const GROQ_DEFAULT_MODEL = 'llama-3.3-70b-versatile';
const GROQ_DEFAULT_BASE = 'https://api.groq.com/openai/v1';

/**
 * @param {string} apiKey
 */
function resolveProvider(apiKey) {
  const key = String(apiKey).trim();
  if (key.startsWith('gsk_')) {
    return {
      name: 'Groq',
      baseUrl: (process.env.GROQ_API_BASE ?? GROQ_DEFAULT_BASE).replace(/\/+$/, ''),
      model: process.env.GROQ_MODEL ?? process.env.GROK_MODEL ?? GROQ_DEFAULT_MODEL,
    };
  }
  return {
    name: 'xAI Grok',
    baseUrl: (process.env.GROK_API_BASE ?? XAI_DEFAULT_BASE).replace(/\/+$/, ''),
    model: process.env.GROK_MODEL ?? XAI_DEFAULT_MODEL,
  };
}

class GrokError extends Error {
  /**
   * @param {string} message
   * @param {number} [statusCode=502]
   */
  constructor(message, statusCode = 502) {
    super(message);
    this.name = 'GrokError';
    this.statusCode = statusCode;
  }
}

/** @type {ReturnType<typeof createGrokService> | null} */
let singleton = null;

/**
 * @typedef {{ id: string, name: string, team: string, position?: string, avgRating?: number | null, reviewCount?: number, statsSummary?: string }} LineupPlayerInput
 * @typedef {{ formation: string, reasoning: string, starters: Array<{ playerId: string, slot: string, role?: string }>, bench: Array<{ playerId: string, slot?: string, role?: string }> }} LineupSuggestion
 */

/**
 * @param {{ apiKey?: string, model?: string, baseUrl?: string, fetch?: typeof fetch }} [cfg]
 */
function createGrokService(cfg = {}) {
  const apiKey = cfg.apiKey ?? process.env.GROK_API_KEY ?? process.env.GROQ_API_KEY;
  const fetchFn = cfg.fetch ?? fetch;

  function requireApiKey() {
    const key = apiKey != null ? String(apiKey).trim() : '';
    if (!key || key === 'your_grok_api_key_here') {
      throw new GrokError(
        'GROK_API_KEY is not configured. Add a Groq key (gsk_… from console.groq.com) or xAI Grok key (xai-… from console.x.ai) to .env and restart the server.',
        503
      );
    }
    return key;
  }

  function resolveRequestConfig(key) {
    if (cfg.baseUrl || cfg.model) {
      return {
        name: key.startsWith('gsk_') ? 'Groq' : 'xAI Grok',
        baseUrl: (cfg.baseUrl ?? process.env.GROK_API_BASE ?? XAI_DEFAULT_BASE).replace(/\/+$/, ''),
        model: cfg.model ?? process.env.GROK_MODEL ?? XAI_DEFAULT_MODEL,
      };
    }
    return resolveProvider(key);
  }

  /**
   * @param {LineupPlayerInput[]} players
   * @param {{ formation?: string }} [options]
   * @returns {Promise<LineupSuggestion>}
   */
  async function suggestLineup(players, options = {}) {
    const key = requireApiKey();
    const { name: providerName, baseUrl, model } = resolveRequestConfig(key);
    const formation = options.formation?.trim() || '4-4-2';
    const prompt = buildLineupPrompt(players, formation);
    const url = `${baseUrl}/chat/completions`;

    let res;
    try {
      res = await fetchFn(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.4,
          messages: [
            {
              role: 'system',
              content:
                'You are a football manager assistant. Respond with valid JSON only — no markdown fences or extra text.',
            },
            { role: 'user', content: prompt },
          ],
        }),
      });
    } catch (err) {
      throw new GrokError(`${providerName} request failed: ${err?.message || err}`, 502);
    }

    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg =
        body?.error?.message ||
        (typeof body?.error === 'string' ? body.error : null) ||
        `${providerName} API returned HTTP ${res.status}`;
      throw new GrokError(String(msg), res.status >= 400 && res.status < 500 ? res.status : 502);
    }

    const text = body?.choices?.[0]?.message?.content;
    if (!text || typeof text !== 'string') {
      throw new GrokError(`${providerName} returned an empty lineup response.`, 502);
    }

    let parsed;
    try {
      parsed = parseJsonFromText(text);
    } catch {
      throw new GrokError(`${providerName} returned invalid JSON for the lineup.`, 502);
    }

    return normalizeLineupSuggestion(parsed, formation);
  }

  return { suggestLineup };
}

/**
 * @param {string} text
 */
function parseJsonFromText(text) {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) {
      return JSON.parse(fenced[1].trim());
    }
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error('No JSON object found');
  }
}

/**
 * @param {LineupPlayerInput[]} players
 * @param {string} formation
 */
function buildLineupPrompt(players, formation) {
  const roster = players.map((p) => ({
    id: p.id,
    name: p.name,
    team: p.team,
    position: p.position || 'Unknown',
    avgRating: p.avgRating ?? null,
    reviewCount: p.reviewCount ?? 0,
    statsSummary: p.statsSummary || null,
  }));

  return [
    'Pick the best starting XI from the full local player database roster below.',
    `Use formation ${formation} unless the roster cannot support it — then pick the closest valid formation and explain why.`,
    'Rules:',
    '- Pick the strongest possible team from the entire roster (all teams and leagues).',
    '- Pick exactly 11 starters with distinct player ids from the roster.',
    '- Include exactly one goalkeeper in starters when possible.',
    '- Prefer players with higher avgRating, stronger stats, and positions that fit the formation.',
    '- bench may include up to 7 substitutes from remaining roster players (optional).',
    '- Every playerId MUST be copied exactly from the roster id field.',
    '',
    'Respond with JSON only, no markdown, using this shape:',
    '{"formation":"4-4-2","reasoning":"...","starters":[{"playerId":"...","slot":"GK","role":"Goalkeeper"}],"bench":[{"playerId":"...","slot":"SUB1","role":"Midfielder"}]}',
    '',
    'Roster:',
    JSON.stringify(roster, null, 2),
  ].join('\n');
}

/**
 * @param {unknown} raw
 * @param {string} defaultFormation
 * @returns {LineupSuggestion}
 */
function normalizeLineupSuggestion(raw, defaultFormation) {
  if (!raw || typeof raw !== 'object') {
    throw new GrokError('Grok lineup JSON was not an object.', 502);
  }

  const obj = /** @type {Record<string, unknown>} */ (raw);
  const formation =
    typeof obj.formation === 'string' && obj.formation.trim()
      ? obj.formation.trim()
      : defaultFormation;
  const reasoning = typeof obj.reasoning === 'string' ? obj.reasoning.trim() : '';

  const starters = normalizeLineupPlayers(obj.starters, 'starters');
  const bench = normalizeLineupPlayers(obj.bench, 'bench');

  return { formation, reasoning, starters, bench };
}

/**
 * @param {unknown} value
 * @param {string} label
 */
function normalizeLineupPlayers(value, label) {
  if (value == null) return [];
  if (!Array.isArray(value)) {
    throw new GrokError(`Grok lineup ${label} must be an array.`, 502);
  }

  return value.map((item, index) => {
    if (!item || typeof item !== 'object') {
      throw new GrokError(`Grok lineup ${label}[${index}] is invalid.`, 502);
    }
    const row = /** @type {Record<string, unknown>} */ (item);
    const playerId = row.playerId != null ? String(row.playerId).trim() : '';
    if (!playerId) {
      throw new GrokError(`Grok lineup ${label}[${index}] is missing playerId.`, 502);
    }
    return {
      playerId,
      slot: row.slot != null ? String(row.slot).trim() : '',
      role: row.role != null ? String(row.role).trim() : undefined,
    };
  });
}

function getGrokService() {
  if (!singleton) {
    singleton = createGrokService();
  }
  return singleton;
}

module.exports = {
  GrokError,
  createGrokService,
  getGrokService,
  resolveProvider,
  buildLineupPrompt,
  parseJsonFromText,
};
