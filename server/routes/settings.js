// server/routes/settings.js
const express = require('express');
const router = express.Router();

const GameSettings = require('../models/GameSettings');

// ✅ 내 설정 불러오기 (없으면 기본값으로 생성)
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;

    let settings = await GameSettings.findOne({ userId });
    if (!settings) {
      settings = await new GameSettings({ userId }).save();
    }

    res.json(settings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "설정 로드 실패" });
  }
});

// ✅ 내 설정 저장/업데이트 (upsert)
router.put('/', async (req, res) => {
  try {
    const userId = req.user.id;

    // 허용 필드만 업데이트 (화이트리스트)
    const body = req.body || {};
    const patch = {};

    if (body.statWeights && typeof body.statWeights === 'object') {
      patch.statWeights = body.statWeights;
    }
    if (body.suddenDeathTurn !== undefined) patch.suddenDeathTurn = Number(body.suddenDeathTurn);
    if (body.killWeight !== undefined) patch.killWeight = Number(body.killWeight);

    if (body.forbiddenZoneStartDay !== undefined) patch.forbiddenZoneStartDay = Number(body.forbiddenZoneStartDay);
    if (body.forbiddenZoneDamageBase !== undefined) patch.forbiddenZoneDamageBase = Number(body.forbiddenZoneDamageBase);

    if (body.baseBattleProb !== undefined) patch.baseBattleProb = Number(body.baseBattleProb);
    if (body.itemSpawnRate !== undefined) patch.itemSpawnRate = Number(body.itemSpawnRate);

    // 🎮 룰 프리셋
    if (typeof body.rulesetId === 'string') {
      const allowed = ['ER_S10', 'LEGACY'];
      if (allowed.includes(body.rulesetId)) patch.rulesetId = body.rulesetId;
    }

    // 🗺️ 기본 맵 저장(선택값이 없으면 null로 초기화 가능)
    if (body.activeMapId !== undefined) {
      patch.activeMapId = body.activeMapId ? String(body.activeMapId) : null;
    }

    const updated = await GameSettings.findOneAndUpdate(
      { userId },
      { $set: patch, $currentDate: { updatedAt: true } },
      { new: true, upsert: true }
    );

    res.json({ message: "설정 저장 완료", settings: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "설정 저장 실패" });
  }
});

module.exports = router;
