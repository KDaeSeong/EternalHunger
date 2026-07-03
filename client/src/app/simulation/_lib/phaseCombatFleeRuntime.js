import { buildErBehaviorModifier } from '../../../utils/erMeta';
import {
  applyHealingModifier,
  getRegenValue,
  getShieldValue,
} from '../../../utils/statusLogic';
import {
  buildTacStatusEffects,
  getTacEffectNumber,
  getTacTrigger,
} from '../tacticalSkillTable';
import {
  applyAiRecoveryWindow,
  applyRuntimeEffectPayloads,
  getEquipMoveSpeed,
  getPerkAggressionBias,
  upsertRuntimeSurvivor,
} from './simulationEngine';
import { collectRuntimeEffectResultTexts } from './runtimeStatus';

export function createPhaseCombatFleeRuntime({
  actions = {},
  state = {},
  tactical = {},
} = {}) {
  const {
    battleSettings = {},
    currentActionSec = () => 0,
    estimatePower = () => 0,
    forbiddenIds = new Set(),
    newDeadIds = [],
    restrictedRatio = 0,
    ruleset = {},
    survivorMap = new Map(),
    totalZonesCount = 0,
    zoneGraph = {},
  } = state;
  const {
    addLog = () => {},
    atNow = () => null,
    emitEffectRunEvents = () => {},
    emitRunEvent = () => {},
    getZoneName = (zoneId) => String(zoneId || ''),
  } = actions;
  const {
    applyTacUse = () => {},
    canUseTac = () => false,
    normalizeTac = (value) => value,
    tacModuleLevel = () => 0,
  } = tactical;

  const pickSparseSafeNeighbor = (fromZoneId) => {
    const from = String(fromZoneId || '');
    if (!from) return '';
    const neighbors = Array.isArray(zoneGraph?.[from]) ? zoneGraph[from].map((zoneId) => String(zoneId)) : [];
    const safeNeighbors = neighbors.filter((zoneId) => zoneId && !forbiddenIds.has(zoneId));
    if (!safeNeighbors.length) return from;

    const population = {};
    for (const survivor of survivorMap.values()) {
      if (!survivor || Number(survivor.hp || 0) <= 0) continue;
      if (newDeadIds.includes(survivor._id)) continue;
      const zoneId = String(survivor.zoneId || '');
      if (!zoneId) continue;
      population[zoneId] = (population[zoneId] || 0) + 1;
    }

    let dest = from;
    let bestPop = 1e9;
    for (const zoneId of safeNeighbors) {
      const pop = Number(population[zoneId] || 0);
      if (pop < bestPop) {
        bestPop = pop;
        dest = zoneId;
      }
    }
    return String(dest || from);
  };

  const resolveFleeSequence = (flee, chaser, opts = {}) => {
    const curZone = String(opts.curZone || flee?.zoneId || chaser?.zoneId || '');
    if (!flee || !chaser || !curZone) return null;
    const neighbors = Array.isArray(zoneGraph?.[curZone]) ? zoneGraph[curZone].map((zoneId) => String(zoneId)) : [];
    const safeNeighbors = neighbors.filter((zoneId) => zoneId && !forbiddenIds.has(zoneId));
    if (!safeNeighbors.length) return null;

    const fleeTac = normalizeTac(flee?.tacticalSkill);
    const chaseTac = normalizeTac(chaser?.tacticalSkill);
    const fleeTacTrig = getTacTrigger(fleeTac, 'flee');
    const chaseTacTrig = getTacTrigger(chaseTac, 'chase');
    const fleeLv = tacModuleLevel(flee);
    const chaseLv = tacModuleLevel(chaser);

    if (fleeTac === '블링크' && canUseTac(flee)) {
      const dest = pickSparseSafeNeighbor(curZone);
      flee.zoneId = String(dest || curZone);
      applyAiRecoveryWindow(flee, currentActionSec(), { reason: 'tac_blink_escape', opponentId: String(chaser?._id || ''), recoverSec: 8, safeZoneSec: 6 });
      upsertRuntimeSurvivor(survivorMap, flee);
      applyTacUse(flee, '블링크');
      addLog(`✨ [${flee.name}] 전술 스킬(블링크)로 도주! ${getZoneName(curZone)} → ${getZoneName(flee.zoneId)}`, 'combat-detail');
      emitRunEvent('move', { who: String(flee?._id || ''), name: flee?.name, from: curZone, to: String(flee.zoneId || ''), reason: 'tac_blink_escape' }, atNow());
      emitRunEvent('chase', { who: String(flee?._id || ''), whoName: flee?.name, chaserId: String(chaser?._id || ''), chaserName: chaser?.name, zoneId: String(flee.zoneId || curZone), outcome: 'blink_escape', escaped: true, caught: false, tacUsed: '블링크' }, atNow());
      return { escaped: true, caught: false, dest: String(flee.zoneId || curZone), fleeId: String(flee._id), chaserId: String(chaser._id), tacUsed: '블링크' };
    }

    const healBelowHp = Number(fleeTacTrig?.hpBelow ?? 55);
    if ((opts.allowHeal ?? true) && fleeTac === '치유의 바람' && canUseTac(flee) && Number(flee.hp || 0) > 0 && Number(flee.hp || 0) <= healBelowHp) {
      const maxHp = Number(flee?.maxHp ?? 100);
      const healCap = getTacEffectNumber('치유의 바람', 'healCap', 1 + fleeLv, 22);
      const rawHeal = Math.min(healCap, Math.max(0, maxHp - Number(flee.hp || 0)));
      const heal = applyHealingModifier(flee, rawHeal);
      const regenRecovery = getTacEffectNumber('치유의 바람', 'regenRecovery', 1 + fleeLv, 4);
      if (heal > 0 || regenRecovery > 0) {
        if (heal > 0) flee.hp = Math.min(maxHp, Number(flee.hp || 0) + heal);
        applyTacUse(flee, '치유의 바람');
        const tacEffects = applyRuntimeEffectPayloads(flee, buildTacStatusEffects('치유의 바람', 1 + fleeLv, 'tac_healwind'));
        const bits = [];
        if (heal > 0) bits.push(`HP +${heal}`);
        bits.push(...collectRuntimeEffectResultTexts(tacEffects.results));
        if (bits.length) addLog(`🌿 [${flee.name}] 전술 스킬(치유의 바람): ${bits.join(', ')}`, 'combat-detail');
        emitRunEvent('skill', { who: String(flee?._id || ''), whoName: flee?.name, skill: '치유의 바람', mode: 'escape_heal', zoneId: String(flee?.zoneId || curZone || ''), heal }, atNow());
        emitEffectRunEvents(flee, tacEffects.results, { source: 'tactical', skill: '치유의 바람', reason: 'escape_heal', zoneId: String(flee?.zoneId || curZone || '') }, atNow());
      }
    }

    const escTacBonus = (fleeTacTrig?.applyBonus === true)
      ? getTacEffectNumber(fleeTac, 'escapeBonus', 1 + fleeLv, 0)
      : 0;
    const chaseTacBonus = (chaseTacTrig?.applyBonus === true)
      ? Math.max(
        getTacEffectNumber(chaseTac, 'escapeBonus', 1 + chaseLv, 0),
        getTacEffectNumber(chaseTac, 'chaseBonus', 1 + chaseLv, 0)
      )
      : 0;
    const fleeMs = getEquipMoveSpeed(flee);
    const chaseMs = getEquipMoveSpeed(chaser);
    const fleeAggro = Math.max(0, getPerkAggressionBias(flee));
    const chaseAggro = Math.max(0, getPerkAggressionBias(chaser));
    const fleeHpRatio = Math.max(0, Math.min(1, Number(flee?.hp || 0) / Math.max(1, Number(flee?.maxHp || 100))));
    const chaseHpRatio = Math.max(0, Math.min(1, Number(chaser?.hp || 0) / Math.max(1, Number(chaser?.maxHp || 100))));
    const fleeShield = Math.max(0, getShieldValue(flee));
    const chaseShield = Math.max(0, getShieldValue(chaser));
    const fleeRegen = Math.max(0, getRegenValue(flee));
    const chaseRegen = Math.max(0, getRegenValue(chaser));
    const fleeEr = buildErBehaviorModifier(flee, battleSettings);
    const chaseEr = buildErBehaviorModifier(chaser, battleSettings);
    const escapeBase = Number(ruleset?.ai?.escapeBaseChance ?? 0.22);
    const msScale = Number(ruleset?.ai?.escapeMoveSpeedScale ?? 0.12);
    const pressurePenalty = Number(ruleset?.ai?.escapePressurePenalty ?? 0.28);
    const lowSafePenalty = Number(ruleset?.ai?.escapeLowSafePenalty ?? 0.15);
    const recoveryPenalty = Number(ruleset?.ai?.chaseRecoveryPenalty ?? 0.12);
    const safeCount = Math.max(0, totalZonesCount - forbiddenIds.size);
    const curForbidden = forbiddenIds.has(curZone);
    const powDelta = estimatePower(chaser) - estimatePower(flee);
    const fleeSustain = Math.min(0.14, fleeShield * 0.008 + fleeRegen * 0.02);
    const chaseSustain = Math.min(0.10, chaseShield * 0.006 + chaseRegen * 0.015);
    const chaserRecovering = Number(chaser?._aiRecoverUntilSec || 0) > Number(currentActionSec() || 0);

    let pEscape = escapeBase + (fleeMs - chaseMs) * msScale;
    pEscape += (escTacBonus && canUseTac(flee) && (fleeTacTrig?.applyBonus ?? true)) ? escTacBonus : 0;
    pEscape += Number(fleeEr?.escapeBonus || 0);
    pEscape -= Number(chaseEr?.chaseBonus || 0) * 0.7;
    if (curForbidden) pEscape -= 0.18;
    pEscape -= restrictedRatio * pressurePenalty;
    if (safeCount <= 3) pEscape -= lowSafePenalty;
    pEscape -= Math.max(0, Math.min(0.18, powDelta / 120));
    pEscape += Math.max(0, (0.42 - fleeHpRatio)) * 0.18;
    pEscape += fleeSustain;
    pEscape -= fleeAggro * 0.08;
    pEscape -= chaseAggro * 0.04;
    pEscape -= chaserRecovering ? recoveryPenalty * 0.45 : 0;
    pEscape = Math.max(0.05, Math.min(0.9, pEscape));

    const didEscape = (opts.forceAttempt === true) ? true : (Math.random() < pEscape);
    if (!didEscape) {
      emitRunEvent('chase', { who: String(flee?._id || ''), whoName: flee?.name, chaserId: String(chaser?._id || ''), chaserName: chaser?.name, zoneId: String(curZone || ''), outcome: 'escape_fail', escaped: false, caught: true, pEscape: Number(pEscape.toFixed(3)), fleeHpRatio: Number(fleeHpRatio.toFixed(3)), chaseHpRatio: Number(chaseHpRatio.toFixed(3)) }, atNow());
      return { escaped: false, fleeId: String(flee._id), chaserId: String(chaser._id) };
    }

    if (escTacBonus && canUseTac(flee) && (fleeTacTrig?.useOnCommit ?? true)) {
      applyTacUse(flee, fleeTac);
      addLog(`💨 [${flee.name}] 전술 스킬(${fleeTac})로 도주 보정!`, 'combat-detail');
      emitRunEvent('skill', { who: String(flee?._id || ''), whoName: flee?.name, skill: String(fleeTac || ''), mode: 'escape_bonus', zoneId: String(flee?.zoneId || curZone || '') }, atNow());
    }

    const dest = pickSparseSafeNeighbor(curZone);
    flee.zoneId = String(dest || curZone);
    applyAiRecoveryWindow(flee, currentActionSec(), { reason: String(opts.moveReason || 'escape'), opponentId: String(chaser?._id || ''), recoverSec: 8, safeZoneSec: 6 });
    upsertRuntimeSurvivor(survivorMap, flee);
    addLog(`🏃 [${flee.name}] ${opts.escapeText || '교전을 피하려 도주'}: ${getZoneName(curZone)} → ${getZoneName(flee.zoneId)}`, 'combat-detail');
    emitRunEvent('move', { who: String(flee?._id || ''), name: flee?.name, from: curZone, to: String(flee.zoneId || ''), reason: opts.moveReason || 'escape' }, atNow());

    const chaseBase = Number(ruleset?.ai?.chaseBaseChance ?? 0.25);
    const chaseMsScale = Number(ruleset?.ai?.chaseMoveSpeedScale ?? 0.14);
    let pChase = chaseBase + (chaseMs - fleeMs) * chaseMsScale + restrictedRatio * 0.10 + Math.max(0, Math.min(0.20, powDelta / 80));
    pChase += chaseAggro * 0.10;
    pChase += Number(chaseEr?.chaseBonus || 0);
    pChase -= fleeAggro * 0.04;
    pChase -= Number(fleeEr?.escapeBonus || 0) * 0.4;
    pChase -= Math.max(0, (0.55 - chaseHpRatio)) * 0.22;
    pChase += chaseSustain * 0.5;
    pChase -= chaserRecovering ? recoveryPenalty : 0;
    pChase += (chaseTacBonus && canUseTac(chaser) && (chaseTacTrig?.applyBonus ?? true)) ? chaseTacBonus : 0;
    pChase = Math.max(0, Math.min(0.95, pChase));

    const willChase = Math.random() < pChase;
    if (willChase && chaseTacBonus && canUseTac(chaser) && (chaseTacTrig?.useOnCommit ?? true)) {
      applyTacUse(chaser, chaseTac);
      addLog(`🧭 [${chaser.name}] 전술 스킬(${chaseTac})로 추격 강화!`, 'combat-detail');
      emitRunEvent('skill', { who: String(chaser?._id || ''), whoName: chaser?.name, skill: String(chaseTac || ''), mode: 'chase_bonus', zoneId: String(chaser?.zoneId || curZone || '') }, atNow());
    }
    if (!willChase) {
      applyAiRecoveryWindow(chaser, currentActionSec(), { reason: 'lost_track', opponentId: String(flee?._id || ''), recoverSec: 4, retargetZoneId: String(flee.zoneId || curZone), retargetTtl: 1 });
      emitRunEvent('chase', { who: String(flee?._id || ''), whoName: flee?.name, chaserId: String(chaser?._id || ''), chaserName: chaser?.name, zoneId: String(flee.zoneId || curZone), outcome: 'escape_no_chase', escaped: true, caught: false, pEscape: Number(pEscape.toFixed(3)), pChase: Number(pChase.toFixed(3)), fleeHpRatio: Number(fleeHpRatio.toFixed(3)), chaseHpRatio: Number(chaseHpRatio.toFixed(3)) }, atNow());
      return { escaped: true, caught: false, dest: String(flee.zoneId || curZone), fleeId: String(flee._id), chaserId: String(chaser._id) };
    }

    chaser.zoneId = String(flee.zoneId || curZone);
    applyAiRecoveryWindow(chaser, currentActionSec(), { reason: 'chase', opponentId: String(flee?._id || ''), recoverSec: 4, retargetZoneId: String(flee.zoneId || curZone), retargetTtl: 1 });
    upsertRuntimeSurvivor(survivorMap, chaser);
    addLog(`🏃‍♂️ [${chaser.name}] 추격! → ${getZoneName(chaser.zoneId)}`, 'combat-detail');
    emitRunEvent('move', { who: String(chaser?._id || ''), name: chaser?.name, from: curZone, to: String(chaser.zoneId || ''), reason: 'chase' }, atNow());

    const catchBase = Number(ruleset?.ai?.catchBaseChance ?? 0.35);
    const catchMsScale = Number(ruleset?.ai?.catchMoveSpeedScale ?? 0.18);
    let pCatch = catchBase + (chaseMs - fleeMs) * catchMsScale + restrictedRatio * 0.12 + Math.max(0, Math.min(0.25, powDelta / 70));
    pCatch += chaseAggro * 0.12;
    pCatch += Number(chaseEr?.chaseBonus || 0);
    pCatch -= fleeAggro * 0.05;
    pCatch -= Number(fleeEr?.escapeBonus || 0) * 0.5;
    pCatch -= Math.max(0, (0.5 - chaseHpRatio)) * 0.18;
    pCatch -= Math.min(0.18, fleeShield * 0.01 + fleeRegen * 0.03);
    pCatch += Math.min(0.08, chaseShield * 0.006 + chaseRegen * 0.012);
    pCatch += (chaseTacBonus && canUseTac(chaser)) ? (chaseTacBonus * 0.9) : 0;
    pCatch = Math.max(0.05, Math.min(0.95, pCatch));

    const caught = Math.random() < pCatch;
    if (!caught) {
      addLog(`💨 [${flee.name}] 간신히 따돌렸습니다.`, 'system');
      emitRunEvent('chase', { who: String(flee?._id || ''), whoName: flee?.name, chaserId: String(chaser?._id || ''), chaserName: chaser?.name, zoneId: String(flee.zoneId || curZone), outcome: 'escaped_after_chase', escaped: true, caught: false, pEscape: Number(pEscape.toFixed(3)), pChase: Number(pChase.toFixed(3)), pCatch: Number(pCatch.toFixed(3)) }, atNow());
      return { escaped: true, caught: false, dest: String(flee.zoneId || curZone), fleeId: String(flee._id), chaserId: String(chaser._id) };
    }

    const sustainMitigation = Math.min(5, Math.round(fleeShield * 0.12 + fleeRegen * 0.8));
    const finishBias = chaseHpRatio >= 0.7 ? 1 : 0;
    const pre = Math.min(13, Math.max(3, Math.round(4 + (chaseMs - fleeMs) * 6 + Math.max(0, powDelta) / 80 + finishBias - sustainMitigation)));
    flee.hp = Math.max(0, Number(flee.hp || 0) - pre);
    upsertRuntimeSurvivor(survivorMap, flee);
    addLog(`⚡ 추격전! [${chaser.name}]이(가) [${flee.name}]을(를) 따라잡아 기습합니다. (피해 -${pre})`, 'combat-detail');
    emitRunEvent('chase', { who: String(flee?._id || ''), whoName: flee?.name, chaserId: String(chaser?._id || ''), chaserName: chaser?.name, zoneId: String(flee.zoneId || curZone), outcome: 'caught', escaped: true, caught: true, preDamage: pre, fatal: Number(flee.hp || 0) <= 0, pEscape: Number(pEscape.toFixed(3)), pChase: Number(pChase.toFixed(3)), pCatch: Number(pCatch.toFixed(3)) }, atNow());
    return { escaped: true, caught: true, dest: String(flee.zoneId || curZone), preDamage: pre, fatal: Number(flee.hp || 0) <= 0, fleeId: String(flee._id), chaserId: String(chaser._id) };
  };

  return {
    pickSparseSafeNeighbor,
    resolveFleeSequence,
  };
}
