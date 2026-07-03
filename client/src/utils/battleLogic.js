import { getEffectiveStats } from './statusLogic';
import { buildErCombatModifier } from './erMeta';
import {
  formatEquipBrief,
  getEquipDeltas,
  getEquipStatTotals,
  getTier,
  getTotalArmorPen,
  pickWeapon,
  resolveAdaptiveForceStats,
} from './battleEquipmentLogic';

/**
 * ⚔️ 통합 전투 시뮬레이터 (보정치 적용됨)
 * @param {Object} p1 - 플레이어 1
 * @param {Object} p2 - 플레이어 2
 * @param {number} day - 현재 날짜
 * @param {Object} settings - ★ [추가] 게임 설정 객체 (가중치 포함)
 */
export function calculateBattle(p1, p2, day, settings = {}) {
    const s1 = getEffectiveStats(p1);
    const s2 = getEffectiveStats(p2);

    // 장비(무기/방어구) 보정: 룰셋 기반 상수는 settings.battle.equipment로 전달
    const eq1 = getEquipDeltas(p1, settings);
    const eq2 = getEquipDeltas(p2, settings);
    // ✅ 새 장비(stats) 합산(공격력/스증/공속/치확/쿨감/흡혈/체력 등)
    const es1 = getEquipStatTotals(p1);
    const es2 = getEquipStatTotals(p2);
    const adaptive1 = resolveAdaptiveForceStats(p1, s1, es1);
    const adaptive2 = resolveAdaptiveForceStats(p2, s2, es2);
    const s1x = {
      ...s1,
      maxHp: Number(s1?.maxHp || 0) + Number(es1.hp || 0),
      attackPower: Number(s1?.attackPower || 0) + Number(eq1.attackPowerAdd || 0) + Number(es1.atk || 0) + Number(adaptive1.attackPower || 0),
      skillAmp: Number(s1?.skillAmp || 0) + Number(es1.skillAmp || 0) * 100 + Number(adaptive1.skillAmp || 0),
      defense: Number(s1?.defense || 0) + Number(eq1.defenseAdd || 0) + Number(es1.def || 0),
      attackSpeed: Number(s1?.attackSpeed || 0) + Number(es1.atkSpeed || 0),
    };
    const s2x = {
      ...s2,
      maxHp: Number(s2?.maxHp || 0) + Number(es2.hp || 0),
      attackPower: Number(s2?.attackPower || 0) + Number(eq2.attackPowerAdd || 0) + Number(es2.atk || 0) + Number(adaptive2.attackPower || 0),
      skillAmp: Number(s2?.skillAmp || 0) + Number(es2.skillAmp || 0) * 100 + Number(adaptive2.skillAmp || 0),
      defense: Number(s2?.defense || 0) + Number(eq2.defenseAdd || 0) + Number(es2.def || 0),
      attackSpeed: Number(s2?.attackSpeed || 0) + Number(es2.atkSpeed || 0),
    };
  
    // 1. 설정에서 가중치 꺼내기 (없으면 기본값 1.0)
    // 안전하게 꺼내기 위해 옵셔널 체이닝(?.) 사용
    const w = {
        maxHp: 1.0,
        attackPower: 1.0,
        skillAmp: 1.0,
        defense: 1.0,
        attackSpeed: 1.0,
        attackRange: 1.0,
        sightRange: 1.0,
        ...(settings?.statWeights || {}),
    };

    // --- 서든데스 가중치 ---
    const suddenDeathMultiplier = 1 + (day * 0.1); 

    let score1 = 0;
    let score2 = 0;
    let logs = [];

    // 🧰 장비 티어/보정값 1줄(디버깅/밸런스 체감용)
    const equipLog = `🧰 장비: ${formatEquipBrief(p1, eq1)} / ${formatEquipBrief(p2, eq2)}`;
    logs.push(equipLog);

    // --- 2. 무기 및 장비 보너스 ---
    const getBonuses = (char, stats, selfEquipStats) => {
        let wpnBonus = 0;

        // 🧰 장비(stats) 합산 값
        const es = selfEquipStats || {};
        const equipAtk = Number(es.atk || 0);
        const equipAtkSpeed = Number(es.atkSpeed || 0);
        const equipCritChance = Number(es.critChance || 0);
        const equipHp = Number(es.hp || 0);
        const equipLifesteal = Number(es.lifesteal || 0);
        const equipArmorPen = getTotalArmorPen(char, es);

        // [무기] 인벤토리 확인 (type: weapon/무기 혼용 + 태그 기반)
        const wpn = pickWeapon(char);
        if (wpn) {
            const weaponScale = Number(settings?.battle?.weaponScale ?? 0.2);
            const tierMult = 1 + Math.max(0, getTier(wpn) - 1) * 0.25;
            const atkToStatScale = Number(settings?.battle?.equipAtkToStatScale ?? 0.35);
            const extraAtkStat = Number(equipAtk || 0) * (Number.isFinite(atkToStatScale) ? atkToStatScale : 0.35);
            wpnBonus = ((Number(stats.attackPower || 0) + extraAtkStat) * Number(w.attackPower || 1) * weaponScale);
            wpnBonus *= tierMult * (1 + Math.max(0, Number(equipAtkSpeed || 0)));
        }

        // 🧩 장비 부가 스코어(체력)
// - 흡혈은 "피해 후 회복"으로 따로 처리(아래 lifesteal 섹션)
        const hpScale = Number(settings?.battle?.equipHpScoreScale ?? 0.05);
        const extraScore = (Number(equipHp || 0) * (Number.isFinite(hpScale) ? hpScale : 0.05));

        return { wpnBonus, extraScore, critChance: equipCritChance, lifesteal: equipLifesteal, armorPen: equipArmorPen };
    };

    const p1Bonus = getBonuses(p1, s1x, es1);
    const p2Bonus = getBonuses(p2, s2x, es2);
    const er1 = buildErCombatModifier({ character: p1, stats: s1x, opponentStats: s2x, equipStats: es1, day, settings });
    const er2 = buildErCombatModifier({ character: p2, stats: s2x, opponentStats: s1x, equipStats: es2, day, settings });

    if (er1.log) logs.push(`[${p1.name}] ${er1.log}`);
    if (er2.log) logs.push(`[${p2.name}] ${er2.log}`);

    // --- 3. 점수 합산 (가중치 적용) ---
    score1 += (p1Bonus.wpnBonus + Number(p1Bonus.extraScore || 0) + Number(er1.score || 0)) * suddenDeathMultiplier;
    score2 += (p2Bonus.wpnBonus + Number(p2Bonus.extraScore || 0) + Number(er2.score || 0)) * suddenDeathMultiplier;

    const armorPen1 = getTotalArmorPen(p1, es1);
    const armorPen2 = getTotalArmorPen(p2, es2);
    const defense2AfterPen = Number(s2x.defense || 0) * (1 - armorPen1);
    const defense1AfterPen = Number(s1x.defense || 0) * (1 - armorPen2);

    const attackPressure1 = Math.max(0, (
      Number(s1x.attackPower || 0) * Number(w.attackPower || 1) +
      Number(s1x.skillAmp || 0) * 0.22 * Number(w.skillAmp || 1) +
      Number(s1x.attackSpeed || 0) * 12 * Number(w.attackSpeed || 1) +
      Number(s1x.attackRange || 0) * 1.4 * Number(w.attackRange || 1) +
      Number(s1x.sightRange || 0) * 0.45 * Number(w.sightRange || 1)
    ) - (
      defense2AfterPen * 0.58 * Number(w.defense || 1) +
      Number(s2x.maxHp || 0) * 0.035 * Number(w.maxHp || 1)
    )) * suddenDeathMultiplier;
    const attackPressure2 = Math.max(0, (
      Number(s2x.attackPower || 0) * Number(w.attackPower || 1) +
      Number(s2x.skillAmp || 0) * 0.22 * Number(w.skillAmp || 1) +
      Number(s2x.attackSpeed || 0) * 12 * Number(w.attackSpeed || 1) +
      Number(s2x.attackRange || 0) * 1.4 * Number(w.attackRange || 1) +
      Number(s2x.sightRange || 0) * 0.45 * Number(w.sightRange || 1)
    ) - (
      defense1AfterPen * 0.58 * Number(w.defense || 1) +
      Number(s1x.maxHp || 0) * 0.035 * Number(w.maxHp || 1)
    )) * suddenDeathMultiplier;
    score1 += attackPressure1;
    score2 += attackPressure2;

    const tempo1 = (Number(s1x.attackSpeed || 0) * 7 + Number(s1x.sightRange || 0) * 0.35 + Number(s1x.attackRange || 0) * 0.55) * suddenDeathMultiplier;
    const tempo2 = (Number(s2x.attackSpeed || 0) * 7 + Number(s2x.sightRange || 0) * 0.35 + Number(s2x.attackRange || 0) * 0.55) * suddenDeathMultiplier;
    score1 += tempo1;
    score2 += tempo2;

    // 🧨 공격량(피해량) 베이스: 무기 + 공격 압박
    const offenseBase1 = ((Number(p1Bonus.wpnBonus || 0) + Number(er1.offenseBonus || 0)) * suddenDeathMultiplier) + attackPressure1 + tempo1 * 0.35;
    const offenseBase2 = ((Number(p2Bonus.wpnBonus || 0) + Number(er2.offenseBonus || 0)) * suddenDeathMultiplier) + attackPressure2 + tempo2 * 0.35;
    const erBlockScale = Number(settings?.battle?.erBlockScale ?? 0.75);
    const erBlockCapRatio = Math.max(0, Math.min(0.75, Number(settings?.battle?.erBlockCapRatio ?? 0.42)));
    const erBlock1 = Math.min(Math.max(0, offenseBase2 * erBlockCapRatio), Math.max(0, Number(er1.block || 0) * erBlockScale));
    const erBlock2 = Math.min(Math.max(0, offenseBase1 * erBlockCapRatio), Math.max(0, Number(er2.block || 0) * erBlockScale));
    let offense1 = Math.max(0, offenseBase1 - erBlock2);
    let offense2 = Math.max(0, offenseBase2 - erBlock1);
    if (erBlock1 > 0.05) {
      score1 += erBlock1 * 0.45;
      score2 -= erBlock1 * 0.65;
      if (erBlock1 >= 4) logs.push(`🛡️ [${p1.name}] ER 방어 보정: 공격 흐름 -${erBlock1.toFixed(1)}`);
    }
    if (erBlock2 > 0.05) {
      score2 += erBlock2 * 0.45;
      score1 -= erBlock2 * 0.65;
      if (erBlock2 >= 4) logs.push(`🛡️ [${p2.name}] ER 방어 보정: 공격 흐름 -${erBlock2.toFixed(1)}`);
    }

    // 🎯 치명타(장비 치확 기반): '실제 피해'에 가산 → 흡혈 회복에도 연동
    // - 기존 critBurstScale 설정값을 '치명타 추가 피해 비율'로 사용 (기본 +35%)
    const critDamageScale = Number(settings?.battle?.critBurstScale ?? 0.35);
    const c1 = Math.max(0, Math.min(0.75, Number(p1Bonus.critChance || 0) + Number(er1.critChancePlus || 0)));
    const c2 = Math.max(0, Math.min(0.75, Number(p2Bonus.critChance || 0) + Number(er2.critChancePlus || 0)));
    if (Math.random() < c1) {
      const extra = offense1 * critDamageScale;
      offense1 += extra;
      score1 += extra;
      logs.push(`🎯 [${p1.name}] 치명타! (+${extra.toFixed(1)})`);
    }
    if (Math.random() < c2) {
      const extra = offense2 * critDamageScale;
      offense2 += extra;
      score2 += extra;
      logs.push(`🎯 [${p2.name}] 치명타! (+${extra.toFixed(1)})`);
    }

    // 🩸 흡혈: 전투 피해 후 회복(1단계)
    // - 실제 HP 시뮬 대신, '회복량'을 생존/우위 점수에 반영
    // - healScore = (내가 준 피해량 기반) * lifesteal * scale
    const lifestealHealScale = Number(settings?.battle?.lifestealHealScoreScale ?? 0.35);

    const ls1 = Math.max(0, Math.min(0.75, Number(es1?.lifesteal || p1Bonus.lifesteal || 0) + Number(er1.lifestealPlus || 0)));
    const ls2 = Math.max(0, Math.min(0.75, Number(es2?.lifesteal || p2Bonus.lifesteal || 0) + Number(er2.lifestealPlus || 0)));

    const healScore1 = offense1 * ls1 * lifestealHealScale;
    const healScore2 = offense2 * ls2 * lifestealHealScale;

    if (healScore1 > 0.05) { score1 += healScore1; logs.push(`🩸 [${p1.name}] 흡혈 회복 +${healScore1.toFixed(1)}`); }
    if (healScore2 > 0.05) { score2 += healScore2; logs.push(`🩸 [${p2.name}] 흡혈 회복 +${healScore2.toFixed(1)}`); }



    // --- 무승부 판정 ---
    const diff = score1 - score2;
    const pressure = Math.max(0, Math.min(1, Number(settings?.battle?.pressure ?? 0)));
    const nightBoost = settings?.battle?.isNight ? Number(settings?.battle?.nightDrawBoost ?? 2) : 0;
    const pressureCut = pressure * Number(settings?.battle?.pressureDrawCut ?? 10);
    const drawThreshold = Math.max(5, (30 - (day * 3)) + nightBoost - pressureCut); 

    if (Math.abs(diff) < drawThreshold) {
        const drawLogs = [
            `🤝 [${p1.name}]와(과) [${p2.name}]은(는) 치열한 접전 끝에 승부를 내지 못하고 물러납니다.`,
            `🛡️ [${p1.name}]의 기습을 [${p2.name}]이(가) 간신히 막아내고 거리를 벌립니다.`,
            `⚔️ [${p1.name}]와(과) [${p2.name}]의 무기가 격렬하게 부딪혔지만, 결정타는 없었습니다.`
        ];
        const randomLog = drawLogs[Math.floor(Math.random() * drawLogs.length)];
        return { winner: null, isDraw: true, log: `${equipLog}\n${randomLog}`, type: "normal" };
    }

    // --- 승리 판정 ---
    const winner = diff > 0 ? p1 : p2;
    const loser = diff > 0 ? p2 : p1;

    let winLog = "";
    if (day >= 5) {
        winLog = `🔥 [${winner.name}]의 치명적인 일격이 [${loser.name}]을(를) 완전히 분쇄했습니다!`;
    } else {
        winLog = `💀 [${winner.name}]이(가) [${loser.name}]을(를) 쓰러뜨리고 승리했습니다!`;
    }

    const finalLog = logs.length > 0 ? (logs.join('\n') + '\n' + winLog) : winLog;
    return { winner, log: finalLog, type: "death" };
}
