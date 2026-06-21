// server/routes/characters.js
const express = require('express');
const router = express.Router();
const Character = require('../models/Characters');
const Item = require('../models/Item');
const { buildItemNameMap, normalizeInventory } = require('../utils/inventory');
const { verifyToken } = require('../middleware/authMiddleware'); // ★ 추가
const mongoose = require('mongoose');

// 모든 요청에 대해 토큰 검증
router.use(verifyToken);

const SAVE_FIELDS = [
  'name',
  'previewImage',
  'summary',
  'gender',
  'weaponType',
  'goalGearTier',
  'tacticalSkill',
  'tacticalSkillLevel',
  'erSubject',
  'erRole',
  'erTrait',
  'erWeapons',
  'goalLoadouts',
  'stats',
  'inventory',
  'specialSkill',
  'records',
];

const SIMPLE_VERIFY_FIELDS = [
  'name',
  'previewImage',
  'summary',
  'gender',
  'weaponType',
  'goalGearTier',
  'tacticalSkill',
  'tacticalSkillLevel',
  'erSubject',
  'erRole',
  'erTrait',
];

const STAT_KEYS = ['str', 'agi', 'int', 'men', 'luk', 'dex', 'sht', 'end'];
const LOADOUT_TIERS = ['hero', 'legend', 'transcend'];
const LOADOUT_KEYS = ['weaponKey', 'headKey', 'clothesKey', 'armKey', 'shoesKey'];

function parseCharacterSaveBody(body) {
  const parsed = (typeof body === 'string') ? (() => { try { return JSON.parse(body); } catch { return null; } })() : body;
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed?.characters)) return parsed.characters;
  return null;
}

function pickCharacterSavePayload(raw, itemNameMap) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const out = {};
  const id = String(src._id || '').trim();
  if (id && mongoose.Types.ObjectId.isValid(id)) out._id = id;

  for (const field of SAVE_FIELDS) {
    if (src[field] !== undefined) out[field] = src[field];
  }

  if (out.inventory) out.inventory = normalizeInventory(out.inventory, itemNameMap, { merge: true });
  return out;
}

function cleanComparableString(value, fallback = '') {
  if (value === undefined || value === null) return fallback;
  return String(value);
}

function cleanComparableNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function cleanComparableStats(stats) {
  const src = stats && typeof stats === 'object' ? stats : {};
  const out = {};
  for (const key of STAT_KEYS) out[key] = cleanComparableNumber(src[key], 0);
  return out;
}

function cleanComparableLoadouts(loadouts) {
  const src = loadouts && typeof loadouts === 'object' ? loadouts : {};
  const out = {};
  for (const tier of LOADOUT_TIERS) {
    const tierSrc = src[tier] && typeof src[tier] === 'object' ? src[tier] : {};
    out[tier] = {};
    for (const key of LOADOUT_KEYS) out[tier][key] = cleanComparableString(tierSrc[key], '');
  }
  return out;
}

function comparableValue(value, field) {
  if (field === 'goalGearTier') return cleanComparableNumber(value, 6);
  if (field === 'tacticalSkillLevel') {
    return Math.max(1, Math.min(2, cleanComparableNumber(value, 1)));
  }
  if (field === 'stats') return cleanComparableStats(value);
  if (field === 'goalLoadouts') return cleanComparableLoadouts(value);
  if (field === 'erWeapons') {
    return (Array.isArray(value) ? value : []).map((x) => cleanComparableString(x, '')).filter(Boolean);
  }
  return cleanComparableString(value, field === 'name' ? 'Unnamed' : '');
}

function sameComparableValue(a, b, field) {
  return JSON.stringify(comparableValue(a, field)) === JSON.stringify(comparableValue(b, field));
}

function collectSaveVerificationMismatches(saveInputs, saveResults, savedCharacters) {
  const savedById = new Map(
    (Array.isArray(savedCharacters) ? savedCharacters : [])
      .map((doc) => [String(doc?._id || '').trim(), doc])
      .filter(([id]) => Boolean(id))
  );
  const savedIdByClientId = new Map(
    (Array.isArray(saveResults) ? saveResults : [])
      .map((row) => [String(row?.clientId || '').trim(), String(row?._id || '').trim()])
      .filter(([clientId, id]) => Boolean(clientId) && Boolean(id))
  );

  const mismatches = [];
  for (const entry of Array.isArray(saveInputs) ? saveInputs : []) {
    const payload = entry?.payload || {};
    const requestId = String(entry?.clientId || payload?._id || '').trim();
    const savedId = String(payload?._id || savedIdByClientId.get(requestId) || '').trim();
    const saved = savedById.get(savedId);

    if (!saved) {
      mismatches.push({ id: requestId || savedId, field: '_id' });
      continue;
    }

    for (const field of SIMPLE_VERIFY_FIELDS) {
      if (payload[field] !== undefined && !sameComparableValue(payload[field], saved[field], field)) {
        mismatches.push({ id: requestId || savedId, field });
      }
    }
    for (const field of ['stats', 'goalLoadouts', 'erWeapons']) {
      if (payload[field] !== undefined && !sameComparableValue(payload[field], saved[field], field)) {
        mismatches.push({ id: requestId || savedId, field });
      }
    }
  }
  return mismatches;
}

function getUserIdOrRespond(req, res) {
  const raw = req.user?.id ?? req.user?._id ?? req.user?.userId;
  const s = raw != null ? String(raw) : '';
  if (!s || !mongoose.Types.ObjectId.isValid(s)) {
    res.status(401).json({ error: '로그인이 필요합니다.(토큰 userId 오류)' });
    return null;
  }
  return new mongoose.Types.ObjectId(s);
}

// 1. 캐릭터 목록 불러오기 (내 것만)
router.get('/', async (req, res) => {
  try {
    const userId = getUserIdOrRespond(req, res);
    if (!userId) return;
    const characters = await Character.find({ userId }).sort({ createdAt: -1 });
    res.json(characters);
  } catch (err) {
    res.status(500).json({ error: "불러오기 실패" });
  }
});

// 2. 캐릭터 저장 (userId 부여)
router.post('/save', async (req, res) => {
  try {
    const rawCharList = parseCharacterSaveBody(req.body);
    if (!rawCharList) {
      return res.status(400).json({ error: '캐릭터 저장 payload 형식이 올바르지 않습니다.' });
    }
    const userId = getUserIdOrRespond(req, res);
    if (!userId) return;

    // ✅ 인벤토리 정규화(legacy -> itemId)
    const items = await Item.find({}, '_id name');
    const itemNameMap = buildItemNameMap(items);
    const saveInputs = rawCharList.map((raw) => ({
      raw,
      payload: pickCharacterSavePayload(raw, itemNameMap),
      clientId: String(raw?._id || raw?.id || '').trim(),
    }));
    const charList = saveInputs.map((entry) => entry.payload);

    const incomingIdsRaw = charList.filter(c => c && c._id).map(c => String(c._id));
    const incomingIds = incomingIdsRaw.filter((id) => mongoose.Types.ObjectId.isValid(id)).map((id) => new mongoose.Types.ObjectId(id));

    if (incomingIds.length > 0) {
      const existing = await Character.find({ userId, _id: { $in: incomingIds } }).select('_id').lean();
      const existingIds = new Set(existing.map((doc) => String(doc._id)));
      const missingIds = incomingIdsRaw.filter((id) => !existingIds.has(String(id)));
      if (missingIds.length > 0) {
        return res.status(409).json({
          error: '일부 캐릭터를 찾을 수 없어 저장하지 않았습니다. 새로고침 후 다시 저장해주세요.',
          missingIds,
        });
      }
    }
    
    // 내 캐릭터 중에서만 삭제/수정 수행
    const deleteResult = await Character.deleteMany({ userId, _id: { $nin: incomingIds } });

    let updatedCount = 0;
    let createdCount = 0;
    const saveResults = [];
    for (const entry of saveInputs) {
      const char = entry.payload;
      if (char._id) {
        const { _id, ...updateData } = char;
        const updated = await Character.findOneAndUpdate(
          { _id, userId },
          { $set: updateData },
          { new: true, runValidators: true }
        );
        if (!updated) {
          return res.status(409).json({
            error: '캐릭터 저장 중 대상이 사라졌습니다. 새로고침 후 다시 저장해주세요.',
            missingIds: [_id],
          });
        }
        updatedCount += 1;
        saveResults.push({ action: 'updated', clientId: entry.clientId || _id, _id: String(updated._id) });
      } else {
        const { id, _id, ...newCharData } = char; 
        const created = await new Character({ ...newCharData, userId }).save(); // ★ userId 부여 필수!
        createdCount += 1;
        saveResults.push({ action: 'created', clientId: entry.clientId || '', _id: String(created._id) });
      }
    }
    const savedCharacters = await Character.find({ userId }).sort({ createdAt: -1 }).lean();
    const verificationMismatches = collectSaveVerificationMismatches(saveInputs, saveResults, savedCharacters);
    if (verificationMismatches.length > 0) {
      return res.status(500).json({
        error: '저장 후 DB 반영 검증에 실패했습니다. 다시 저장하거나 새로고침 후 시도해주세요.',
        receivedCount: charList.length,
        updatedCount,
        createdCount,
        deletedCount: Number(deleteResult?.deletedCount || 0),
        saveResults,
        mismatches: verificationMismatches.slice(0, 20),
      });
    }

    res.json({
      message: "저장 완료",
      receivedCount: charList.length,
      updatedCount,
      createdCount,
      deletedCount: Number(deleteResult?.deletedCount || 0),
      saveResults,
      characters: savedCharacters,
    });
  } catch (err) {
    res.status(500).json({ error: "저장 실패: " + err.message });
  }
});

// ✅ 인벤토리 정규화 단독 엔드포인트(요청: legacy -> itemId 매핑)
// POST /api/characters/normalize-inventory { characterId? }
router.post('/normalize-inventory', async (req, res) => {
  try {
    const userId = getUserIdOrRespond(req, res);
    if (!userId) return;
    const characterId = req.body?.characterId;

    const items = await Item.find({}, '_id name');
    const itemNameMap = buildItemNameMap(items);

    const query = { userId };
    if (characterId) query._id = characterId;

    const chars = await Character.find(query);
    let updated = 0;

    for (const ch of chars) {
      const before = JSON.stringify(ch.inventory || []);
      ch.inventory = normalizeInventory(ch.inventory, itemNameMap, { merge: true });
      ch.markModified('inventory');
      const after = JSON.stringify(ch.inventory || []);
      if (before !== after) {
        await ch.save();
        updated++;
      }
    }

    res.json({ message: '정규화 완료', updated, total: chars.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '정규화 실패' });
  }
});

module.exports = router;
