// server/routes/characters.js
const express = require('express');
const router = express.Router();
const Character = require('../models/Characters');
const Item = require('../models/Item');
const { buildItemNameMap, normalizeInventory } = require('../utils/inventory');
const { scopedFilter } = require('../utils/requestScope');
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
  'characterTemplateId',
  'characterSkillCode',
  'characterSkillLevel',
  'characterSkillLevels',
  'characterSkills',
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
  'characterTemplateId',
  'characterSkillCode',
  'characterSkillLevel',
  'goalGearTier',
  'tacticalSkill',
  'tacticalSkillLevel',
  'erSubject',
  'erRole',
  'erTrait',
];

const DEFAULT_STATS = {
  maxHp: 100,
  hpGrowth: 4,
  attackPower: 24,
  attackPowerGrowth: 1.4,
  skillAmp: 0,
  skillAmpGrowth: 1.1,
  defense: 14,
  defenseGrowth: 0.8,
  attackSpeed: 0.72,
  attackSpeedGrowth: 0.015,
  attackRange: 1.5,
  sightRange: 8,
};
const STAT_KEYS = Object.keys(DEFAULT_STATS);
const LOADOUT_TIERS = ['hero', 'legend', 'transcend'];
const LOADOUT_KEYS = ['weaponKey', 'headKey', 'clothesKey', 'armKey', 'shoesKey'];
const ACTIVE_SKILL_SLOTS = ['q', 'w', 'e', 'r'];
const CHARACTER_SKILL_SLOTS = [...ACTIVE_SKILL_SLOTS, 'passive'];
const SKILL_LEVEL_ARRAY_FIELDS = [
  'firstFlat',
  'secondFlat',
  'flatDamage',
  'maxHpPct',
  'currentHpPct',
  'secondMaxHpPct',
  'secondCurrentHpPct',
  'heal',
  'shield',
];
const SUPPORTED_TAC_SKILLS = new Set([
  '블링크',
  '치유의 바람',
  '붉은 폭풍',
  '스트라이더 A-13',
  '퀘이크',
  '프로토콜 위반',
  '초월',
  '아티팩트',
  '무효화',
  '강한 결속',
  '진실의 칼날',
  '라이트 윙',
  '리펄서 미사일',
  '플라즈마 대시',
]);
const TAC_SKILL_REPLACEMENTS = {
  '라이트닝 쉴드': '초월',
  '블래스터': '진실의 칼날',
  '블래스터 탄환': '진실의 칼날',
  '거짓 서약': '진실의 칼날',
  '빛의 수호': '라이트 윙',
  '아스테니아': '플라즈마 대시',
  '부착 / 추적': '블링크',
  '부착/추적': '블링크',
  '힘껏펀치': '퀘이크',
  '임펄스': '블링크',
  '메테오': '진실의 칼날',
  '중력장': '퀘이크',
  '롤링썬더': '스트라이더 A-13',
};
const TAC_SKILL_ALIASES = {
  blink: '블링크',
  'healing wind': '치유의 바람',
  healingwind: '치유의 바람',
  'red storm': '붉은 폭풍',
  'electric shift': '붉은 폭풍',
  'lightning shield': '라이트닝 쉴드',
  shield: '라이트닝 쉴드',
  '스트라이더 - A13': '스트라이더 A-13',
  '스트라이더-A13': '스트라이더 A-13',
  '스트라이더 A13': '스트라이더 A-13',
  'strider a13': '스트라이더 A-13',
  'strider a-13': '스트라이더 A-13',
  strider: '스트라이더 A-13',
  blaster: '블래스터',
  quake: '퀘이크',
  'protocol violation': '프로토콜 위반',
  'false oath': '거짓 서약',
  artifact: '아티팩트',
  nullification: '무효화',
  transcendence: '초월',
  'wings of light': '라이트 윙',
  'light wing': '라이트 윙',
  'repulsor missiles': '리펄서 미사일',
  'plasma dash': '플라즈마 대시',
  asthenia: '아스테니아',
  'attach track': '블링크',
  'attach / track': '블링크',
  impulse: '블링크',
  meteor: '진실의 칼날',
  gravity: '퀘이크',
  'gravity field': '퀘이크',
  'rolling thunder': '스트라이더 A-13',
};

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

  out.goalGearTier = 6;
  if (out.inventory) out.inventory = normalizeInventory(out.inventory, itemNameMap, { merge: true });
  if (out.tacticalSkill !== undefined) out.tacticalSkill = normalizeTacticalSkill(out.tacticalSkill);
  return out;
}

function normalizeTacticalSkill(value) {
  const raw = String(value || '').trim();
  if (!raw) return '블링크';
  if (SUPPORTED_TAC_SKILLS.has(raw)) return raw;
  const replaced = TAC_SKILL_REPLACEMENTS[raw];
  if (replaced && SUPPORTED_TAC_SKILLS.has(replaced)) return replaced;
  const key = raw.toLowerCase().replace(/\s+/g, ' ').trim();
  const alias = TAC_SKILL_ALIASES[raw] || TAC_SKILL_ALIASES[key] || TAC_SKILL_ALIASES[key.replace(/[-_]/g, ' ')];
  const aliasReplacement = TAC_SKILL_REPLACEMENTS[alias] || alias;
  return SUPPORTED_TAC_SKILLS.has(aliasReplacement) ? aliasReplacement : '블링크';
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
  for (const key of STAT_KEYS) out[key] = cleanComparableNumber(src[key], DEFAULT_STATS[key] || 0);
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

function cleanComparableSkillLevels(levels) {
  const src = levels && typeof levels === 'object' ? levels : {};
  const out = {};
  for (const key of ['q', 'w', 'e', 'r']) {
    out[key] = Math.max(1, Math.min(5, cleanComparableNumber(src[key], 1)));
  }
  return out;
}

function cleanComparableLevelArray(value, fallback = 0) {
  const raw = Array.isArray(value)
    ? value
    : String(value ?? '').split(/[,\s/]+/).filter(Boolean);
  const src = raw.length ? raw : [fallback];
  const out = [];
  for (let i = 0; i < 5; i += 1) {
    const picked = src[i] ?? src[src.length - 1] ?? fallback;
    out.push(cleanComparableNumber(picked, fallback));
  }
  return out;
}

function cleanComparableSkillStatModifiers(statModifiers) {
  const src = statModifiers && typeof statModifiers === 'object' ? statModifiers : {};
  const out = {};
  for (const key of STAT_KEYS) {
    const value = cleanComparableNumber(src[key], 0);
    if (value !== 0) out[key] = value;
  }
  return out;
}

function cleanComparablePctInput(value, fallback = 0) {
  const n = cleanComparableNumber(value, fallback);
  if (n <= 0) return 0;
  return n > 1 ? n / 100 : n;
}

function cleanComparableCharacterSkill(raw, slot) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const isPassive = slot === 'passive';
  const defaultType = isPassive ? 'passive_stat' : slot === 'q' ? 'basic_attack_recast' : 'combat_effect';
  const defaultCooldown = slot === 'r' ? 60 : slot === 'e' ? 18 : slot === 'w' ? 12 : slot === 'q' ? 7 : 0;
  const out = {
    enabled: src.enabled === true,
    slot,
    type: cleanComparableString(src.type, defaultType) || defaultType,
    trigger: cleanComparableString(src.trigger, isPassive ? 'always' : 'basic_attack') || (isPassive ? 'always' : 'basic_attack'),
    name: cleanComparableString(src.name, ''),
    sourceText: cleanComparableString(src.sourceText, ''),
    cooldownSec: Math.max(isPassive ? 0 : 1, cleanComparableNumber(src.cooldownSec, defaultCooldown)),
    recastWindowSec: Math.max(0, cleanComparableNumber(src.recastWindowSec, slot === 'q' ? 5 : 0)),
    range: Math.max(0, cleanComparableNumber(src.range, 0)),
    castDelaySec: Math.max(0, cleanComparableNumber(src.castDelaySec, 0)),
    recoveryDelaySec: Math.max(0, cleanComparableNumber(src.recoveryDelaySec, 0)),
    useCondition: cleanComparableString(src.useCondition, 'auto') || 'auto',
    targetPriority: cleanComparableString(src.targetPriority, 'auto') || 'auto',
    minExpectedDamage: Math.max(0, cleanComparableNumber(src.minExpectedDamage, 1)),
    minSplashTargets: Math.max(0, Math.floor(cleanComparableNumber(src.minSplashTargets, 0))),
    minCasterHpPct: cleanComparablePctInput(src.minCasterHpPct, 0),
    maxCasterHpPct: cleanComparablePctInput(src.maxCasterHpPct, 0),
    minTargetHpPct: cleanComparablePctInput(src.minTargetHpPct, 0),
    maxTargetHpPct: cleanComparablePctInput(src.maxTargetHpPct, 0),
    radius: Math.max(0, cleanComparableNumber(src.radius, 0)),
    durationSec: Math.max(0, cleanComparableNumber(src.durationSec, 0)),
    firstSkillAmpScale: Math.max(0, cleanComparableNumber(src.firstSkillAmpScale, 0)),
    secondSkillAmpScale: Math.max(0, cleanComparableNumber(src.secondSkillAmpScale, 0)),
    skillAmpScale: Math.max(0, cleanComparableNumber(src.skillAmpScale ?? src.firstSkillAmpScale, 0)),
    statModifiers: cleanComparableSkillStatModifiers(src.statModifiers),
    tags: (Array.isArray(src.tags) ? src.tags : []).map((tag) => cleanComparableString(tag, '')).filter(Boolean).slice(0, 16),
  };
  for (const field of SKILL_LEVEL_ARRAY_FIELDS) {
    out[field] = cleanComparableLevelArray(src[field], 0);
  }
  if (!isPassive && !src.flatDamage && src.firstFlat) out.flatDamage = cleanComparableLevelArray(src.firstFlat, 0);
  return out;
}

function cleanComparableCharacterSkills(skills) {
  const src = skills && typeof skills === 'object' ? skills : {};
  return Object.fromEntries(
    CHARACTER_SKILL_SLOTS.map((slot) => [slot, cleanComparableCharacterSkill(src[slot], slot)])
  );
}

function comparableValue(value, field) {
  if (field === 'goalGearTier') return 6;
  if (field === 'characterSkillLevel') {
    return Math.max(1, Math.min(5, cleanComparableNumber(value, 1)));
  }
  if (field === 'characterSkillLevels') return cleanComparableSkillLevels(value);
  if (field === 'characterSkills') return cleanComparableCharacterSkills(value);
  if (field === 'tacticalSkillLevel') {
    return Math.max(1, Math.min(2, cleanComparableNumber(value, 1)));
  }
  if (field === 'tacticalSkill') return normalizeTacticalSkill(value);
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
  const expectedCount = Array.isArray(saveInputs) ? saveInputs.length : 0;
  const savedCount = Array.isArray(savedCharacters) ? savedCharacters.length : 0;
  if (savedCount !== expectedCount) {
    mismatches.push({ id: 'collection', field: '__count', expected: expectedCount, actual: savedCount });
  }

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
    for (const field of ['stats', 'goalLoadouts', 'erWeapons', 'characterSkillLevels', 'characterSkills']) {
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

const CHARACTER_LIST_SELECTS = {
  editor: [
    'name',
    'previewImage',
    'summary',
    'gender',
    'weaponType',
    'characterTemplateId',
    'characterSkillCode',
    'characterSkillLevel',
    'characterSkillLevels',
    'characterSkills',
    'goalGearTier',
    'tacticalSkill',
    'erSubject',
    'erRole',
    'erTrait',
    'erWeapons',
    'goalLoadouts',
    'stats',
    'createdAt',
  ].join(' '),
  stats: [
    'name',
    'previewImage',
    'gender',
    'weaponType',
    'characterTemplateId',
    'characterSkillCode',
    'characterSkillLevel',
    'characterSkillLevels',
    'characterSkills',
    'goalGearTier',
    'tacticalSkill',
    'erSubject',
    'erRole',
    'erTrait',
    'erWeapons',
    'goalLoadouts',
    'stats',
    'createdAt',
  ].join(' '),
  simulation: [
    'name',
    'previewImage',
    'gender',
    'weaponType',
    'characterTemplateId',
    'characterSkillCode',
    'characterSkillLevel',
    'characterSkillLevels',
    'characterSkills',
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
    'createdAt',
  ].join(' '),
};

function getCharacterListSelect(req) {
  const view = String(req?.query?.view || '').trim().toLowerCase();
  return CHARACTER_LIST_SELECTS[view] || '';
}

// 1. 캐릭터 목록 불러오기 (내 것만)
router.get('/', async (req, res) => {
  try {
    const userId = getUserIdOrRespond(req, res);
    if (!userId) return;
    const select = getCharacterListSelect(req);
    let query = Character.find({ userId }).sort({ createdAt: -1 });
    if (select) query = query.select(select);
    const characters = await query.lean();
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
    const items = await Item.find(scopedFilter(req), '_id name');
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

    const items = await Item.find(scopedFilter(req), '_id name');
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
