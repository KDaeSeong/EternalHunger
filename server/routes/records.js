const express = require('express');
const mongoose = require('mongoose');

const Character = require('../models/Characters');
const GameLog = require('../models/GameLog');
const TeamRecord = require('../models/TeamRecord');

const router = express.Router();

function getUserIdOrRespond(req, res) {
  const raw = req.user?.id ?? req.user?._id ?? req.user?.userId;
  const text = raw != null ? String(raw) : '';
  if (!text || !mongoose.Types.ObjectId.isValid(text)) {
    res.status(401).json({ error: '로그인이 필요합니다.' });
    return null;
  }
  return new mongoose.Types.ObjectId(text);
}

function toNonNegativeInt(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function mapCharacterRecord(row) {
  const records = row?.records || {};
  const gamesPlayed = toNonNegativeInt(records.gamesPlayed);
  const totalWins = toNonNegativeInt(records.totalWins);
  const totalKills = toNonNegativeInt(records.totalKills);
  const totalAssists = toNonNegativeInt(records.totalAssists);
  const deathCount = toNonNegativeInt(records.deathCount);
  return {
    id: String(row?._id || ''),
    name: row?.name || '이름 없음',
    previewImage: row?.previewImage || '',
    weaponType: row?.weaponType || '',
    gamesPlayed,
    totalWins,
    totalKills,
    totalAssists,
    deathCount,
    winRate: gamesPlayed > 0 ? totalWins / gamesPlayed : 0,
    kda: Math.round(((totalKills + totalAssists) / Math.max(1, deathCount)) * 100) / 100,
    createdAt: row?.createdAt || null,
  };
}

function mapTeamRecord(row) {
  const gamesPlayed = toNonNegativeInt(row?.gamesPlayed);
  const totalWins = toNonNegativeInt(row?.totalWins);
  const totalKills = toNonNegativeInt(row?.totalKills);
  const totalAssists = toNonNegativeInt(row?.totalAssists);
  const deathCount = toNonNegativeInt(row?.deathCount);
  return {
    id: String(row?._id || ''),
    teamKey: row?.teamKey || '',
    teamName: row?.teamName || '',
    rosterIds: Array.isArray(row?.rosterIds) ? row.rosterIds.map(String).filter(Boolean) : [],
    rosterNames: Array.isArray(row?.rosterNames) ? row.rosterNames.map(String).filter(Boolean) : [],
    gamesPlayed,
    totalWins,
    totalKills,
    totalAssists,
    deathCount,
    winRate: gamesPlayed > 0 ? totalWins / gamesPlayed : 0,
    kda: Math.round(((totalKills + totalAssists) / Math.max(1, deathCount)) * 100) / 100,
    lastMatchAt: row?.lastMatchAt || null,
    createdAt: row?.createdAt || null,
  };
}

function buildTotals(rows = []) {
  return rows.reduce((acc, row) => ({
    gamesPlayed: acc.gamesPlayed + toNonNegativeInt(row.gamesPlayed),
    totalWins: acc.totalWins + toNonNegativeInt(row.totalWins),
    totalKills: acc.totalKills + toNonNegativeInt(row.totalKills),
    totalAssists: acc.totalAssists + toNonNegativeInt(row.totalAssists),
    deathCount: acc.deathCount + toNonNegativeInt(row.deathCount),
  }), { gamesPlayed: 0, totalWins: 0, totalKills: 0, totalAssists: 0, deathCount: 0 });
}

function mapGameRun(row) {
  const summary = row?.summary || {};
  const participants = Array.isArray(row?.participants) ? row.participants : [];
  const sortedParticipants = [...participants].sort((a, b) => (
    Number(b?.killCount || 0) - Number(a?.killCount || 0) ||
    Number(b?.assistCount || 0) - Number(a?.assistCount || 0) ||
    String(a?.name || '').localeCompare(String(b?.name || ''), 'ko')
  ));
  const winnerTeamMembers = participants
    .filter((p) => p?.isWinner)
    .map((p) => p?.name)
    .filter(Boolean);
  return {
    id: String(row?._id || ''),
    title: row?.title || '',
    playedAt: row?.playedAt || null,
    winnerName: row?.winnerName || '',
    winnerTeamId: row?.winnerTeamId || '',
    winnerTeamName: row?.winnerTeamName || '',
    winnerTeamMembers,
    matchMode: row?.matchMode || '',
    teamSize: toNonNegativeInt(row?.teamSize),
    participantCount: toNonNegativeInt(summary.participantCount || participants.length),
    teamCount: toNonNegativeInt(summary.teamCount),
    aliveCount: toNonNegativeInt(summary.aliveCount),
    totalKills: toNonNegativeInt(summary.totalKills),
    totalAssists: toNonNegativeInt(summary.totalAssists),
    totalDeaths: toNonNegativeInt(summary.totalDeaths),
    logCount: toNonNegativeInt(summary.logCount || row?.fullLog?.length),
    runEventCount: toNonNegativeInt(summary.runEventCount),
    droneCalls: toNonNegativeInt(summary.droneCalls),
    kioskGains: toNonNegativeInt(summary.kioskGains),
    craftCount: toNonNegativeInt(summary.craftCount),
    totalRevives: toNonNegativeInt(summary.totalRevives),
    totalFlees: toNonNegativeInt(summary.totalFlees),
    legendCount: toNonNegativeInt(summary.legendCount),
    transCount: toNonNegativeInt(summary.transCount),
    firstLegendText: summary.firstLegendText || '',
    firstTransText: summary.firstTransText || '',
    actionLine: summary.actionLine || '',
    chaseLine: summary.chaseLine || '',
    topBlocked: summary.topBlocked || '',
    topDeferred: summary.topDeferred || '',
    topObjectiveMoves: summary.topObjectiveMoves || '',
    topParticipants: sortedParticipants.slice(0, 5).map((p) => ({
      id: String(p?.charId || ''),
      name: p?.name || '',
      kills: toNonNegativeInt(p?.killCount),
      assists: toNonNegativeInt(p?.assistCount),
      alive: p?.alive !== false,
      teamName: p?.teamName || '',
    })),
  };
}

function buildRunTotals(rows = []) {
  return rows.reduce((acc, row) => ({
    gamesPlayed: acc.gamesPlayed + 1,
    totalKills: acc.totalKills + toNonNegativeInt(row.totalKills),
    totalAssists: acc.totalAssists + toNonNegativeInt(row.totalAssists),
    totalDeaths: acc.totalDeaths + toNonNegativeInt(row.totalDeaths),
    totalRevives: acc.totalRevives + toNonNegativeInt(row.totalRevives),
    droneCalls: acc.droneCalls + toNonNegativeInt(row.droneCalls),
    kioskGains: acc.kioskGains + toNonNegativeInt(row.kioskGains),
    craftCount: acc.craftCount + toNonNegativeInt(row.craftCount),
  }), {
    gamesPlayed: 0,
    totalKills: 0,
    totalAssists: 0,
    totalDeaths: 0,
    totalRevives: 0,
    droneCalls: 0,
    kioskGains: 0,
    craftCount: 0,
  });
}

router.get('/', async (req, res) => {
  try {
    const userId = getUserIdOrRespond(req, res);
    if (!userId) return;

    const [charactersRaw, teamsRaw, runsRaw] = await Promise.all([
      Character.find({ userId }, 'name previewImage weaponType records createdAt').lean(),
      TeamRecord.find({ userId }).sort({ totalWins: -1, gamesPlayed: -1, totalKills: -1, updatedAt: -1 }).lean(),
      GameLog.find({ userId })
        .select('title playedAt winnerName winnerTeamId winnerTeamName matchMode teamSize participants fullLog summary')
        .sort({ playedAt: -1, _id: -1 })
        .limit(30)
        .lean(),
    ]);

    const characters = charactersRaw
      .map(mapCharacterRecord)
      .sort((a, b) => (
        (b.totalWins - a.totalWins) ||
        (b.totalKills - a.totalKills) ||
        (b.totalAssists - a.totalAssists) ||
        String(a.name).localeCompare(String(b.name), 'ko')
      ));
    const teams = teamsRaw.map(mapTeamRecord);
    const runs = runsRaw.map(mapGameRun);

    res.json({
      characters,
      teams,
      runs,
      totals: {
        characters: buildTotals(characters),
        teams: buildTotals(teams),
        runs: buildRunTotals(runs),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '기록소 로드 실패' });
  }
});

module.exports = router;
