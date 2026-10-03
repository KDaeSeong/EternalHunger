// server/routes/game.js
const express = require('express');
const router = express.Router();

const GameLog = require('../models/GameLog');
const Character = require('../models/Characters');
const TeamRecord = require('../models/TeamRecord');
const User = require('../models/User');
const { gameRunIdentity } = require('../utils/gameRunIdentity');
const { computeLpReward } = require('../utils/lpReward');
const { consumeRateLimit, positiveInt } = require('../utils/rateLimit');

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
    'itemName', 'receiptVersion', 'actionKey', 'actionType', 'paidCost', 'gainedCredits', 'receivedQty', 'beforeCredits', 'afterCredits',
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
    'equipmentEffectId', 'effectId', 'effectKind', 'stage',
    'delaySec', 'dueAtSec', 'cooldownUntil', 'radius', 'baseDamage',
    'mode',
    'heal', 'satiety', 'remainingQty',
    'damage',
    'a', 'b', 'winner', 'lethal', 'targetId',
    'hpDamage', 'absorbed', 'hpBefore', 'hpAfter', 'maxHpBefore', 'maxHpAfter',
    'teamId', 'teamName', 'aliveCount', 'protectedCount', 'status', 'previousStatus',
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
        if (!['string', 'number', 'boolean'].includes(typeof event[key])) continue;
        if (typeof event[key] === 'number' && !Number.isFinite(event[key])) continue;
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
      if (event.kind === 'use' && Array.isArray(event.effects)) {
        const statKeys = ['attackPower', 'defense', 'skillAmp', 'attackSpeed', 'critChance', 'moveSpeed', 'attackRange', 'sightRange'];
        out.effects = event.effects.slice(0, 3).filter(row => row && typeof row.name === 'string'
          && Number.isFinite(row.durationSec) && row.durationSec > 0).map(row => ({
          name: row.name.slice(0, 120), durationSec: row.durationSec,
          shield: Number.isFinite(row.shield) && row.shield > 0 ? row.shield : 0,
          regen: Number.isFinite(row.regen) && row.regen > 0 ? row.regen : 0,
          stats: Object.fromEntries(statKeys.filter(key => Number.isFinite(row.stats?.[key]) && row.stats[key] >= 0)
            .map(key => [key, row.stats[key]])),
        }));
      }
      if (Array.isArray(event.participants)) out.participants = event.participants.slice(0, 100)
        .filter((id) => typeof id === 'string' || typeof id === 'number').map((id) => String(id).slice(0, 180));
      if (event.equipmentEffectId || event.kind === 'equipment_effect') {
        for (const key of ['centerPosition', 'targetPosition']) {
          const point = event[key];
          if (point && typeof point.zoneId === 'string' && Number.isFinite(point.x) && Number.isFinite(point.y))
            out[key] = { zoneId: point.zoneId.slice(0, 180), x: point.x, y: point.y };
        }
      }
      if (['procurement', 'craft'].includes(event.kind) && event.receiptVersion === 1 && Array.isArray(event.consumed)) {
        out.consumed = event.consumed.slice(0, 32).filter((row) => row && typeof row.itemId === 'string'
          && row.itemId.trim() && Number.isSafeInteger(row.qty) && row.qty > 0)
          .map((row) => ({ itemId: row.itemId.slice(0, 180), itemName: String(row.itemName || row.itemId).slice(0, 180), qty: row.qty }));
      }
      if (event.health?.version === 1) {
        const copyHealth = (row) => {
          if (!row || typeof row.id !== 'string' || ![row.before, row.after].every((hp) => hp
            && Number.isFinite(hp.hp) && hp.hp >= 0 && Number.isFinite(hp.maxHp) && hp.maxHp > 0)) return null;
          return { id: row.id.slice(0, 180), before: { hp: row.before.hp, maxHp: row.before.maxHp },
            after: { hp: row.after.hp, maxHp: row.after.maxHp } };
        };
        const attacker = copyHealth(event.health.attacker), target = copyHealth(event.health.target);
        if (attacker && target && attacker.id === out.a && target.id === out.b) out.health = { version: 1, attacker, target };
      }
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

const MAX_PARTICIPANTS = 64;
const MAX_LOG_LINES = 400;
const GAME_END_WINDOW_MS = positiveInt(process.env.GAME_END_RATE_LIMIT_WINDOW_MS, 60 * 60 * 1000);
const GAME_END_MAX = positiveInt(process.env.GAME_END_RATE_LIMIT_MAX, 30);

// Indirection so tests can replace the shared rate-limit store.
const deps = { consumeRateLimit };

function boundedText(value, maxLength) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function isObjectIdLike(value) {
  return /^[a-f0-9]{24}$/i.test(String(value || ''));
}

function readCount(map, id, fallback, cap) {
  const source = map && typeof map === 'object' && !Array.isArray(map) && Object.hasOwn(map, id) ? map[id] : fallback;
  return Math.min(cap, toNonNegativeInt(source));
}

// The browser runs the match, so every number here is client-reported. Bound
// each field so one request cannot write arbitrary totals into the records.
function sanitizeParticipants(participants, { killCounts, assistCounts, winnerId, winnerTeamId }) {
  const rows = [];
  const seen = new Set();
  for (const participant of Array.isArray(participants) ? participants : []) {
    if (rows.length >= MAX_PARTICIPANTS) break;
    if (!participant || typeof participant !== 'object') continue;
    const id = boundedText(actorId(participant), 80);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    rows.push({ participant, id });
  }
  // Revivals allow more kills than opponents, but never unbounded counts.
  const countCap = Math.max(1, rows.length * 2);
  return rows.map(({ participant, id }) => {
    const teamId = boundedText(participant.teamId || participant.matchTeamId, 80);
    return {
      charId: id,
      name: boundedText(participant.name, 80) || 'Unknown',
      killCount: readCount(killCounts, id, participant.killCount, countCap),
      assistCount: readCount(assistCounts, id, participant.assistCount, countCap),
      isWinner: id === winnerId || Boolean(winnerTeamId && teamId === winnerTeamId),
      alive: readAliveFlag(participant),
      teamId,
      teamName: boundedText(participant.teamName || participant.matchTeamName, 100),
      rosterIds: uniqueStrings(participant.rosterIds || participant.matchTeamRosterIds || []).slice(0, 16).map((value) => value.slice(0, 80)),
      rosterNames: uniqueStrings(participant.rosterNames || participant.matchTeamRosterNames || []).slice(0, 16).map((value) => value.slice(0, 80)),
    };
  });
}

function rewardReceipt(logDoc, user, duplicate) {
  return {
    message: duplicate ? '게임 로그가 이미 저장되어 있습니다.' : '게임 로그 저장 완료',
    gameLogId: logDoc._id,
    duplicate,
    rewardStatus: logDoc.rewardStatus || 'client_reported',
    lpEarnedApplied: Number(logDoc.lpAwarded || 0),
    lpBreakdown: {
      base: Number(logDoc.lpBaseAwarded || 0),
      predictionBonus: Number(logDoc.lpPredictionBonusAwarded || 0),
      predictionCorrect: Number(logDoc.lpPredictionBonusAwarded || 0) > 0,
    },
    creditsEarnedApplied: 0,
    user: user ? {
      lp: Number(user.lp || 0),
      credits: Number(user.credits || 0),
      statistics: user.statistics || {},
    } : null,
  };
}

async function loadUserProgress(userId) {
  try {
    return await User.findById(userId).select('lp credits statistics').lean();
  } catch {
    return null;
  }
}

/**
 * ✅ 게임 종료 기록 저장 (단일 경로)
 * POST /api/game/end
 * body: { clientRunId, winnerId, winnerTeamId, killCounts, assistCounts, fullLogs,
 *         participants, matchMode, runEvents, teamSize, predictedWinnerId, devRunTainted }
 *
 * - 캐릭터 전적·팀 전적·유저 통계·LP를 한 트랜잭션으로 반영합니다.
 * - LP 금액은 서버 규칙(utils/lpReward)으로만 계산하고, 크레딧은 지급하지 않습니다.
 * - 같은 clientRunId 재전송은 처음 영수증을 그대로 돌려줍니다.
 */
router.post('/end', async (req, res) => {
  let identity;
  try {
    const body = req.body || {};
    identity = { userId: req.user.id, clientRunId: gameRunIdentity(body) };

    const winnerId = boundedText(body.winnerId, 80);
    if (!winnerId) return res.status(400).json({ error: 'winnerId가 필요합니다.' });
    const rawWinner = (Array.isArray(body.participants) ? body.participants : [])
      .find((participant) => participant && typeof participant === 'object' && actorId(participant) === winnerId);
    const winnerTeamId = boundedText(body.winnerTeamId, 80)
      || boundedText(rawWinner?.teamId || rawWinner?.matchTeamId, 80);
    const summary = sanitizeParticipants(body.participants, {
      killCounts: body.killCounts,
      assistCounts: body.assistCounts,
      winnerId,
      winnerTeamId,
    });
    const winnerRow = summary.find((row) => row.charId === winnerId);
    if (!winnerRow) {
      return res.status(400).json({ error: '우승 캐릭터가 참가자 목록에 없습니다.', code: 'WINNER_NOT_IN_ROSTER' });
    }

    // Retries of a saved run return the original receipt without using the rate limit.
    const previous = await GameLog.findOne(identity);
    if (previous) return res.json(rewardReceipt(previous, await loadUserProgress(req.user.id), true));

    try {
      const rate = await deps.consumeRateLimit({
        scope: 'game:end',
        subject: `user:${req.user.id}`,
        limit: GAME_END_MAX,
        windowMs: GAME_END_WINDOW_MS,
      });
      if (!rate.allowed) {
        res.set('Retry-After', String(rate.retryAfterSec));
        return res.status(429).json({
          error: `경기 결과 저장이 너무 잦습니다. ${rate.retryAfterSec}초 후 다시 시도해주세요.`,
          code: 'RATE_LIMITED',
          retryAfterSec: rate.retryAfterSec,
        });
      }
    } catch (rateError) {
      console.error('game end rate limit unavailable:', rateError);
      return res.status(503).json({ error: '경기 결과 저장 보호 서비스를 사용할 수 없습니다.', code: 'RATE_LIMIT_UNAVAILABLE' });
    }

    const matchMode = boundedText(body.matchMode, 40);
    const fullLog = (Array.isArray(body.fullLogs) ? body.fullLogs : [])
      .slice(-MAX_LOG_LINES)
      .map((line) => String(line ?? '').slice(0, 600));
    const storedRunEvents = compactRunEventsForStorage(body.runEvents);
    const summaryDoc = buildRunSummary({
      fullLogs: fullLog,
      matchMode,
      participants: summary,
      runEvents: storedRunEvents,
    });
    const lp = computeLpReward({
      participants: summary,
      winnerId,
      winnerTeamId,
      predictedWinnerId: boundedText(body.predictedWinnerId, 80),
      devRunTainted: body.devRunTainted === true,
    });

    const count = await GameLog.countDocuments();
    const title = `제 ${count + 1}회 아레나`;
    const winnerTeamRow = summary.find((row) => row.isWinner && row.teamId === winnerTeamId) || winnerRow;

    // Log, character records, team records, user statistics and LP commit together.
    // A failed write can be retried with the same run ID without partial increments.
    let createdNew = false;
    const logDoc = await GameLog.db.transaction(async (session) => {
      createdNew = false;
      const existing = await GameLog.findOne(identity).session(session);
      if (existing) return existing;

      const participantIds = summary.map((row) => row.charId).filter(isObjectIdLike);
      const chars = participantIds.length
        ? await Character.find({ _id: { $in: participantIds }, userId: req.user.id }, '_id name').session(session)
        : [];
      const existingIds = new Set(chars.map((character) => String(character._id)));
      const mine = summary.filter((row) => existingIds.has(String(row.charId)));

      const saved = await new GameLog({
        ...identity,
        title,
        winnerName: winnerRow.name,
        winnerTeamId,
        winnerTeamName: winnerTeamRow?.teamName || '',
        matchMode,
        teamSize: Math.min(MAX_PARTICIPANTS, toNonNegativeInt(body.teamSize)),
        participants: summary,
        fullLog,
        runEvents: storedRunEvents,
        summary: summaryDoc,
        trustedOutcome: false,
        rewardStatus: 'client_reported',
        lpAwarded: lp.total,
        lpBaseAwarded: lp.base,
        lpPredictionBonusAwarded: lp.predictionBonus,
        predictedWinnerId: lp.predictedWinnerId,
      }).save({ session });

      // ✅ 캐릭터 누적 기록 반영 (내 계정 캐릭터에만)
      const ops = mine.map((row) => ({
        updateOne: {
          filter: { _id: row.charId, userId: req.user.id },
          update: {
            $inc: {
              'records.gamesPlayed': 1,
              'records.totalKills': row.killCount,
              'records.totalAssists': row.assistCount,
              'records.totalWins': row.isWinner ? 1 : 0,
              'records.deathCount': row.alive === false ? 1 : 0,
            },
          },
        },
      }));
      if (ops.length > 0) await Character.bulkWrite(ops, { session });

      const teamOps = buildTeamRecordOps(summary, existingIds, req.user.id, matchMode);
      if (teamOps.length > 0) await TeamRecord.bulkWrite(teamOps, { session });

      await User.updateOne(
        { _id: req.user.id },
        {
          $inc: {
            lp: lp.total,
            'statistics.totalGames': 1,
            'statistics.totalKills': mine.reduce((sum, row) => sum + row.killCount, 0),
            'statistics.totalWins': existingIds.has(winnerId) ? 1 : 0,
          },
        },
        { session },
      );
      createdNew = true;
      return saved;
    });

    res.json(rewardReceipt(logDoc, await loadUserProgress(req.user.id), !createdNew));
  } catch (err) {
    if (err.code === 'INVALID_RUN_ID') return res.status(400).json({ error: err.message });
    // Concurrent requests may both pass the first lookup. The unique index
    // rejects the second transaction, whose increments are rolled back as well.
    if (err.code === 11000 && identity) {
      try {
        const existing = await GameLog.findOne(identity);
        if (existing) return res.json(rewardReceipt(existing, await loadUserProgress(req.user.id), true));
      } catch (lookupError) {
        console.error(lookupError);
      }
    }
    console.error(err);
    res.status(500).json({ error: '게임 로그 저장 실패' });
  }
});

router.testing = { deps, sanitizeParticipants };

module.exports = router;
