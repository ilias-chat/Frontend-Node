const { GrokError } = require('../services/grokService');
const { LineupError, suggestLineupFromDb, VALID_FORMATIONS } = require('../services/lineupService');

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function suggestLineup(req, res, next) {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const formation = body.formation != null ? String(body.formation).trim() : '';

    if (!formation) {
      return res.status(400).json({ error: 'formation is required' });
    }

    if (!VALID_FORMATIONS.has(formation)) {
      return res.status(400).json({
        error: `Invalid formation. Use one of: ${[...VALID_FORMATIONS].join(', ')}`,
      });
    }

    const grokService = req.grokService;
    const result = await suggestLineupFromDb({
      formation,
      grokService,
    });

    return res.json(result);
  } catch (err) {
    if (err instanceof LineupError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    if (err instanceof GrokError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    return next(err);
  }
}

module.exports = { suggestLineup };
