const Player = require('../models/Player');

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

function parsePositiveInt(v, fallback) {
  const n = Number.parseInt(String(v), 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return n;
}

function parseLimit(v) {
  const n = parsePositiveInt(v, DEFAULT_LIMIT);
  return Math.min(n, MAX_LIMIT);
}

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function listMyComments(req, res, next) {
  try {
    const authorUid = req.firebase.uid;
    const page = parsePositiveInt(req.query.page, DEFAULT_PAGE);
    const limit = parseLimit(req.query.limit);
    const skip = (page - 1) * limit;

    const [facet] = await Player.aggregate([
      { $match: { comments: { $elemMatch: { author: authorUid } } } },
      { $unwind: '$comments' },
      { $match: { 'comments.author': authorUid } },
      { $sort: { 'comments.createdAt': -1 } },
      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: limit },
            {
              $project: {
                _id: '$comments._id',
                text: '$comments.text',
                rating: '$comments.rating',
                author: '$comments.author',
                authorName: '$comments.authorName',
                createdAt: '$comments.createdAt',
                player: {
                  _id: '$_id',
                  name: '$name',
                  team: '$team',
                  league: '$league',
                  image: '$image',
                },
              },
            },
          ],
          meta: [{ $count: 'total' }],
        },
      },
    ]);

    const data = (facet?.data ?? []).map((row) => ({
      _id: row._id?.toString(),
      text: row.text,
      rating: row.rating,
      author: row.author,
      authorName: row.authorName,
      createdAt: row.createdAt,
      player: row.player
        ? {
            _id: row.player._id?.toString(),
            name: row.player.name,
            team: row.player.team,
            league: row.player.league,
            image: row.player.image,
          }
        : undefined,
    }));

    const total = facet?.meta?.[0]?.total ?? 0;

    return res.json({ data, page, limit, total });
  } catch (err) {
    return next(err);
  }
}

module.exports = { listMyComments };
