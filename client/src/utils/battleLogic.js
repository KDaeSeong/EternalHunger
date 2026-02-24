import { getEffectiveStats } from './statusLogic';

// 내부 유틸 (legacy/normalized 아이템 혼용 대응)
const norm = (v) => String(v ?? '').trim().toLowerCase();
const hasTag = (item, tag) => Array.isArray(item?.tags) && item.tags.map((t) => String(t)).includes(tag);

// 아이템 tier 유틸(없으면 1)
const getTier = (item) => Math.max(1, Number(item?.tier || 1));

const clampTier = (tier, maxTier) => {
  const t = Math.floor(Number(tier || 1));
  const m = Math.max(1, Math.floor(Number(maxTier || 1)));
  return Math.max(1, Math.min(m, t));
};

const isWeaponItem = (item) => {
  const t = norm(item?.type);
  // legacy(type='weapon') + normalized(한국어/동의어) 혼용
  if (['weapon', '무기', 'armory', '병기'].includes(t)) return true;
  // 태그 기반
  if (hasTag(item, 'weapon')) return true;
  return false;
};

const pickWeapon = (character) => {
  const inv = Array.isArray(character?.inventory) ? character.inventory : [];
  // ✅ 장착 우선
  const eqId = String(character?.equipped?.weapon || '');
  if (eqId) {
    const picked = inv.find((i) => String(i?.itemId || i?.id || i?._id || '') === eqId);
    if (picked) return picked;
  }
  const candidates = inv.filter((i) => String(i?.equipSlot || '') === 'weapon' || isWeaponItem(i));
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => getTier(b) - getTier(a));
  return candidates[0];
};

const pickEquipBySlot = (character, slot) => {
  const inv = Array.isArray(character?.inventory) ? character.inventory : [];
  const s = String(slot || '');
  // ✅ 장착 우선
  const eqId = String(character?.equipped?.[s] || '');
  if (eqId) {
    const picked = inv.find((i) => String(i?.itemId || i?.id || i?._id || '') === eqId);
    if (picked) return picked;
  }
  return inv.find((i) => String(i?.equipSlot || '') === s);
};

const getEquipDeltas = (character, settings = {}) => {
  const eq = settings?.battle?.equipment || settings?.equipment || {};
  const weaponAtkPerTier = Number(eq.weaponAtkPerTier ?? 0);
  const armorDefPerTier = Number(eq.armorDefPerTier ?? 0);
  const maxTier = Number(eq.maxTier ?? 5);

  // 무기 1개(weapon 슬롯)
  const wpn = pickWeapon(character);
  const wTier = wpn ? clampTier(getTier(wpn), maxTier) : 0;
  const ranged = !!wpn && (hasTag(wpn, 'ranged') || hasTag(wpn, 'shoot') || hasTag(wpn, 'gun') || hasTag(wpn, '총'));
  const weaponAtk = weaponAtkPerTier * wTier;

  // 방어구 4슬롯(머리/옷/팔/신발)
  const armorSlots = ['head', 'clothes', 'arm', 'shoes'];
  let armorTierSum = 0;
  for (const s of armorSlots) {
    const it = pickEquipBySlot(character, s);
    if (it) armorTierSum += clampTier(getTier(it), maxTier);
  }
  const armorDef = armorDefPerTier * armorTierSum;

  return {
    strAdd: ranged ? 0 : weaponAtk,
    shtAdd: ranged ? weaponAtk : 0,
    endAdd: armorDef,
    armorDef,
    weaponTier: wTier,
    armorTierSum,
    weaponIsRanged: ranged,
  };
};
// 장비 아이템(stats) 합산(새 카탈로그 대응)
// - equipmentCatalog.js에서 생성되는 stats(atk/hp/skillAmp/atkSpeed/critChance/cdr/lifesteal/moveSpeed)를 전투 점수에 반영
const getEquipStatTotals = (character) => {
  const totals = { atk: 0, hp: 0, skillAmp: 0, atkSpeed: 0, critChance: 0, cdr: 0, lifesteal: 0, moveSpeed: 0, weaponType: '', weaponIsRanged: false };
  const add = (src) => {
    const s = src && typeof src === 'object' ? src : {};
    totals.atk += Number(s.atk || 0);
    totals.hp += Number(s.hp || 0);
    totals.skillAmp += Number(s.skillAmp || 0);
    totals.atkSpeed += Number(s.atkSpeed || 0);
    totals.critChance += Number(s.critChance || 0);
    totals.cdr += Number(s.cdr || 0);
    totals.lifesteal += Number(s.lifesteal || 0);
    totals.moveSpeed += Number(s.moveSpeed || 0);
  };

  // 무기 1개(weapon)
  const wpn = pickWeapon(character);
  if (wpn) {
    add(wpn.stats);
    totals.weaponType = String(wpn.weaponType || '');
    totals.weaponIsRanged = hasTag(wpn, 'ranged') || hasTag(wpn, 'shoot') || hasTag(wpn, 'gun') || hasTag(wpn, '총');
  }

  // 방어구 4슬롯
  for (const s of ['head', 'clothes', 'arm', 'shoes']) {
    const it = pickEquipBySlot(character, s);
    if (it) add(it.stats);
  }

  // 과도한 스택 방지(체감 밸런스)
  totals.atkSpeed = Math.max(0, Math.min(0.75, totals.atkSpeed));
  totals.critChance = Math.max(0, Math.min(0.75, totals.critChance));
  totals.cdr = Math.max(0, Math.min(0.75, totals.cdr));
  totals.lifesteal = Math.max(0, Math.min(0.75, totals.lifesteal));
  totals.skillAmp = Math.max(0, Math.min(2.5, totals.skillAmp));
  totals.hp = Math.max(0, totals.hp);
  totals.atk = Math.max(0, totals.atk);

  return totals;
};


const formatEquipBrief = (character, eq) => {
  const name = String(character?.name || '???');
  const wTier = Number(eq?.weaponTier || 0);
  const aTier = Number(eq?.armorTierSum || 0);
  const strAdd = Number(eq?.strAdd || 0);
  const shtAdd = Number(eq?.shtAdd || 0);
  const endAdd = Number(eq?.endAdd || 0);

  const parts = [];
  if (wTier > 0) {
    const atkPart = strAdd > 0 ? `+STR${strAdd}` : (shtAdd > 0 ? `+SHT${shtAdd}` : '+ATK0');
    parts.push(`무기T${wTier}(${atkPart})`);
  }
  if (aTier > 0) parts.push(`방어T${aTier}(+END${endAdd})`);
  if (parts.length === 0) parts.push('장비 없음');
  return `[${name}] ${parts.join(' ')}`;
};

const getActiveSkillName = (character) => {
  const name = String(character?.specialSkill?.name || '').trim();
  if (!name) return '';
  // 기본값(=스킬 없음) 취급
  if (name === '평범함' || name === '없음' || name.toLowerCase() === 'none') return '';
  return name;
};

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
    const s1x = { ...s1, str: Number(s1?.str || 0) + Number(eq1.strAdd || 0), sht: Number(s1?.sht || 0) + Number(eq1.shtAdd || 0), end: Number(s1?.end || 0) + Number(eq1.endAdd || 0) };
    const s2x = { ...s2, str: Number(s2?.str || 0) + Number(eq2.strAdd || 0), sht: Number(s2?.sht || 0) + Number(eq2.shtAdd || 0), end: Number(s2?.end || 0) + Number(eq2.endAdd || 0) };
  
    // 1. 설정에서 가중치 꺼내기 (없으면 기본값 1.0)
    // 안전하게 꺼내기 위해 옵셔널 체이닝(?.) 사용
    const w = settings?.statWeights || { 
        str: 1.0, agi: 1.0, int: 1.0, men: 1.0, 
        luk: 1.0, dex: 1.0, sht: 1.0, end: 1.0 
    };

    // --- 서든데스 가중치 ---
    const suddenDeathMultiplier = 1 + (day * 0.1); 

    let score1 = 0;
    let score2 = 0;
    let logs = [];

    // 🧰 장비 티어/보정값 1줄(디버깅/밸런스 체감용)
    const equipLog = `🧰 장비: ${formatEquipBrief(p1, eq1)} / ${formatEquipBrief(p2, eq2)}`;
    logs.push(equipLog);

    // --- 2. 스킬 및 무기 보너스 (INT, MEN 적용) ---
    const getBonuses = (char, stats, opponentStats, selfEquipStats) => {
        let skillBonus = 0;
        let wpnBonus = 0;
        let skillLog = "";

        // 🧰 장비(stats) 합산 값
        const es = selfEquipStats || {};
        const equipSkillAmp = Number(es.skillAmp || 0);
        const equipCdr = Number(es.cdr || 0);
        const equipAtk = Number(es.atk || 0);
        const equipAtkSpeed = Number(es.atkSpeed || 0);
        const equipCritChance = Number(es.critChance || 0);
        const equipHp = Number(es.hp || 0);
        const equipLifesteal = Number(es.lifesteal || 0);

        // ★ 스킬 계수: INT가 높을수록 강화 / 상대 MEN이 높을수록 약화
        // - 기존 코드의 버그: w.int(=가중치)만 쓰고 stats.int(=캐릭 스탯)를 반영하지 않아 스킬이 사실상 고정 배율이었음
        const intScale = Number(settings?.battle?.skillIntScale ?? 0.01);          // INT 100 -> +1.0배
        const menResist = Number(settings?.battle?.skillMenResistScale ?? 0.004);  // MEN 100 -> -0.4배
        const offense = 1 + (Number(stats.int || 0) * Number(w.int || 1) * intScale);
        const resist = 1 - (Number(opponentStats.men || 0) * Number(w.men || 1) * menResist);
        const equipSkillMult = (1 + equipSkillAmp) * (1 + equipCdr * Number(settings?.battle?.equipCdrSkillScale ?? 0.35));
        const skillMult = Math.max(0.1, offense * Math.max(0.1, resist) * Math.max(0.1, equipSkillMult));

        // ✅ 특수스킬은 시뮬레이션에서 "발동 롤"이 난 경우만 들어오도록(=specialSkill 존재) 설계
        const skillName = getActiveSkillName(char);

        // [스킬] 시로코(기본): 드론 지원 (확률 발동)
        if (skillName && skillName.includes('드론')) {
            const droneScale = Number(settings?.battle?.shirokoDroneScale ?? 0.18);
            skillBonus = (Number(stats.sht || 0) * Number(w.sht || 1) * droneScale) * skillMult;
            skillLog = `🚁 [${char.name}]의 드론 지원 사격!`;
        }

        // [스킬] 시로코 테러: 심연의 힘 (체력이 충분히 깎였을 때만 폭발)
        if (skillName && skillName.includes('심연')) {
            const maxHp = Number(char?.maxHp ?? 100);
            const hp = Number(char?.hp ?? maxHp);
            const hpRatio = maxHp > 0 ? hp / maxHp : 1;
            const triggerBelow = Number(settings?.battle?.terrorAbyssHpBelow ?? 0.65); // HP 65% 이하부터 발동 가능
            if (hpRatio <= triggerBelow) {
                const missing = Math.max(0, maxHp - hp);
                const abyssScale = Number(settings?.battle?.terrorAbyssScale ?? 0.45);
                skillBonus = (missing * abyssScale) * skillMult;
                if (skillBonus > 12) skillLog = `🌑 [${char.name}]의 심연이 폭발합니다!`;
            }
        }

        // [스킬] 발도(오프너): 선제 기세 보너스(가벼운 점수 보정)
        // - 실제 선제 피해는 시뮬레이션(page.js)의 applyIaidoOpener에서 처리됨
        if (skillName && skillName.includes('발도')) {
            const iaidoScale = Number(settings?.battle?.iaidoScale ?? 0.12);
            const base = (Number(stats.agi || 0) * Number(w.agi || 1)) + (Number(stats.dex || 0) * Number(w.dex || 1));
            skillBonus = base * iaidoScale * (1 + day * 0.02);
            skillLog = `⚡ [${char.name}]의 발도!`;
        }

        // [무기] 인벤토리 확인 (type: weapon/무기 혼용 + 태그 기반)
        const wpn = pickWeapon(char);
        if (wpn) {
            const ranged = hasTag(wpn, 'ranged') || hasTag(wpn, 'shoot') || hasTag(wpn, 'gun') || hasTag(wpn, '총');
            const weaponScale = Number(settings?.battle?.weaponScale ?? 0.2);
            const tierMult = 1 + Math.max(0, getTier(wpn) - 1) * 0.25;
            const atkToStatScale = Number(settings?.battle?.equipAtkToStatScale ?? 0.35);
            const extraAtkStat = Number(equipAtk || 0) * (Number.isFinite(atkToStatScale) ? atkToStatScale : 0.35);
            wpnBonus = ranged
                ? ((Number(stats.sht || 0) + extraAtkStat) * Number(w.sht || 1) * weaponScale)
                : ((Number(stats.str || 0) + extraAtkStat) * Number(w.str || 1) * weaponScale);
            wpnBonus *= tierMult * (1 + Math.max(0, Number(equipAtkSpeed || 0)));
        }

        // 과도한 폭주 방지(체감 밸런스): 스킬 보너스 상한
        const cap = Number(settings?.battle?.skillBonusCap ?? 60);
        if (Number.isFinite(cap) && cap > 0) skillBonus = Math.min(skillBonus, cap);

        // 🧩 장비 부가 스코어(체력)
// - 흡혈은 "피해 후 회복"으로 따로 처리(아래 lifesteal 섹션)
        const hpScale = Number(settings?.battle?.equipHpScoreScale ?? 0.05);
        const extraScore = (Number(equipHp || 0) * (Number.isFinite(hpScale) ? hpScale : 0.05));

        return { skillBonus, wpnBonus, skillLog, extraScore, critChance: equipCritChance, lifesteal: equipLifesteal };
    };

    const p1Bonus = getBonuses(p1, s1x, s2x, es1);
    const p2Bonus = getBonuses(p2, s2x, s1x, es2);

    if (p1Bonus.skillLog) logs.push(p1Bonus.skillLog);
    if (p2Bonus.skillLog) logs.push(p2Bonus.skillLog);

    // --- 3. 점수 합산 (가중치 적용) ---
    score1 += (p1Bonus.skillBonus + p1Bonus.wpnBonus + Number(p1Bonus.extraScore || 0)) * suddenDeathMultiplier;
    score2 += (p2Bonus.skillBonus + p2Bonus.wpnBonus + Number(p2Bonus.extraScore || 0)) * suddenDeathMultiplier;

    // ★ [SHT vs AGI] 사격 vs 회피
    // 기존 0.5 같은 고정 상수 대신 가중치(w.sht, w.agi)를 직접 곱해 영향력 조절
    const shoot1 = Math.max(0, (s1x.sht * w.sht) - (s2x.agi * w.agi) - Number(eq2.armorDef || 0)) * suddenDeathMultiplier;
    const shoot2 = Math.max(0, (s2x.sht * w.sht) - (s1x.agi * w.agi) - Number(eq1.armorDef || 0)) * suddenDeathMultiplier;
    score1 += shoot1;
    score2 += shoot2;

    // ★ [STR+DEX vs END] 근접+손재주 vs 방어
    const melee1 = Math.max(0, (s1x.str * w.str) + (s1x.dex * w.dex) - (s2x.end * w.end)) * suddenDeathMultiplier;
    const melee2 = Math.max(0, (s2x.str * w.str) + (s2x.dex * w.dex) - (s1x.end * w.end)) * suddenDeathMultiplier;
    score1 += melee1;
    score2 += melee2;

    // ★ [LUK: 행운] 랜덤 변수 (크리티컬/운)
    // 행운이 높을수록 최대 20점까지 추가 점수 획득
    score1 += Math.random() * (s1x.luk * w.luk * 0.2); 
    score2 += Math.random() * (s2x.luk * w.luk * 0.2);
    // 🧨 공격량(피해량) 베이스: 스킬/무기 + 사격 + 근접
    const offenseBase1 = ((Number(p1Bonus.skillBonus || 0) + Number(p1Bonus.wpnBonus || 0)) * suddenDeathMultiplier) + shoot1 + melee1;
    const offenseBase2 = ((Number(p2Bonus.skillBonus || 0) + Number(p2Bonus.wpnBonus || 0)) * suddenDeathMultiplier) + shoot2 + melee2;
    let offense1 = offenseBase1;
    let offense2 = offenseBase2;

    // 🎯 치명타(장비 치확 기반): '실제 피해'에 가산 → 흡혈 회복에도 연동
    // - 기존 critBurstScale 설정값을 '치명타 추가 피해 비율'로 사용 (기본 +35%)
    const critDamageScale = Number(settings?.battle?.critBurstScale ?? 0.35);
    const c1 = Math.max(0, Math.min(0.75, Number(p1Bonus.critChance || 0)));
    const c2 = Math.max(0, Math.min(0.75, Number(p2Bonus.critChance || 0)));
    if (Math.random() < c1) {
      const extra = offenseBase1 * critDamageScale;
      offense1 += extra;
      score1 += extra;
      logs.push(`🎯 [${p1.name}] 치명타! (+${extra.toFixed(1)})`);
    }
    if (Math.random() < c2) {
      const extra = offenseBase2 * critDamageScale;
      offense2 += extra;
      score2 += extra;
      logs.push(`🎯 [${p2.name}] 치명타! (+${extra.toFixed(1)})`);
    }

    // 🩸 흡혈: 전투 피해 후 회복(1단계)
    // - 실제 HP 시뮬 대신, '회복량'을 생존/우위 점수에 반영
    // - healScore = (내가 준 피해량 기반) * lifesteal * scale
    const lifestealHealScale = Number(settings?.battle?.lifestealHealScoreScale ?? 0.35);

    const ls1 = Math.max(0, Math.min(0.75, Number(es1?.lifesteal || p1Bonus.lifesteal || 0)));
    const ls2 = Math.max(0, Math.min(0.75, Number(es2?.lifesteal || p2Bonus.lifesteal || 0)));

    const healScore1 = offense1 * ls1 * lifestealHealScale;
    const healScore2 = offense2 * ls2 * lifestealHealScale;

    if (healScore1 > 0.05) { score1 += healScore1; logs.push(`🩸 [${p1.name}] 흡혈 회복 +${healScore1.toFixed(1)}`); }
    if (healScore2 > 0.05) { score2 += healScore2; logs.push(`🩸 [${p2.name}] 흡혈 회복 +${healScore2.toFixed(1)}`); }



    // --- 무승부 판정 ---
    const diff = score1 - score2;
    const drawThreshold = Math.max(5, 30 - (day * 3)); 

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
