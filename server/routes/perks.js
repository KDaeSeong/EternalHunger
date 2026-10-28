// server/routes/perks.js
const express = require('express');
const router = express.Router();

const User = require('../models/User');
const Perk = require('../models/Perk');
const { scopedFilter } = require('../utils/requestScope');
const {
  dedupeScopedPerks,
  ensureDefaultPublicPerks,
  normalizePerkLoadouts,
  PERK_LOADOUT_GAME_SLUGS,
} = require('../utils/defaultPerks');
const { COSMETICS, LOADOUT_KINDS, normalizeCosmeticLoadout, resolveCosmeticPerks } = require('../utils/cosmeticPerks');

function publicUser(user) {
  if (!user) return null;
  return {
    _id: user._id,
    id: user._id,
    username: user.username,
    nickname: user.nickname || '',
    lp: Number(user.lp || 0),
    credits: Number(user.credits || 0),
    perks: Array.isArray(user.perks) ? user.perks : [],
    perkLoadouts: normalizePerkLoadouts(user.perkLoadouts),
    cosmeticLoadout: normalizeCosmeticLoadout(user.cosmeticLoadout),
    cosmetics: resolveCosmeticPerks(user),
    isAdmin: Boolean(user.isAdmin),
    badges: Array.isArray(user.badges) ? user.badges : [],
    statistics: user.statistics,
  };
}

function decoratePerks(perks, user) {
  const ownedSet = new Set((Array.isArray(user?.perks) ? user.perks : []).map((x) => String(x || '').trim()).filter(Boolean));
  const lp = Math.max(0, Number(user?.lp || 0));
  return dedupeScopedPerks(perks, user?._id || user?.id).map((perk) => {
    const code = String(perk?.code || '').trim();
    const cost = Math.max(0, Number(perk?.lpCost || 0));
    const category = String(perk?.category || '').toLowerCase();
    return {
      ...perk,
      isOwned: ownedSet.has(code),
      canAfford: lp >= cost,
      isCosmetic: category !== 'buff' && perk?.effects?.balanceAffecting !== true,
    };
  });
}

router.get('/available', async (req, res) => {
  try {
    await ensureDefaultPublicPerks(Perk);
    const user = await User.findById(req.user.id).select('username nickname lp credits perks perkLoadouts cosmeticLoadout isAdmin badges statistics').lean();
    if (!user) return res.status(404).json({ error: 'user_not_found' });

    const rows = await Perk.find(scopedFilter(req, { isActive: true })).sort({ category: 1, lpCost: 1 }).lean();
    res.json({ perks: decoratePerks(rows, user), user: publicUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'perk_load_failed' });
  }
});

router.post('/cosmetics', async (req, res) => {
  try {
    await ensureDefaultPublicPerks(Perk);
    const { kind, code } = req.body || {};
    if (typeof kind !== 'string' || !LOADOUT_KINDS.includes(kind)) {
      return res.status(400).json({ error: '치장 종류가 올바르지 않습니다.', code: 'COSMETIC_KIND_INVALID' });
    }
    if (typeof code !== 'string') {
      return res.status(400).json({ error: '치장 코드가 올바르지 않습니다.', code: 'COSMETIC_CODE_INVALID' });
    }
    if (code !== '' && (!COSMETICS[code] || COSMETICS[code].kind !== kind)) {
      return res.status(400).json({ error: '해당 종류에서 사용할 수 없는 치장입니다.', code: 'COSMETIC_UNAVAILABLE' });
    }

    if (code) {
      const current = await User.findById(req.user.id).select('perks').lean();
      if (!current) return res.status(404).json({ error: 'user_not_found' });
      if (!Array.isArray(current.perks) || !current.perks.includes(code)) {
        return res.status(403).json({ error: '보유하지 않은 치장은 장착할 수 없습니다.', code: 'COSMETIC_NOT_OWNED' });
      }

      const rows = await Perk.find(scopedFilter(req, { code, isActive: true })).lean();
      const perk = dedupeScopedPerks(rows, req.user.id).find((row) => row.code === code);
      if (!perk || perk.isActive !== true || perk.effects?.cosmeticKind !== kind || !COSMETICS[code]) {
        return res.status(400).json({ error: '현재 장착할 수 없는 치장입니다.', code: 'COSMETIC_UNAVAILABLE' });
      }
    }

    const filter = { _id: req.user.id };
    if (code) filter.perks = code;
    const updated = await User.findOneAndUpdate(
      filter,
      { $set: { [`cosmeticLoadout.${kind}`]: code } },
      { new: true },
    );
    if (!updated) {
      const stillExists = await User.findById(req.user.id).select('_id').lean();
      if (!stillExists) return res.status(404).json({ error: 'user_not_found' });
      return res.status(409).json({ error: '보유 치장이 변경되어 장착을 저장하지 못했습니다. 목록을 새로고침해 주세요.', code: 'COSMETIC_OWNERSHIP_CONFLICT' });
    }
    const user = publicUser(updated);
    return res.json({
      user,
      cosmeticLoadout: user.cosmeticLoadout,
      cosmetics: user.cosmetics,
      message: code ? '치장을 적용했습니다.' : '치장 장착을 해제했습니다.',
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'cosmetic_loadout_save_failed' });
  }
});

router.post('/loadout', async (req, res) => {
  try {
    await ensureDefaultPublicPerks(Perk);
    const gameSlug = typeof req.body?.gameSlug === 'string' ? req.body.gameSlug.trim() : '';
    if (!PERK_LOADOUT_GAME_SLUGS.includes(gameSlug)) {
      return res.status(400).json({ error: 'game_slug_invalid', code: 'PERK_LOADOUT_GAME_INVALID' });
    }

    const inputCodes = req.body?.codes;
    if (!Array.isArray(inputCodes)) {
      return res.status(400).json({ error: 'codes_must_be_array', code: 'PERK_LOADOUT_CODES_INVALID' });
    }
    if (inputCodes.length > 3) {
      return res.status(400).json({ error: '특전은 게임별로 최대 3개까지 장착할 수 있습니다.', code: 'PERK_LOADOUT_LIMIT' });
    }
    const codes = inputCodes.map((value) => typeof value === 'string' ? value.trim() : '');
    if (codes.some((code) => !code)) {
      return res.status(400).json({ error: 'perk_code_invalid', code: 'PERK_LOADOUT_CODES_INVALID' });
    }
    if (new Set(codes).size !== codes.length) {
      return res.status(400).json({ error: '중복 특전은 장착할 수 없습니다.', code: 'PERK_LOADOUT_DUPLICATE' });
    }

    const current = await User.findById(req.user.id).select('perks').lean();
    if (!current) return res.status(404).json({ error: 'user_not_found' });
    const ownedCodes = new Set((Array.isArray(current.perks) ? current.perks : [])
      .map((value) => String(value || '').trim()).filter(Boolean));
    if (codes.some((code) => !ownedCodes.has(code))) {
      return res.status(403).json({ error: '보유하지 않은 특전은 장착할 수 없습니다.', code: 'PERK_LOADOUT_NOT_OWNED' });
    }

    const rows = codes.length
      ? await Perk.find(scopedFilter(req, { code: { $in: codes }, isActive: true })).lean()
      : [];
    const availableByCode = new Map(dedupeScopedPerks(rows, req.user.id).map((perk) => [String(perk.code || '').trim(), perk]));
    for (const code of codes) {
      const perk = availableByCode.get(code);
      const effects = perk?.effects && typeof perk.effects === 'object' ? perk.effects : {};
      if (!perk || perk.isActive !== true || effects.requiresEquip !== true || effects.gameSlug !== gameSlug) {
        return res.status(400).json({ error: '이 게임에서 장착할 수 없는 특전이 포함되어 있습니다.', code: 'PERK_LOADOUT_UNAVAILABLE' });
      }
    }

    const filter = { _id: req.user.id };
    if (codes.length) filter.perks = { $all: codes };
    const updated = await User.findOneAndUpdate(
      filter,
      { $set: { [`perkLoadouts.${gameSlug}`]: codes } },
      { new: true },
    );
    if (!updated) {
      const stillExists = await User.findById(req.user.id).select('_id').lean();
      if (!stillExists) return res.status(404).json({ error: 'user_not_found' });
      return res.status(409).json({ error: '보유 특전이 변경되어 장착을 저장하지 못했습니다. 목록을 새로고침해 주세요.', code: 'PERK_LOADOUT_CONFLICT' });
    }

    const perkLoadouts = normalizePerkLoadouts(updated.perkLoadouts);
    const user = publicUser(updated);
    return res.json({
      user,
      perkLoadouts,
      message: codes.length ? '게임 특전 장착을 저장했습니다.' : '게임 특전 장착을 해제했습니다.',
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'perk_loadout_save_failed' });
  }
});

router.post('/purchase', async (req, res) => {
  try {
    await ensureDefaultPublicPerks(Perk);
    const code = String(req.body?.code || '').trim();
    if (!code) return res.status(400).json({ error: 'code_required' });

    const rows = await Perk.find(scopedFilter(req, { code, isActive: true })).lean();
    const perk = dedupeScopedPerks(rows, req.user.id)[0];
    if (!perk) return res.status(404).json({ error: 'perk_not_found' });

    const cost = perk.lpCost;
    if (typeof cost !== 'number' || !Number.isSafeInteger(cost) || cost < 0) {
      return res.status(500).json({ error: '상품 가격을 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.', code: 'PERK_PRICE_INVALID' });
    }

    const user = await User.findOneAndUpdate(
      { _id: req.user.id, lp: { $gte: cost }, perks: { $ne: code } },
      { $inc: { lp: -cost }, $addToSet: { perks: code } },
      { new: true },
    );
    if (!user) {
      const current = await User.findById(req.user.id).lean();
      if (!current) return res.status(404).json({ error: 'user_not_found' });

      const owned = Array.isArray(current.perks) ? current.perks : [];
      if (owned.includes(code)) {
        return res.json({
          message: '이미 보유한 특전입니다.',
          lp: current.lp,
          perks: owned,
          user: publicUser(current),
        });
      }
      if (Number(current.lp || 0) < cost) return res.status(400).json({ error: 'LP가 부족합니다.' });
      return res.status(409).json({ error: '다른 구매가 처리 중입니다. 잠시 후 다시 시도해 주세요.', code: 'PERK_PURCHASE_CONFLICT' });
    }

    res.json({
      message: '특전 구매 완료',
      lp: user.lp,
      perks: user.perks,
      perk,
      user: publicUser(user),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'perk_purchase_failed' });
  }
});

module.exports = router;
