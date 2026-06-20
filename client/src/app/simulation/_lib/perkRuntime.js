export const PERK_EFFECT_DEFAULTS = {
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
  wildlifeCreditsPct: 0,
  wildlifeDamageMinus: 0,
  wildlifeLootPlus: 0,
  eventCreditsPct: 0,
  eventRecoveryPlus: 0,
  eventItemPlus: 0,
  bleedResistPct: 0,
  poisonResistPct: 0,
  burnResistPct: 0,
  bleedImmune: 0,
  poisonImmune: 0,
  burnImmune: 0,
  cleanseHealPlus: 0,
};

export const PERK_EFFECT_ALIASES = {
  hpPlus: ['hpPlus', 'healthPlus', 'maxHpPlusFlat', 'hp_flat'],
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
  wildlifeCreditsPct: ['wildlifeCreditsPct', 'huntCreditsPct', 'animalCreditsPct'],
  wildlifeDamageMinus: ['wildlifeDamageMinus', 'huntDamageMinus', 'animalDamageMinus'],
  wildlifeLootPlus: ['wildlifeLootPlus', 'huntLootPlus', 'animalLootPlus'],
  eventCreditsPct: ['eventCreditsPct', 'scenarioCreditsPct'],
  eventRecoveryPlus: ['eventRecoveryPlus', 'scenarioRecoveryPlus'],
  eventItemPlus: ['eventItemPlus', 'scenarioItemPlus', 'eventLootPlus'],
  bleedResistPct: ['bleedResistPct', 'bleedResist', 'bleedAvoidPct'],
  poisonResistPct: ['poisonResistPct', 'poisonResist', 'poisonAvoidPct', 'foodPoisonResistPct'],
  burnResistPct: ['burnResistPct', 'burnResist', 'burnAvoidPct'],
  bleedImmune: ['bleedImmune', 'immuneBleed'],
  poisonImmune: ['poisonImmune', 'immunePoison', 'foodPoisonImmune'],
  burnImmune: ['burnImmune', 'immuneBurn'],
  cleanseHealPlus: ['cleanseHealPlus', 'cleanseRecoveryPlus', 'medicalRecoveryPlus'],
};

export function perkNumber(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

export function normalizePerkPct(value) {
  const n = perkNumber(value);
  const ratio = Math.abs(n) > 1 ? (n / 100) : n;
  if (!Number.isFinite(ratio)) return 0;
  return Math.max(-0.95, Math.min(0.95, ratio));
}

export function normalizePerkEffects(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const out = { ...PERK_EFFECT_DEFAULTS };
  Object.entries(PERK_EFFECT_ALIASES).forEach(([targetKey, aliases]) => {
    for (const alias of aliases) {
      if (!Object.prototype.hasOwnProperty.call(src, alias)) continue;
      const value = src[alias];
      out[targetKey] = targetKey.endsWith('Pct') ? normalizePerkPct(value) : perkNumber(value);
      break;
    }
  });
  out.kioskDiscountPct = normalizePerkPct(out.kioskDiscountPct + out.marketDiscountPct);
  out.droneDiscountPct = normalizePerkPct(out.droneDiscountPct + out.marketDiscountPct);
  out.marketDiscountPct = normalizePerkPct(out.marketDiscountPct);
  out.saleBonusPct = normalizePerkPct(out.saleBonusPct);
  out.bleedResistPct = normalizePerkPct(out.bleedResistPct);
  out.poisonResistPct = normalizePerkPct(out.poisonResistPct);
  out.burnResistPct = normalizePerkPct(out.burnResistPct);
  out.bleedImmune = out.bleedImmune ? 1 : 0;
  out.poisonImmune = out.poisonImmune ? 1 : 0;
  out.burnImmune = out.burnImmune ? 1 : 0;
  return out;
}

export function buildPerkRuntimeBundle(codes, perks) {
  const ownedCodes = Array.isArray(codes) ? codes.map((x) => String(x || '').trim()).filter(Boolean) : [];
  const ownedSet = new Set(ownedCodes);
  const perkDocs = (Array.isArray(perks) ? perks : []).filter((perk) => ownedSet.has(String(perk?.code || '').trim()));
  const effects = { ...PERK_EFFECT_DEFAULTS };
  perkDocs.forEach((perk) => {
    const fx = normalizePerkEffects(perk?.effects);
    Object.keys(effects).forEach((key) => {
      effects[key] += perkNumber(fx[key]);
    });
  });
  effects.kioskDiscountPct = normalizePerkPct(effects.kioskDiscountPct);
  effects.droneDiscountPct = normalizePerkPct(effects.droneDiscountPct);
  effects.marketDiscountPct = normalizePerkPct(effects.marketDiscountPct);
  effects.saleBonusPct = normalizePerkPct(effects.saleBonusPct);
  return {
    codes: ownedCodes,
    docs: perkDocs,
    effects,
    summary: perkDocs.map((perk) => String(perk?.name || perk?.code || '').trim()).filter(Boolean).join(', '),
  };
}

export function getActorPerkEffects(actor) {
  return actor?._perkRuntime && typeof actor._perkRuntime === 'object' ? actor._perkRuntime : PERK_EFFECT_DEFAULTS;
}

export function applyPerkDiscount(cost, ...pctList) {
  const base = Math.max(0, Math.round(perkNumber(cost)));
  const totalPct = pctList.reduce((sum, pct) => sum + normalizePerkPct(pct), 0);
  const ratio = Math.max(0.05, 1 - Math.max(0, totalPct));
  return Math.max(0, Math.round(base * ratio));
}

export function getPerkLootBias(actorOrEffects) {
  const fx = actorOrEffects && typeof actorOrEffects === 'object' && Object.prototype.hasOwnProperty.call(actorOrEffects, 'lootWeightPlus')
    ? actorOrEffects
    : getActorPerkEffects(actorOrEffects);
  return Math.max(-0.6, Math.min(1.2, normalizePerkPct(fx?.lootWeightPlus || 0)));
}

export function getPerkAggressionBias(actorOrEffects) {
  const fx = actorOrEffects && typeof actorOrEffects === 'object' && Object.prototype.hasOwnProperty.call(actorOrEffects, 'aggressionPlus')
    ? actorOrEffects
    : getActorPerkEffects(actorOrEffects);
  return Math.max(-0.5, Math.min(1.0, normalizePerkPct(fx?.aggressionPlus || 0)));
}

export function applyPerkLootWeight(weight, actorOrEffects, opts = {}) {
  const baseWeight = Math.max(0, Number(weight || 0));
  if (!(baseWeight > 0)) return 0;
  const lootBias = getPerkLootBias(actorOrEffects);
  const rareBoost = Math.max(0, Number(opts?.rareBoost || 0));
  const ratio = Math.max(0.15, 1 + lootBias + Math.max(0, lootBias) * rareBoost);
  return Math.max(0.01, baseWeight * ratio);
}

export function getPerkWildlifeLootBias(actorOrEffects) {
  const fx = actorOrEffects && typeof actorOrEffects === 'object' && Object.prototype.hasOwnProperty.call(actorOrEffects, 'wildlifeLootPlus')
    ? actorOrEffects
    : getActorPerkEffects(actorOrEffects);
  const base = normalizePerkPct(fx?.lootWeightPlus || 0);
  const extra = normalizePerkPct(fx?.wildlifeLootPlus || 0);
  return Math.max(-0.6, Math.min(1.4, base + extra));
}

export function getPerkEventItemBias(actorOrEffects) {
  const fx = actorOrEffects && typeof actorOrEffects === 'object' && Object.prototype.hasOwnProperty.call(actorOrEffects, 'eventItemPlus')
    ? actorOrEffects
    : getActorPerkEffects(actorOrEffects);
  const base = Math.max(0, normalizePerkPct(fx?.lootWeightPlus || 0));
  const extra = Math.max(0, normalizePerkPct(fx?.eventItemPlus || 0));
  return Math.max(0, Math.min(1.2, base * 0.4 + extra));
}

export function applyPerkCreditBonus(amount, ...pctList) {
  const base = Math.max(0, perkNumber(amount));
  if (!(base > 0)) return 0;
  const totalPct = pctList.reduce((sum, pct) => sum + normalizePerkPct(pct), 0);
  return Math.max(0, Math.round(base * Math.max(0, 1 + totalPct)));
}

export function applyPerkDamageReduction(amount, ...minusList) {
  const base = Math.max(0, perkNumber(amount));
  if (!(base > 0)) return 0;
  const totalMinus = minusList.reduce((sum, v) => sum + Math.max(0, perkNumber(v)), 0);
  return Math.max(0, Math.round(base - totalMinus));
}

export function maybeBoostDropQty(qty, chance, maxExtra = 1) {
  let next = Math.max(1, Math.round(perkNumber(qty) || 1));
  const extraCap = Math.max(0, Math.round(perkNumber(maxExtra) || 0));
  const rollChance = Math.max(0, Math.min(0.95, Number(chance || 0)));
  for (let i = 0; i < extraCap; i += 1) {
    if (Math.random() < rollChance) next += 1;
  }
  return next;
}

export function applyPerkBundleToActor(actor, bundle, opts = {}) {
  if (!actor || typeof actor !== 'object') return actor;
  const perkBundle = bundle && typeof bundle === 'object' ? bundle : { codes: [], docs: [], effects: { ...PERK_EFFECT_DEFAULTS }, summary: '' };
  const fx = perkBundle.effects && typeof perkBundle.effects === 'object' ? perkBundle.effects : PERK_EFFECT_DEFAULTS;
  const next = actor;

  const baseStats = next._perkBaseStats && typeof next._perkBaseStats === 'object'
    ? { ...next._perkBaseStats }
    : { ...(next?.stats && typeof next.stats === 'object' ? next.stats : {}) };
  next._perkBaseStats = { ...baseStats };
  const statKeys = ['str', 'agi', 'int', 'men', 'luk', 'dex', 'sht', 'end'];
  const updatedStats = { ...baseStats };
  statKeys.forEach((key) => {
    if (!Object.prototype.hasOwnProperty.call(updatedStats, key)) updatedStats[key] = 0;
    updatedStats[key] = perkNumber(updatedStats[key]);
  });
  updatedStats.str += perkNumber(fx.strPlus) + perkNumber(fx.atkPlus);
  updatedStats.sht += perkNumber(fx.shtPlus) + perkNumber(fx.atkPlus);
  updatedStats.end += perkNumber(fx.endPlus) + perkNumber(fx.defPlus);
  updatedStats.agi += perkNumber(fx.agiPlus);
  updatedStats.int += perkNumber(fx.intPlus);
  updatedStats.men += perkNumber(fx.menPlus);
  updatedStats.luk += perkNumber(fx.lukPlus);
  updatedStats.dex += perkNumber(fx.dexPlus);
  next.stats = updatedStats;

  const baseMaxHp = perkNumber(next._perkBaseMaxHp ?? next.maxHp ?? 100) || 100;
  next._perkBaseMaxHp = baseMaxHp;
  const prevMaxHp = Math.max(1, perkNumber(next.maxHp || baseMaxHp) || baseMaxHp);
  const hpBonus = Math.max(0, perkNumber(fx.maxHpPlus) + perkNumber(fx.hpPlus));
  const desiredMaxHp = Math.max(1, Math.round(baseMaxHp + hpBonus));
  const currentHp = perkNumber(next.hp != null ? next.hp : prevMaxHp);
  const hpDelta = desiredMaxHp - prevMaxHp;
  next.maxHp = desiredMaxHp;
  if (opts.initialFill) next.hp = desiredMaxHp;
  else if (currentHp <= 0) next.hp = 0;
  else next.hp = Math.max(1, Math.min(desiredMaxHp, currentHp + Math.max(0, hpDelta)));

  const baseGrant = Math.max(0, Math.round(perkNumber(fx.startCreditsPlus) + perkNumber(fx.creditsPlus)));
  const prevGrant = Math.max(0, Math.round(perkNumber(next._perkGrantedCreditsTotal || 0)));
  const delta = Math.max(0, baseGrant - prevGrant);
  if (opts.applyCredits !== false && delta > 0) next.simCredits = Math.max(0, perkNumber(next.simCredits || 0) + delta);
  next._perkGrantedCreditsTotal = baseGrant;

  next._perkRuntime = { ...fx };
  next._perkCodes = Array.isArray(perkBundle.codes) ? perkBundle.codes.slice() : [];
  next._perkSummary = String(perkBundle.summary || '');
  return next;
}
