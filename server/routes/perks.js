// server/routes/perks.js
const express = require('express');
const router = express.Router();

const User = require('../models/User');
const Perk = require('../models/Perk');
const { scopedFilter } = require('../utils/requestScope');
const { dedupeScopedPerks, ensureDefaultPublicPerks } = require('../utils/defaultPerks');

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
    const user = await User.findById(req.user.id).select('username nickname lp credits perks isAdmin badges statistics').lean();
    if (!user) return res.status(404).json({ error: 'user_not_found' });

    const rows = await Perk.find(scopedFilter(req, { isActive: true })).sort({ category: 1, lpCost: 1 }).lean();
    res.json({ perks: decoratePerks(rows, user), user: publicUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'perk_load_failed' });
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
