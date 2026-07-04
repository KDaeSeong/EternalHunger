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

function toNonNegativeInt(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function topEntries(acc, limit = 3) {
  return Object.entries(acc || {})
    .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0) || String(a[0]).localeCompare(String(b[0]), 'ko'))
    .slice(0, Math.max(1, Number(limit || 3)));
}

function stampText(at) {
  if (!at || typeof at !== 'object') return '';
  const day = Number(at.day || 0);
  const phase = String(at.phase || '').toLowerCase();
  if (day <= 0) return '';
  const phaseLabel = phase.includes('night') ? '밤' : '낮';
  return `${day}일차 ${phaseLabel}`;
}

function compactRunEventsForStorage(runEvents) {
  const allowedKeys = [
    'kind',
    'subkind',
    'who',
    'whoId',
    'whoName',
    'name',
    'source',
    'sourceKind',
    'src',
    'itemId',
    'qty',
    'tier',
    'chosen',
    'reason',
    'outcome',
    'objectiveType',
    'objectiveSubkind',
    'zoneId',
    'from',
    'to',
    'fromMapId',
    'toMapId',
    'toZoneId',
    'chaserId',
    'chaserName',
    'skill',
    'mode',
    'heal',
    'damage',
    'preDamage',
    'pEscape',
    'pChase',
    'pCatch',
    'tacUsed',
    'fatal',
    'escaped',
    'caught',
  ];
  return (Array.isArray(runEvents) ? runEvents : [])
    .slice(-2000)
    .map((event) => {
      if (!event || typeof event !== 'object') return null;
      const out = {};
      for (const key of allowedKeys) {
        if (event[key] === undefined || event[key] === null) continue;
        if (typeof event[key] === 'object') continue;
        out[key] = typeof event[key] === 'string' ? event[key].slice(0, 180) : event[key];
      }
      if (event.at && typeof event.at === 'object') {
        out.at = {
          day: Number(event.at.day || 0),
          phase: String(event.at.phase || '').slice(0, 20),
          sec: Number(event.at.sec || 0),
        };
      }
      if (Array.isArray(event.blockedReasons)) out.blockedReasons = event.blockedReasons.slice(0, 6).map((reason) => String(reason || '').slice(0, 120));
      return Object.keys(out).length ? out : null;
    })
    .filter(Boolean);
}

function buildRunSummary({ fullLogs, matchMode, participants, runEvents }) {
  const safeParticipants = Array.isArray(participants) ? participants : [];
  const events = Array.isArray(runEvents) ? runEvents : [];
  const teamIds = new Set(safeParticipants
    .map((p) => cleanText(p.teamId, cleanText(p.charId, '')))
    .filter(Boolean));
  const blockedAcc = {};
  const deferredAcc = {};
  const objectiveAcc = {};
  const legendWho = new Set();
  const transWho = new Set();
  let firstLegendAt = null;
  let firstTransAt = null;
  let droneCalls = 0;
  let kioskGains = 0;
  let craftCount = 0;
  let totalRevives = 0;
  let totalFlees = 0;
  let queued = 0;
  let blocked = 0;
  let fleeChosen = 0;
  let moveChosen = 0;
  let routeFarmChosen = 0;
  let craftChosen = 0;
  let droneChosen = 0;
  let kioskChosen = 0;
  let escapeFail = 0;
  let escapeNoChase = 0;
  let escaped = 0;
  let caught = 0;

  for (const event of events) {
    if (!event || typeof event !== 'object') continue;
    const kind = String(event.kind || '');
    const who = cleanText(event.who, '');
    const source = cleanText(event.source, cleanText(event.src, ''));
    if (kind === 'gain') {
      if (source === 'drone') droneCalls += 1;
      if (source === 'kiosk') kioskGains += 1;
    }
    if (kind === 'craft') {
      craftCount += 1;
      const tier = Number(event.tier || 0);
      if (tier >= 5) {
        if (!firstLegendAt) firstLegendAt = event.at || null;
        if (who) legendWho.add(who);
      }
      if (tier >= 6) {
        if (!firstTransAt) firstTransAt = event.at || null;
        if (who) transWho.add(who);
      }
    }
    if (kind === 'revive') totalRevives += 1;
    if (kind === 'move') {
      const reason = String(event.reason || '');
      if (reason.includes('escape') || reason.includes('flee')) totalFlees += 1;
    }
    if (kind === 'queue') {
      queued += 1;
      const chosen = String(event.chosen || '');
      if (chosen === 'flee') fleeChosen += 1;
      else if (chosen === 'moveTo') moveChosen += 1;
      else if (chosen === 'routeFarm') routeFarmChosen += 1;
      else if (chosen === 'craft') craftChosen += 1;
      else if (chosen === 'droneOrder') droneChosen += 1;
      else if (chosen.startsWith('kiosk')) kioskChosen += 1;
      const objectiveKey = cleanText(event.objectiveSubkind, cleanText(event.objectiveType, ''));
      if (objectiveKey) objectiveAcc[objectiveKey] = (objectiveAcc[objectiveKey] || 0) + 1;
      for (const reason of Array.isArray(event.blockedReasons) ? event.blockedReasons : []) {
        const key = cleanText(reason, '');
        if (!key) continue;
        blocked += 1;
        blockedAcc[key] = (blockedAcc[key] || 0) + 1;
        if (key.startsWith('deferred:')) {
          const deferred = key.replace('deferred:', '');
          deferredAcc[deferred] = (deferredAcc[deferred] || 0) + 1;
        }
      }
    }
    if (kind === 'chase') {
      const outcome = String(event.outcome || '');
      if (outcome === 'escape_fail') escapeFail += 1;
      else if (outcome === 'escape_no_chase') escapeNoChase += 1;
      else if (outcome === 'escaped_after_chase' || outcome === 'blink_escape') escaped += 1;
      else if (outcome === 'caught') caught += 1;
    }
  }

  const topBlocked = topEntries(blockedAcc, 4).map(([reason, count]) => `${reason}x${count}`).join(', ');
  const topDeferred = topEntries(deferredAcc, 3).map(([reason, count]) => `${reason}x${count}`).join(', ');
  const topObjectiveMoves = topEntries(objectiveAcc, 3).map(([key, count]) => `${key}x${count}`).join(', ');
  const totalKills = safeParticipants.reduce((sum, p) => sum + toNonNegativeInt(p.killCount), 0);
  const totalAssists = safeParticipants.reduce((sum, p) => sum + toNonNegativeInt(p.assistCount), 0);
  const totalDeaths = safeParticipants.reduce((sum, p) => sum + (p.alive === false ? 1 : 0), 0);

  return {
    participantCount: safeParticipants.length,
    teamCount: String(matchMode || '').toLowerCase() === 'solo' ? safeParticipants.length : teamIds.size,
    aliveCount: safeParticipants.filter((p) => p.alive !== false).length,
    totalKills,
    totalAssists,
    totalDeaths,
    logCount: Array.isArray(fullLogs) ? fullLogs.length : 0,
    runEventCount: events.length,
    droneCalls,
    kioskGains,
    craftCount,
    totalRevives,
    totalFlees,
    legendCount: legendWho.size,
    transCount: transWho.size,
    firstLegendText: stampText(firstLegendAt),
    firstTransText: stampText(firstTransAt),
    actionLine: `queue ${queued} · blocked ${blocked} · flee ${fleeChosen} · move ${moveChosen} · route ${routeFarmChosen} · craft ${craftChosen} · drone ${droneChosen} · kiosk ${kioskChosen}`,
    chaseLine: `escapeFail ${escapeFail} · noChase ${escapeNoChase} · escaped ${escaped} · caught ${caught}`,
    topBlocked,
    topDeferred,
    topObjectiveMoves,
  };
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
    const { winnerId, winnerTeamId, killCounts, assistCounts, fullLogs, participants, matchMode, runEvents, teamSize } = req.body || {};
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
    const fullLog = Array.isArray(fullLogs) ? fullLogs.map(String) : [];
    const storedRunEvents = compactRunEventsForStorage(runEvents);
    const summaryDoc = buildRunSummary({
      fullLogs: fullLog,
      matchMode,
      participants: summary,
      runEvents: storedRunEvents,
    });

    const winnerTeamPayload = summary.find((s) => s.isWinner && s.teamId === resolvedWinnerTeamId) || summary.find((s) => s.isWinner);
    const logDoc = await new GameLog({
      userId: req.user.id,
      title,
      winnerName: winner?.name || winnerFromPayload?.name || 'Unknown',
      winnerTeamId: resolvedWinnerTeamId,
      winnerTeamName: cleanText(winnerTeamPayload?.teamName, ''),
      matchMode: cleanText(matchMode, ''),
      teamSize: Number(teamSize || 0),
      participants: summary,
      fullLog,
      runEvents: storedRunEvents,
      summary: summaryDoc,
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
