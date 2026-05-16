const mongoose = require('mongoose');
const Player = require('../models/Player');
const { ApiFootballError } = require('../services/apiFootballService');

/** Fields written on import upsert (`image` only when API-Football provides a photo URL). */
function buildPlayerImportSet(doc) {
  const set = {
    name: doc.name,
    team: doc.team,
    league: doc.league,
    externalId: doc.externalId,
    position: doc.position,
    stats: doc.stats,
    venueName: doc.venueName,
    location: doc.location,
  };
  if (doc.image) {
    set.image = doc.image;
  }
  return set;
}

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @param {{ buildImportPayloads: (p: { leagueId: number, teamId: number, season: number }) => Promise<{ players: object[], teamName: string, leagueName: string, venueName: string }> }} apiFootballService
 */
async function importPlayers(req, res, next, apiFootballService) {
  try {
    const { leagueId, teamId, season } = req.body || {};
    if (leagueId == null || teamId == null || season == null) {
      return res.status(400).json({ error: 'leagueId, teamId, and season are required' });
    }

    const { players, teamName, leagueName, venueName } = await apiFootballService.buildImportPayloads({
      leagueId: Number(leagueId),
      teamId: Number(teamId),
      season: Number(season),
    });

    if (players.length === 0) {
      return res.status(200).json({
        inserted: 0,
        updated: 0,
        matched: 0,
        teamName,
        leagueName,
        venueName,
        message: 'No players returned for this squad',
      });
    }

    const ops = players.map((doc) => ({
      updateOne: {
        filter: { externalId: doc.externalId },
        update: {
          $set: buildPlayerImportSet(doc),
          $setOnInsert: { registrationDate: new Date() },
        },
        upsert: true,
      },
    }));

    const result = await Player.bulkWrite(ops, { ordered: false });
    const inserted = result.upsertedCount ?? 0;
    const updated = result.modifiedCount ?? 0;
    const matched = result.matchedCount ?? 0;

    return res.status(200).json({
      inserted,
      updated,
      matched,
      teamName,
      leagueName,
      venueName,
      playersProcessed: players.length,
    });
  } catch (err) {
    if (err instanceof ApiFootballError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    return next(err);
  }
}

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function deletePlayer(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid player id' });
    }
    const deleted = await Player.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Player not found' });
    }
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
}

module.exports = { importPlayers, deletePlayer };
