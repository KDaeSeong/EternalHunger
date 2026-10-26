const express = require('express');
const mongoose = require('mongoose');

const GamePlayRecord = require('../models/GamePlayRecord');
const PrimitiveArchiveReward = require('../models/PrimitiveArchiveReward');
const PrimitiveArchiveDailyReward = require('../models/PrimitiveArchiveDailyReward');
const User = require('../models/User');
const ARCHIVE_REWARD_CONTRACT = require('../generated/primitiveArchiveRewardContract.json');

const router = express.Router();

const MAX_RECORD_PAYLOAD_BYTES = toPositiveInt(process.env.GAME_RECORD_MAX_BYTES, 512 * 1024);
const VALID_RESULTS = new Set(['win', 'loss', 'draw', 'clear', 'fail', 'none']);
const PRIMITIVE_ARCHIVE_GAME_SLUG = 'primitive-archive';
const MAX_CLIENT_RUN_ID_LENGTH = 160;
const ARCHIVE_REWARD_RULES = ARCHIVE_REWARD_CONTRACT.rules;
const ARCHIVE_REWARD_STATUS = Object.freeze({
  AWARDED: 'awarded',
  ALREADY_AWARDED: 'already_awarded',
  DAILY_LIMIT: 'daily_limit',
  INELIGIBLE: 'ineligible',
});

const dependencies = {
  GamePlayRecord,
  PrimitiveArchiveReward,
  PrimitiveArchiveDailyReward,
  User,
  now: () => new Date(),
};

function toPositiveInt(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function normalizeKey(value, fallback = '') {
  return String(value || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function cleanText(value, fallback, maxLength) {
  const text = String(value || '').trim().replace(/\s+/g, ' ');
  return (text || fallback).slice(0, maxLength);
}

function normalizeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function getJsonBytes(value) {
  return Buffer.byteLength(JSON.stringify(value ?? null), 'utf8');
}

function toFiniteNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toNonNegativeInt(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function getPrimitiveArchiveRunId(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const state = payload.state;
  if (!state || typeof state !== 'object' || Array.isArray(state) || typeof state.runId !== 'string') return null;

  const runId = state.runId.trim();
  if (!runId || runId.length > MAX_CLIENT_RUN_ID_LENGTH || /[\u0000-\u001f\u007f-\u009f]/.test(runId)) return null;
  return runId;
}

function findPrimitiveArchiveRecord(userId, clientRunId, { session, model = dependencies.GamePlayRecord } = {}) {
  let query = model.findOne({
    userId,
    gameSlug: PRIMITIVE_ARCHIVE_GAME_SLUG,
    $or: [
      { clientRunId },
      { 'payload.state.runId': clientRunId },
    ],
  });
  if (session && typeof query.session === 'function') query = query.session(session);
  if (typeof query.sort === 'function') query = query.sort({ createdAt: 1, _id: 1 });
  if (typeof query.lean === 'function') query = query.lean();
  return query;
}

function sendRecordResponse(res, row, { status = 201, replayed, rewards, userProgress } = {}) {
  const response = {
    message: replayed === true
      ? '이미 저장된 게임 기록입니다. 중복으로 추가하지 않았습니다.'
      : '게임 기록을 저장했습니다.',
    record: mapRecord(row, { includePayload: true }),
  };
  if (typeof replayed === 'boolean') response.replayed = replayed;
  if (rewards) response.rewards = rewards;
  if (userProgress) response.userProgress = userProgress;
  return res.status(status).json(response);
}

function mapRecord(row, options = {}) {
  if (!row) return null;
  const mapped = {
    id: String(row._id || ''),
    gameSlug: row.gameSlug || '',
    title: row.title || '플레이 기록',
    mode: row.mode || '',
    result: row.result || 'none',
    score: toFiniteNumber(row.score),
    playTimeSec: toNonNegativeInt(row.playTimeSec),
    summary: normalizeObject(row.summary),
    payloadBytes: Number(row.payloadBytes || 0),
    playedAt: row.playedAt || null,
    createdAt: row.createdAt || null,
    updatedAt: row.updatedAt || null,
  };
  if (options.includePayload) mapped.payload = row.payload ?? {};
  return mapped;
}

function getUserObjectId(req, res) {
  const raw = String(req.user?.id || req.user?._id || '');
  if (!mongoose.Types.ObjectId.isValid(raw)) {
    res.status(401).json({ error: '로그인이 필요합니다.' });
    return null;
  }
  return new mongoose.Types.ObjectId(raw);
}

function toKstDayKey(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function completedIdsMatch(completed, ids) {
  return isRecord(completed) && ids.every((id) => completed[id] === true);
}

// Client snapshots are eligibility claims, not server proof of gameplay. Keep
// payouts fixed and bounded; this check must never be described as anti-cheat.
function archiveRewardTier(state) {
  const developerBonuses = isRecord(state?.devTools?.actionBonuses) ? state.devTools.actionBonuses : null;
  const developerBonusesValid = developerBonuses
    && Object.values(developerBonuses).every((value) => typeof value === 'number' && Number.isFinite(value));
  const developerAdjustmentActive = state?.devTools?.enabled === true && (
    state.devTools.guaranteedSuccess === true
    || state.devTools.unlockSpecializedActions === true
    || (developerBonusesValid && Object.values(developerBonuses).some((value) => value !== 0))
  );
  if (!isRecord(state)
    || state.ended !== true
    || state.victory !== true
    || !Number.isInteger(state.day)
    || state.day < ARCHIVE_REWARD_CONTRACT.baseDays
    || !isRecord(state.devTools)
    || typeof state.devTools.enabled !== 'boolean'
    || typeof state.devTools.used !== 'boolean'
    || state.devTools.used !== false
    || typeof state.devTools.guaranteedSuccess !== 'boolean'
    || typeof state.devTools.unlockSpecializedActions !== 'boolean'
    || !developerBonusesValid
    || developerAdjustmentActive
    || !isRecord(state.meta)
    || state.meta.lastSettledRunId !== state.runId
    || !isRecord(state.research)
    || !isRecord(state.civics)
    || !completedIdsMatch(state.research.completed, ARCHIVE_REWARD_CONTRACT.core.technologies)
    || !completedIdsMatch(state.civics.completed, ARCHIVE_REWARD_CONTRACT.core.civics)
    || !isRecord(state.camp)
    || !Object.entries(ARCHIVE_REWARD_CONTRACT.campRequirements)
      .every(([id, minimum]) => Number.isFinite(state.camp[id]) && state.camp[id] >= minimum)
    || !isRecord(state.inventory)
    || !ARCHIVE_REWARD_CONTRACT.bookRequirements
      .every((id) => Number.isFinite(state.inventory[id]) && state.inventory[id] >= 1)
    || !Array.isArray(state.party)
    || state.party.filter((member) => isRecord(member) && Number.isFinite(member.hp) && member.hp > 0).length
      < ARCHIVE_REWARD_CONTRACT.survivorCount) return null;

  return completedIdsMatch(state.research.completed, ARCHIVE_REWARD_CONTRACT.full.technologies)
    && completedIdsMatch(state.civics.completed, ARCHIVE_REWARD_CONTRACT.full.civics)
    ? 'full'
    : 'basic';
}

function archiveRewardReceipt(ledger, { replayed = false, statusOverride } = {}) {
  return {
    status: statusOverride || (ledger?.status === 'awarded'
      ? (replayed ? ARCHIVE_REWARD_STATUS.ALREADY_AWARDED : ARCHIVE_REWARD_STATUS.AWARDED)
      : ledger?.status === 'daily_limit'
        ? ARCHIVE_REWARD_STATUS.DAILY_LIMIT
        : ARCHIVE_REWARD_STATUS.INELIGIBLE),
    lp: ledger?.status === 'awarded' ? Number(ledger.lp || 0) : 0,
    credits: ledger?.status === 'awarded' ? Number(ledger.credits || 0) : 0,
    replayed,
    tier: ledger?.tier || null,
  };
}

function queryOne(model, filter, session) {
  let query = model.findOne(filter);
  if (session && typeof query.session === 'function') query = query.session(session);
  if (typeof query.lean === 'function') query = query.lean();
  return query;
}

async function createOne(model, document, session) {
  const created = await model.create([document], { session });
  return Array.isArray(created) ? created[0] : created;
}

async function loadProgress(userId, session) {
  let query = dependencies.User.findById(userId).select('lp credits');
  if (session && typeof query.session === 'function') query = query.session(session);
  const row = typeof query.lean === 'function' ? await query.lean() : await query;
  return row ? { lp: Number(row.lp || 0), credits: Number(row.credits || 0) } : null;
}

async function lockArchiveRewardAccount(userId, session) {
  const updated = await dependencies.User.updateOne(
    { _id: userId },
    { $inc: { primitiveArchiveRewardMutationVersion: 1 } },
    { session },
  );
  if (updated.matchedCount !== 1) throw Object.assign(new Error('ARCHIVE_REWARD_USER_NOT_FOUND'), { code: 'ARCHIVE_REWARD_USER_NOT_FOUND' });
}

async function ensureArchiveRewardIndexes() {
  await dependencies.GamePlayRecord.ensureRunIdentityIndex();
  await dependencies.PrimitiveArchiveReward.ensureRewardIdentityIndex();
  await dependencies.PrimitiveArchiveDailyReward.ensureDailyIdentityIndex();
}

async function payArchiveRewardIfWithinDailyLimit(ledger, userId, dayKey, session) {
  const rules = ARCHIVE_REWARD_RULES;
  let budgetQuery = dependencies.PrimitiveArchiveDailyReward.findOneAndUpdate(
    { userId, dayKey },
    { $setOnInsert: { userId, dayKey, lp: 0, credits: 0 } },
    { new: true, upsert: true, setDefaultsOnInsert: true, session },
  );
  if (budgetQuery && typeof budgetQuery.lean === 'function') budgetQuery = budgetQuery.lean();
  const budget = await budgetQuery;
  if (!budget) throw new Error('ARCHIVE_REWARD_DAILY_BUDGET_UNAVAILABLE');
  const nextLp = Number(budget.lp || 0) + Number(ledger.lp || 0);
  const nextCredits = Number(budget.credits || 0) + Number(ledger.credits || 0);
  if (nextLp > rules.dailyLimit.lp || nextCredits > rules.dailyLimit.credits) return ledger;

  const dailyUpdated = await dependencies.PrimitiveArchiveDailyReward.updateOne(
    { userId, dayKey },
    { $inc: { lp: Number(ledger.lp || 0), credits: Number(ledger.credits || 0) } },
    { session },
  );
  if (dailyUpdated.matchedCount !== 1) throw new Error('ARCHIVE_REWARD_DAILY_BUDGET_CONFLICT');
  if (typeof dependencies.afterDailyIncrement === 'function') await dependencies.afterDailyIncrement();

  await dependencies.User.updateOne(
    { _id: userId },
    { $inc: { lp: Number(ledger.lp || 0), credits: Number(ledger.credits || 0) } },
    { session },
  );
  await dependencies.PrimitiveArchiveReward.updateOne(
    { _id: ledger._id },
    { $set: { status: 'awarded', awardedDayKey: dayKey, awardedAt: dependencies.now() } },
    { session },
  );
  return { ...ledger, status: 'awarded', awardedDayKey: dayKey };
}

async function settleArchiveRecord({ userId, runId, recordData, now }) {
  return dependencies.GamePlayRecord.db.transaction(async (session) => {
    await lockArchiveRewardAccount(userId, session);
    let record = await findPrimitiveArchiveRecord(userId, runId, { session });
    let ledger = await queryOne(dependencies.PrimitiveArchiveReward, {
      userId, gameSlug: PRIMITIVE_ARCHIVE_GAME_SLUG, runId,
    }, session);

    if (!record && ledger) {
      // A deleted history row cannot be recreated from a changed retry body.
      const wasAwarded = ledger.status === 'awarded';
      if (ledger.status === 'daily_limit') {
        ledger = await payArchiveRewardIfWithinDailyLimit(ledger, userId, toKstDayKey(now), session);
      }
      return {
        record: null,
        ledger,
        reward: archiveRewardReceipt(ledger, { replayed: wasAwarded || ledger.status !== 'awarded' }),
        userProgress: await loadProgress(userId, session),
        recordReplayed: true,
      };
    }

    const recordReplayed = Boolean(record);
    let firstRecord = record;
    if (!firstRecord) {
      firstRecord = await createOne(dependencies.GamePlayRecord, recordData, session);
      record = firstRecord;
    }

    const ledgerExistedBeforeThisRequest = Boolean(ledger);
    if (!ledger) {
      const tier = archiveRewardTier(firstRecord?.payload?.state);
      const amount = tier ? ARCHIVE_REWARD_RULES[tier] : { lp: 0, credits: 0 };
      ledger = await createOne(dependencies.PrimitiveArchiveReward, {
        userId,
        gameSlug: PRIMITIVE_ARCHIVE_GAME_SLUG,
        runId,
        status: tier ? 'daily_limit' : 'ineligible',
        tier,
        lp: amount.lp,
        credits: amount.credits,
      }, session);
    }

    const wasAwarded = ledger.status === 'awarded';
    if (ledger.status === 'daily_limit') {
      ledger = await payArchiveRewardIfWithinDailyLimit(ledger, userId, toKstDayKey(now), session);
    }

    const reward = archiveRewardReceipt(ledger, {
      replayed: wasAwarded || (ledgerExistedBeforeThisRequest && ledger.status !== 'awarded'),
      ...(wasAwarded ? { statusOverride: ARCHIVE_REWARD_STATUS.ALREADY_AWARDED } : {}),
    });
    return {
      record,
      ledger,
      reward,
      userProgress: await loadProgress(userId, session),
      recordReplayed,
    };
  });
}

router.get('/', async (req, res) => {
  try {
    const userId = getUserObjectId(req, res);
    if (!userId) return;

    const gameSlug = normalizeKey(req.query?.gameSlug);
    const limit = Math.min(200, Math.max(1, toNonNegativeInt(req.query?.limit) || 100));
    const query = { userId };
    if (gameSlug) query.gameSlug = gameSlug;

    const rows = await dependencies.GamePlayRecord.find(query)
      .select('-payload')
      .sort({ playedAt: -1, createdAt: -1 })
      .limit(limit)
      .lean();

    res.json({ records: rows.map((row) => mapRecord(row)) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '게임 기록을 불러오지 못했습니다.' });
  }
});

router.post('/:gameSlug', async (req, res) => {
  let gameSlug = '';
  let clientRunId = null;
  let userId = null;
  try {
    userId = getUserObjectId(req, res);
    if (!userId) return;

    gameSlug = normalizeKey(req.params?.gameSlug);
    if (!gameSlug) return res.status(400).json({ error: '게임 키가 올바르지 않습니다.' });

    const payload = req.body?.payload ?? {};
    const summary = normalizeObject(req.body?.summary);
    const payloadBytes = getJsonBytes(payload);
    if (payloadBytes > MAX_RECORD_PAYLOAD_BYTES) {
      return res.status(413).json({ error: `기록 데이터는 ${MAX_RECORD_PAYLOAD_BYTES.toLocaleString('ko-KR')}바이트 이내로 입력해주세요.` });
    }

    const isPrimitiveArchiveRun = gameSlug === PRIMITIVE_ARCHIVE_GAME_SLUG
      && (String(req.body?.mode || '').trim() === 'survival-loop'
        || (payload && typeof payload === 'object'
          && !Array.isArray(payload)
          && Object.prototype.hasOwnProperty.call(payload, 'state')));

    if (isPrimitiveArchiveRun) {
      clientRunId = getPrimitiveArchiveRunId(payload);
      if (!clientRunId) {
        return res.status(400).json({ error: '문명 아카이브 런 식별자가 올바르지 않습니다.' });
      }

      try {
        await ensureArchiveRewardIndexes();
      } catch (error) {
        console.error(error);
        return res.status(503).json({ error: '전적 저장을 안전하게 준비하지 못했습니다. 잠시 후 다시 시도해주세요.' });
      }
    }

    const result = VALID_RESULTS.has(String(req.body?.result || '')) ? String(req.body.result) : 'none';
    const playedAt = req.body?.playedAt ? new Date(req.body.playedAt) : new Date();

    const recordData = {
      userId,
      gameSlug,
      title: cleanText(req.body?.title, '플레이 기록', 120),
      mode: cleanText(req.body?.mode, '', 80),
      result,
      score: toFiniteNumber(req.body?.score),
      playTimeSec: toNonNegativeInt(req.body?.playTimeSec),
      summary,
      payload,
      payloadBytes,
      playedAt: playedAt && !Number.isNaN(playedAt.getTime()) ? playedAt : new Date(),
    };
    if (clientRunId) recordData.clientRunId = clientRunId;

    if (isPrimitiveArchiveRun) {
      const now = dependencies.now();
      const settled = await settleArchiveRecord({ userId, runId: clientRunId, recordData, now });
      return sendRecordResponse(res, settled.record, {
        status: settled.recordReplayed ? 200 : 201,
        replayed: settled.recordReplayed,
        rewards: settled.reward,
        userProgress: settled.userProgress,
      });
    }

    const row = await dependencies.GamePlayRecord.create(recordData);

    return sendRecordResponse(res, row, {
      status: 201,
      ...(clientRunId ? { replayed: false } : {}),
    });
  } catch (err) {
    if (gameSlug === PRIMITIVE_ARCHIVE_GAME_SLUG && clientRunId && err?.code === 11000) {
      try {
        const existing = await findPrimitiveArchiveRecord(userId, clientRunId);
        if (existing) return sendRecordResponse(res, existing, { status: 200, replayed: true });
      } catch (lookupError) {
        console.error(lookupError);
      }
    }
    console.error(err);
    res.status(500).json({ error: '게임 기록 저장에 실패했습니다.' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const userId = getUserObjectId(req, res);
    if (!userId) return;
    const id = String(req.params?.id || '');
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: '게임 기록 ID가 올바르지 않습니다.' });
    }

    const row = await dependencies.GamePlayRecord.findOne({ _id: id, userId }).lean();
    if (!row) return res.status(404).json({ error: '게임 기록을 찾을 수 없습니다.' });

    res.json({ record: mapRecord(row, { includePayload: true }) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '게임 기록을 불러오지 못했습니다.' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const userId = getUserObjectId(req, res);
    if (!userId) return;
    const id = String(req.params?.id || '');
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: '게임 기록 ID가 올바르지 않습니다.' });
    }

    const result = await dependencies.GamePlayRecord.deleteOne({ _id: id, userId });
    if (!result.deletedCount) return res.status(404).json({ error: '게임 기록을 찾을 수 없습니다.' });

    res.json({ message: '게임 기록을 삭제했습니다.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '게임 기록 삭제에 실패했습니다.' });
  }
});

router.testing = {
  configureDependencies(overrides = {}) {
    Object.assign(dependencies, overrides);
  },
  resetDependencies() {
    Object.assign(dependencies, {
      GamePlayRecord,
      PrimitiveArchiveReward,
      PrimitiveArchiveDailyReward,
      User,
      now: () => new Date(),
    });
  },
  archiveRewardTier,
  toKstDayKey,
  contract: ARCHIVE_REWARD_CONTRACT,
};

module.exports = router;
