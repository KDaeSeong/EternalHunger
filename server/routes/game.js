// server/routes/game.js
const express = require('express');
const router = express.Router();

const GameLog = require('../models/GameLog');
const Character = require('../models/Characters');
const TeamRecord = require('../models/TeamRecord');

function actorId(value) {
  return String(value?._id || value?.charId || value?.id || '').trim();
}

function cleanText(value, fallback = '') {
  const text = String(value || '').trim();
  return text || fallback;
}

function cleanStringList(list) {
  return (Array.isArray(list) ? list : [])
    .map((value) => String(value || '').trim())
    .filter(Boolean);
}

function uniqueStrings(list) {
  return [...new Set(cleanStringList(list))];
}

function readAliveFlag(participant) {
  if (participant?.alive !== undefined) return Boolean(participant.alive);
  if (participant?.isAlive !== undefined) return Boolean(participant.isAlive);
  if (participant?.dead !== undefined) return !participant.dead;
  return null;
}

function buildTeamRecordOps(summary, existingIds, userId, matchMode = '') {
  const grouped = new Map();
  const mode = String(matchMode || '').toLowerCase();

  for (const participant of summary) {
    if (!existingIds.has(String(participant.charId))) continue;
    const fallbackTeamId = `solo:${participant.charId}`;
    const teamId = cleanText(participant.teamId, fallbackTeamId);
    if (!grouped.has(teamId)) grouped.set(teamId, []);
    grouped.get(teamId).push(participant);
  }

  const ops = [];
  for (const members of grouped.values()) {
    const rosterIdSeed = members.flatMap((member) => member.rosterIds?.length ? member.rosterIds : [member.charId]);
    const rosterIds = uniqueStrings(rosterIdSeed).filter((id) => existingIds.has(String(id))).sort();
    if (rosterIds.length <= 1 || mode === 'solo') continue;

    const nameById = new Map(members.map((member) => [String(member.charId), member.name]).filter(([id]) => id));
    for (const member of members) {
      const ids = Array.isArray(member.rosterIds) ? member.rosterIds : [];
      const names = Array.isArray(member.rosterNames) ? member.rosterNames : [];
      ids.forEach((id, index) => {
        if (id && names[index] && !nameById.has(String(id))) nameById.set(String(id), names[index]);
      });
    }

    const rosterNames = rosterIds.map((id) => cleanText(nameById.get(String(id)), String(id))).filter(Boolean);
    const teamName = cleanText(
      members.find((member) => member.teamName)?.teamName,
      rosterNames.join(' / ')
    );
    const teamKey = rosterIds.join(':');
    const totalKills = members.reduce((sum, member) => sum + Number(member.killCount || 0), 0);
    const totalAssists = members.reduce((sum, member) => sum + Number(member.assistCount || 0), 0);
    const deathCount = members.reduce((sum, member) => sum + (member.alive === false ? 1 : 0), 0);
    const won = members.some((member) => member.isWinner);

    ops.push({
      updateOne: {
        filter: { userId, teamKey },
        update: {
          $set: {
            teamName,
            rosterIds,
            rosterNames,
            lastMatchAt: new Date(),
            updatedAt: new Date(),
          },
          $setOnInsert: { createdAt: new Date() },
          $inc: {
            gamesPlayed: 1,
            totalWins: won ? 1 : 0,
            totalKills,
            totalAssists,
            deathCount,
          },
        },
        upsert: true,
      },
    });
  }

  return ops;
}

/**
 * ✅ 게임 종료 기록 저장
 * POST /api/game/end
 * body: { winnerId, winnerTeamId, killCounts, assistCounts, fullLogs, participants }
 */
router.post('/end', async (req, res) => {
  try {
    const { winnerId, winnerTeamId, killCounts, assistCounts, fullLogs, participants, matchMode } = req.body || {};
    if (!winnerId) return res.status(400).json({ error: "winnerId가 필요합니다." });

    const winner = await Character.findOne({ _id: winnerId, userId: req.user.id }, '_id name')
      || await Character.findById(winnerId, '_id name')
      || { _id: winnerId, name: '' };
    if (!winner) return res.status(404).json({ error: "우승 캐릭터를 찾을 수 없습니다." });

    const count = await GameLog.countDocuments();
    const title = `제 ${count + 1}회 아레나`;

    const safeParticipants = Array.isArray(participants) ? participants : [];
    const winnerPayload = safeParticipants.find(p => actorId(p) === String(winnerId));
    const resolvedWinnerTeamId = cleanText(winnerTeamId, cleanText(winnerPayload?.teamId || winnerPayload?.matchTeamId, ''));
    const summary = safeParticipants.map(p => {
      const id = actorId(p);
      const k = killCounts && id ? (killCounts[id] || 0) : 0;
      const a = assistCounts && id ? (assistCounts[id] || 0) : 0;
      const teamId = cleanText(p.teamId || p.matchTeamId, '');
      const rosterIds = uniqueStrings(p.rosterIds || p.matchTeamRosterIds || []);
      const rosterNames = uniqueStrings(p.rosterNames || p.matchTeamRosterNames || []);
      return {
        charId: id,
        name: p.name || "Unknown",
        killCount: Number(k || 0),
        assistCount: Number(a || 0),
        isWinner: id === String(winnerId) || Boolean(resolvedWinnerTeamId && teamId === resolvedWinnerTeamId),
        alive: readAliveFlag(p),
        teamId,
        teamName: cleanText(p.teamName || p.matchTeamName, ''),
        rosterIds,
        rosterNames
      };
    });

    const winnerFromPayload = summary.find(s => String(s.charId) === String(winnerId));
    const logDoc = await new GameLog({
      title,
      winnerName: winner?.name || winnerFromPayload?.name || 'Unknown',
      participants: summary,
      fullLog: Array.isArray(fullLogs) ? fullLogs.map(String) : []
    }).save();

    // ✅ 캐릭터 누적 기록 반영 (내 계정 캐릭터에만)
    // - participants는 프론트가 보내는 객체라서 userId 검증을 위해 DB에서 조회 후 업데이트합니다.
    const participantIds = summary.map(s => s.charId).filter(Boolean);

    const chars = await Character.find({ _id: { $in: participantIds }, userId: req.user.id }, '_id name');
    const existingIds = new Set(chars.map(c => String(c._id)));

    // 개별 업데이트
    const ops = summary
      .filter(s => existingIds.has(String(s.charId)))
      .map(s => ({
        updateOne: {
          filter: { _id: s.charId, userId: req.user.id },
          update: {
            $inc: {
              'records.gamesPlayed': 1,
              'records.totalKills': Number(s.killCount || 0),
              'records.totalAssists': Number(s.assistCount || 0),
              'records.totalWins': s.isWinner ? 1 : 0,
              'records.deathCount': s.alive === false ? 1 : 0
            }
          }
        }
      }));

    if (ops.length > 0) await Character.bulkWrite(ops);

    const teamOps = buildTeamRecordOps(summary, existingIds, req.user.id, matchMode);
    if (teamOps.length > 0) await TeamRecord.bulkWrite(teamOps);

    res.json({ message: "게임 로그 저장 완료", gameLogId: logDoc._id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "게임 로그 저장 실패" });
  }
});

module.exports = router;
