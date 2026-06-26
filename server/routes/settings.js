// server/routes/settings.js
const express = require('express');
const router = express.Router();

const GameSettings = require('../models/GameSettings');

const CURRENT_RULESET_ID = 'ER_S11';
const LEGACY_RULESET_ID = 'ER_S' + '10';

function normalizeRulesetId(id) {
  const raw = String(id || '').trim();
  if (!raw || raw === LEGACY_RULESET_ID) return CURRENT_RULESET_ID;
  return raw;
}

// Load settings. Create defaults when the user has no saved document.
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;

    let settings = await GameSettings.findOne({ userId });
    if (!settings) {
      settings = await new GameSettings({ userId }).save();
    }

    const normalizedRulesetId = normalizeRulesetId(settings.rulesetId);
    if (settings.rulesetId !== normalizedRulesetId) {
      settings.rulesetId = normalizedRulesetId;
      await settings.save();
    }

    res.json(settings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'settings_load_failed' });
  }
});

// Save settings with an explicit field allowlist.
router.put('/', async (req, res) => {
  try {
    const userId = req.user.id;
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

    if (typeof body.rulesetId === 'string') {
      const allowed = [CURRENT_RULESET_ID, 'LEGACY', LEGACY_RULESET_ID];
      const normalizedRulesetId = normalizeRulesetId(body.rulesetId);
      if (allowed.includes(body.rulesetId) || allowed.includes(normalizedRulesetId)) {
        patch.rulesetId = normalizedRulesetId;
      }
    }

    if (body.activeMapId !== undefined) {
      patch.activeMapId = body.activeMapId ? String(body.activeMapId) : null;
    }

    const updated = await GameSettings.findOneAndUpdate(
      { userId },
      { $set: patch, $currentDate: { updatedAt: true } },
      { new: true, upsert: true }
    );

    res.json({ message: 'settings_saved', settings: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'settings_save_failed' });
  }
});

module.exports = router;
