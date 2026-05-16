const mongoose = require('mongoose');
const Player = require('../models/Player');
const User = require('../models/User');

/** Human-readable label for scout reports; keeps author as Firebase UID for ACL. */
function resolveAuthorDisplayName(user, firebase) {
  const fromProfile = user?.name?.trim();
  if (fromProfile) {
    return fromProfile;
  }
  const email = user?.email?.trim() || firebase?.email?.trim();
  if (email && email.includes('@')) {
    return email.split('@')[0];
  }
  return 'Fan';
}

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function listComments(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid player id' });
    }
    const player = await Player.findById(id).select('comments').lean();
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }
    return res.json({ data: player.comments || [] });
  } catch (err) {
    return next(err);
  }
}

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function addComment(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid player id' });
    }
    const { text, rating, lat, lng } = req.body || {};
    if (text == null || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'text is required' });
    }
    const r = Number(rating);
    if (!Number.isFinite(r) || r < 0 || r > 5) {
      return res.status(400).json({ error: 'rating must be a number between 0 and 5' });
    }
    const latitude = Number(lat);
    const longitude = Number(lng);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return res.status(400).json({ error: 'lat and lng must be finite numbers' });
    }
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return res.status(400).json({ error: 'lat or lng out of range' });
    }

    const location = {
      type: 'Point',
      coordinates: [longitude, latitude],
    };

    const user = await User.findOne({ firebaseUID: req.firebase.uid }).lean();
    const authorName = resolveAuthorDisplayName(user, req.firebase);

    const player = await Player.findByIdAndUpdate(
      id,
      {
        $push: {
          comments: {
            author: req.firebase.uid,
            authorName,
            text: text.trim(),
            rating: r,
            location,
          },
        },
      },
      { new: true, runValidators: true }
    );

    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const added = player.comments[player.comments.length - 1];
    return res.status(201).json(added);
  } catch (err) {
    return next(err);
  }
}

/**
 * Ensures the caller owns the comment or is a MongoDB admin.
 * @type {import('express').RequestHandler}
 */
async function assertCommentDeleteAllowed(req, res, next) {
  try {
    const { id, commentId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(commentId)) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    const player = await Player.findById(id).select('comments');
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }
    const comment = player.comments.id(commentId);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }
    if (comment.author === req.firebase.uid) {
      return next();
    }
    const user = await User.findOne({ firebaseUID: req.firebase.uid }).lean();
    if (user?.role === 'admin') {
      return next();
    }
    return res.status(403).json({ error: 'Forbidden' });
  } catch (err) {
    return next(err);
  }
}

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function deleteComment(req, res, next) {
  try {
    const { id, commentId } = req.params;
    await Player.updateOne({ _id: id }, { $pull: { comments: { _id: commentId } } });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listComments,
  addComment,
  assertCommentDeleteAllowed,
  deleteComment,
};
