import {
  areSameTeam,
  upsertRuntimeSurvivor,
} from './simulationEngine';

export function createPhaseCombatSkillSplashRuntime({
  actions = {},
  state = {},
} = {}) {
  const {
    newDeadIds = [],
    phaseIdxNow = 0,
    survivorMap = new Map(),
  } = state;
  const {
    addLog = () => {},
    applyCombatElimination = () => ({ assistId: null }),
    atNow = () => null,
    emitRunEvent = () => {},
    grantPvpDamageMastery = () => {},
    shieldBlock = (_target, rawDamage) => Math.max(0, Number(rawDamage || 0)),
  } = actions;

  const getCharacterSkillSplashTargets = (attacker, primaryTarget) => {
    const zoneId = String(primaryTarget?.zoneId || attacker?.zoneId || '');
    const attackerId = String(attacker?._id || '');
    const primaryId = String(primaryTarget?._id || '');
    if (!zoneId || !attackerId) return [];

    return Array.from(survivorMap.values()).filter((survivor) => {
      const survivorId = String(survivor?._id || '');
      if (!survivorId || survivorId === attackerId || survivorId === primaryId) return false;
      if (newDeadIds.includes(survivorId) || Number(survivor?.hp || 0) <= 0) return false;
      if (String(survivor?.zoneId || '') !== zoneId) return false;
      return !areSameTeam(attacker, survivor);
    });
  };

  const applyCharacterSkillSplashDamage = (attacker, splashHits) => {
    if (!attacker || !Array.isArray(splashHits) || splashHits.length <= 0) return 0;
    let total = 0;

    for (const hit of splashHits) {
      const splashTarget = hit?.target;
      const targetId = String(splashTarget?._id || '');
      if (!targetId || newDeadIds.includes(targetId) || Number(splashTarget?.hp || 0) <= 0) continue;

      const raw = Math.max(0, Number(hit?.damage || 0));
      if (raw <= 0) continue;

      const prevDamagedBySplash = String(splashTarget?.lastDamagedBy || '');
      const prevDamagedPhaseIdxSplash = Number(splashTarget?.lastDamagedPhaseIdx ?? -9999);
      const finalSplash = shieldBlock(splashTarget, raw);
      if (finalSplash <= 0) continue;

      splashTarget.hp = Math.max(0, Number(splashTarget.hp || 0) - finalSplash);
      splashTarget.lastDamagedBy = String(attacker?._id || '');
      splashTarget.lastDamagedPhaseIdx = phaseIdxNow;
      total += finalSplash;

      addLog(`🌀 광역 피해: [${attacker.name}] ${String(hit?.skill || '스킬')} → [${splashTarget.name}] -${finalSplash}`, 'highlight');
      emitRunEvent('battle', {
        a: String(attacker?._id || ''),
        b: targetId,
        winner: Number(splashTarget.hp || 0) <= 0 ? String(attacker?._id || '') : '',
        lethal: Number(splashTarget.hp || 0) <= 0,
        zoneId: String(splashTarget?.zoneId || attacker?.zoneId || ''),
        subkind: 'character_skill_splash',
      }, atNow());
      grantPvpDamageMastery(attacker, { damageDealt: finalSplash, damageTaken: 0 }, '스킬 광역');

      if (Number(splashTarget.hp || 0) <= 0) {
        applyCombatElimination(attacker, splashTarget, {
          prevDamagedBy: prevDamagedBySplash,
          prevDamagedPhaseIdx: prevDamagedPhaseIdxSplash,
          killText: '스킬 처치',
          deathReason: 'character_skill_splash',
          deathCauseName: `${String(hit?.skill || '스킬')} 광역 피해`,
          damageDealt: finalSplash,
        });
      } else {
        upsertRuntimeSurvivor(survivorMap, splashTarget);
      }
    }

    return total;
  };

  return {
    applyCharacterSkillSplashDamage,
    getCharacterSkillSplashTargets,
  };
}
