const DEFAULT_KEYS = {
  hpPlus: 0,
  maxHpPlus: 0,
  startCreditsPlus: 0,
  creditsPlus: 0,
  atkPlus: 0,
  defPlus: 0,
  moveSpeedPlus: 0,
  strPlus: 0,
  agiPlus: 0,
  intPlus: 0,
  menPlus: 0,
  lukPlus: 0,
  dexPlus: 0,
  shtPlus: 0,
  endPlus: 0,
  kioskDiscountPct: 0,
  droneDiscountPct: 0,
  marketDiscountPct: 0,
  kioskChancePlus: 0,
  droneChancePlus: 0,
  craftChancePlus: 0,
  goalWeightPlus: 0,
  lootWeightPlus: 0,
  aggressionPlus: 0,
  saleBonusPct: 0,
};

const EFFECT_ALIASES = {
  hpPlus: ['hpPlus', 'maxHpPlusFlat', 'healthPlus', 'healthFlat', 'hp_flat'],
  maxHpPlus: ['maxHpPlus', 'maxHealthPlus'],
  startCreditsPlus: ['startCreditsPlus', 'simCreditsPlus', 'startingCreditsPlus'],
  creditsPlus: ['creditsPlus'],
  atkPlus: ['atkPlus', 'attackPlus', 'attackFlat'],
  defPlus: ['defPlus', 'defensePlus', 'armorPlus'],
  moveSpeedPlus: ['moveSpeedPlus', 'movePlus', 'msPlus'],
  strPlus: ['strPlus'],
  agiPlus: ['agiPlus'],
  intPlus: ['intPlus'],
  menPlus: ['menPlus'],
  lukPlus: ['lukPlus'],
  dexPlus: ['dexPlus'],
  shtPlus: ['shtPlus'],
  endPlus: ['endPlus'],
  kioskDiscountPct: ['kioskDiscountPct', 'kioskDiscount', 'shopDiscountPct'],
  droneDiscountPct: ['droneDiscountPct', 'droneDiscount'],
  marketDiscountPct: ['marketDiscountPct', 'marketDiscount', 'discountPct'],
  kioskChancePlus: ['kioskChancePlus', 'shopChancePlus'],
  droneChancePlus: ['droneChancePlus'],
  craftChancePlus: ['craftChancePlus', 'craftBias'],
  goalWeightPlus: ['goalWeightPlus', 'goalBias', 'goalPriorityPlus'],
  lootWeightPlus: ['lootWeightPlus', 'lootBiasPlus'],
  aggressionPlus: ['aggressionPlus', 'combatAggroPlus'],
  saleBonusPct: ['saleBonusPct', 'sellBonusPct'],
};

function toFiniteNumber(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function normalizePct(value) {
  const n = toFiniteNumber(value);
  const ratio = Math.abs(n) > 1 ? (n / 100) : n;
  if (!Number.isFinite(ratio)) return 0;
  return Math.max(-0.95, Math.min(0.95, ratio));
}

function normalizePerkEffects(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const out = { ...DEFAULT_KEYS };
  for (const [targetKey, aliases] of Object.entries(EFFECT_ALIASES)) {
    for (const alias of aliases) {
      if (!Object.prototype.hasOwnProperty.call(src, alias)) continue;
      const value = src[alias];
      out[targetKey] = targetKey.endsWith('Pct') ? normalizePct(value) : toFiniteNumber(value);
      break;
    }
  }
  return out;
}

function mergePerkEffects(list) {
  const out = { ...DEFAULT_KEYS };
  for (const raw of Array.isArray(list) ? list : []) {
    const fx = normalizePerkEffects(raw);
    for (const key of Object.keys(out)) {
      out[key] += toFiniteNumber(fx[key]);
    }
  }
  out.kioskDiscountPct = normalizePct(out.kioskDiscountPct + out.marketDiscountPct);
  out.droneDiscountPct = normalizePct(out.droneDiscountPct + out.marketDiscountPct);
  out.marketDiscountPct = normalizePct(out.marketDiscountPct);
  out.saleBonusPct = normalizePct(out.saleBonusPct);
  return out;
}

async function getOwnedPerkContext(user, PerkModel) {
  const codes = Array.isArray(user?.perks) ? user.perks.map((x) => String(x || '').trim()).filter(Boolean) : [];
  if (!codes.length) return { codes: [], perks: [], effects: { ...DEFAULT_KEYS } };
  const perks = await PerkModel.find({ code: { $in: codes }, isActive: true }).lean();
  return { codes, perks, effects: mergePerkEffects(perks.map((p) => p?.effects)) };
}

function applyDiscountedCost(cost, ...pcts) {
  const base = Math.max(0, Math.round(toFiniteNumber(cost)));
  const total = pcts.reduce((sum, pct) => sum + normalizePct(pct), 0);
  const ratio = Math.max(0.05, 1 - Math.max(0, total));
  return Math.max(0, Math.round(base * ratio));
}

function applySaleBonus(credits, pct) {
  const base = Math.max(0, Math.round(toFiniteNumber(credits)));
  const ratio = 1 + Math.max(0, normalizePct(pct));
  return Math.max(0, Math.round(base * ratio));
}

module.exports = {
  normalizePerkEffects,
  mergePerkEffects,
  getOwnedPerkContext,
  applyDiscountedCost,
  applySaleBonus,
};
