// client/src/utils/eventLogic.js
// ✅ 관전형 시뮬(플레이어 간섭 없음) 기준의 "동적(무작위) 이벤트" 생성기
// - 큰 보상/큰 처벌은 월드 스폰(상자/보스/변이/자연코어) 쪽에서 처리
// - 여기서는 "작은 사건"(휴식/가벼운 탐색/소량 수급/경미한 사고)을 중심으로
//   과도한 RNG 편향/아이템 미구축(가짜 ID) 문제를 줄입니다.

// (unused) equipmentCatalog import removed

// --- 텍스트 톤(짧고 자연스럽게) ---
const CONTEXTS = [
  { text: '주변을 조심스럽게 살피며', w: 2 },
  { text: '숨을 고르며', w: 2 },
  { text: '발자국 소리를 죽이고', w: 1 },
  { text: '서둘러', w: 1 },
];

function clamp(n, a, b) {
  const x = Number(n);
  if (!Number.isFinite(x)) return a;
  return Math.max(a, Math.min(b, x));
}

function pickWeighted(list) {
  const arr = Array.isArray(list) ? list : [];
  const total = arr.reduce((s, x) => s + Math.max(0, Number(x?.w ?? x?.weight ?? 1)), 0);
  if (total <= 0) return arr[0] || null;
  let r = Math.random() * total;
  for (const x of arr) {
    r -= Math.max(0, Number(x?.w ?? x?.weight ?? 1));
    if (r <= 0) return x;
  }
  return arr[arr.length - 1] || null;
}

function readStat(actor, keys) {
  const st = actor?.stats && typeof actor.stats === 'object' ? actor.stats : actor;
  for (const k of keys) {
    const v = Number(st?.[k] ?? st?.[String(k).toLowerCase?.()] ?? 0);
    if (Number.isFinite(v)) return v;
  }
  return 0;
}

function roughPower(actor) {
  const str = readStat(actor, ['STR', 'str']);
  const agi = readStat(actor, ['AGI', 'agi']);
  const sht = readStat(actor, ['SHOOT', 'SHT', 'shoot', 'sht']);
  const end = readStat(actor, ['END', 'end']);
  const men = readStat(actor, ['MEN', 'men']);
  return str + agi + sht + end + men * 0.5;
}

function safeTags(it) {
  if (!it) return [];
  if (Array.isArray(it.tags)) return it.tags.map(String);
  if (Array.isArray(it.tag)) return it.tag.map(String);
  return [];
}

function inferCategory(it) {
  const tags = safeTags(it);
  const type = String(it?.type || '').toLowerCase();
  const name = String(it?.name || '');
  const lower = name.toLowerCase();

  // equipSlot이 있으면 장비
  if (String(it?.equipSlot || '').trim()) return 'equipment';

  const isConsumable =
    type === 'food' ||
    type === 'consumable' ||
    tags.includes('food') ||
    tags.includes('drink') ||
    tags.includes('healthy') ||
    tags.includes('heal') ||
    tags.includes('medical') ||
    name.includes('스테이크') ||
    name.includes('치킨') ||
    name.includes('빵') ||
    name.includes('라면') ||
    name.includes('피자') ||
    name.includes('물') ||
    lower.includes('bandage') ||
    name.includes('붕대');

  if (isConsumable) return 'consumable';

  // 재료
  if (type.includes('재료') || tags.includes('material') || tags.includes('basic')) return 'material';

  // 기본값
  return 'misc';
}

function findItemsByFilter(publicItems, filterFn) {
  const list = Array.isArray(publicItems) ? publicItems : [];
  return list.filter((it) => it && it._id && filterFn(it));
}

function pickLowMaterial(publicItems) {
  // Tier1 재료(하급) 위주. 고기/특수 재료는 제외(그건 사냥/스폰에서 처리)
  const candidates = findItemsByFilter(publicItems, (it) => {
    const cat = inferCategory(it);
    if (cat !== 'material') return false;
    const tier = clamp(it?.tier ?? 1, 1, 9);
    if (tier !== 1) return false;
    const nm = String(it?.name || '');
    if (nm.includes('고기')) return false;
    // 운석/생나/미스릴/포스코어/VF는 월드 스폰/보스에서
    const low = nm.toLowerCase();
    if (nm.includes('운석') || nm.includes('생명의') || nm.includes('미스릴') || nm.includes('포스') || low.includes('vf')) return false;
    return true;
  });
  if (!candidates.length) return null;
  return candidates[Math.floor(Math.random() * candidates.length)] || null;
}

function pickFood(publicItems) {
  const candidates = findItemsByFilter(publicItems, (it) => {
    const cat = inferCategory(it);
    if (cat !== 'consumable') return false;
    const tags = safeTags(it);
    const nm = String(it?.name || '');
    // 의약(붕대)은 별도 이벤트에서
    const isMedical = tags.includes('medical') || tags.includes('heal') || nm.includes('붕대');
    if (isMedical) return false;
    // food/drink
    const ok = tags.includes('food') || tags.includes('drink') || nm.includes('빵') || nm.includes('스테이크') || nm.includes('치킨') || nm.includes('물');
    return ok;
  });
  if (!candidates.length) return null;
  // 스테이크/치킨 약간 가중
  const w = candidates.map((it) => {
    const nm = String(it?.name || '');
    let ww = 1;
    if (nm.includes('스테이크') || nm.includes('치킨')) ww += 1.2;
    if (nm.includes('당근')) ww += 0.8;
    return { it, w: ww };
  });
  return (pickWeighted(w)?.it) || candidates[0];
}

function pickMedical(publicItems) {
  const candidates = findItemsByFilter(publicItems, (it) => {
    const cat = inferCategory(it);
    if (cat !== 'consumable') return false;
    const tags = safeTags(it);
    const nm = String(it?.name || '');
    return tags.includes('medical') || tags.includes('heal') || nm.includes('붕대');
  });
  if (!candidates.length) return null;
  return candidates[Math.floor(Math.random() * candidates.length)] || null;
}

// [수정] publicItems를 추가 인자로 받아 DB(시드) 아이템 기반으로 이벤트를 생성
export function generateDynamicEvent(char, currentDay, ruleset, currentPhase = 'morning', publicItems = []) {
  const name = String(char?.name || '???');
  const day = Math.max(1, Number(currentDay || 1));
  const isNight = String(currentPhase || '') === 'night';

  const hp = clamp(char?.hp ?? 100, 0, 100);
  const maxHp = clamp(char?.maxHp ?? 100, 1, 999);
  const hpPct = clamp((hp / maxHp) * 100, 0, 100);

  const p = roughPower(char);
  const context = (pickWeighted(CONTEXTS) || CONTEXTS[0]).text;

  // "합리적" 이벤트 설계:
  // - 아이템 미구축(fake id) 생성 금지
  // - 큰 보상/특수재료는 월드 스폰에서
  // - HP 낮으면 휴식/의약품 우선

  const baseNothing = 5.0;
  const baseRest = 1.4;
  const baseScavenge = 0.85;
  const baseFood = 0.85;
  const baseMedical = 0.6;
  const baseMishap = 0.35;
  const baseMinorFight = 0.35;

  const needHealBoost = hpPct < 55 ? (55 - hpPct) / 10 : 0;
  const nightRiskBoost = isNight ? 0.6 : 0;
  const dayLootBoost = !isNight ? 0.25 : 0;

  const pool = [
    { k: 'nothing', w: baseNothing + (isNight ? 0.3 : 0) },
    { k: 'rest', w: baseRest + needHealBoost },
    { k: 'medical', w: baseMedical + needHealBoost * 0.8 },
    { k: 'scavenge', w: baseScavenge + dayLootBoost },
    { k: 'food', w: baseFood + (hpPct < 70 ? 0.2 : 0) },
    { k: 'mishap', w: baseMishap + nightRiskBoost + Math.max(0, (day - 2) * 0.12) },
    { k: 'minor_fight', w: baseMinorFight + nightRiskBoost + Math.max(0, (day - 3) * 0.10) },
  ];

  const picked = pickWeighted(pool) || { k: 'nothing' };

  // 1) 아무 일 없음
  if (picked.k === 'nothing') {
    return { silent: true, log: '', damage: 0, recovery: 0, drop: null };
  }

  // 2) 휴식/회복
  if (picked.k === 'rest') {
    const healBase = isNight ? 5 : 7;
    const heal = clamp(Math.floor(healBase + Math.random() * 6 + p / 45), 3, 18);
    // HP가 충분히 높으면(특히 낮) 휴식 로그는 생략해 로그 스팸을 줄입니다.
    const silent = (!isNight && hpPct >= 85 && Math.random() < 0.65);
    return { silent, log: silent ? '' : `🧘 [${name}] ${context} 잠시 숨을 고르며 체력을 회복했다. (HP +${heal})`, damage: 0, recovery: heal, drop: null };
  }

  // 3) 의약품 획득(HP 낮을수록)
  if (picked.k === 'medical') {
    const med = pickMedical(publicItems);
    if (med?._id) {
      return {
        log: `🩹 [${name}] ${context} 응급 상자를 발견했다. → ${med.name} x1`,
        damage: 0,
        recovery: 0,
        drop: { item: med, itemId: String(med._id), qty: 1 },
        // 노출 보너스는 최소
        pvpBonusNext: 0.08,
      };
    }
    // fallback: 회복으로 대체
    const heal = clamp(Math.floor(4 + Math.random() * 6), 3, 12);
    return { log: `🩹 [${name}] ${context} 응급 처치를 했다. (HP +${heal})`, damage: 0, recovery: heal, drop: null };
  }

  // 4) 소량 재료 획득
  if (picked.k === 'scavenge') {
    // 낮에 조금 더 잘 나옴
    const mat = pickLowMaterial(publicItems);
    if (mat?._id) {
      const qty = 1;
      return {
        log: `🧾 [${name}] ${context} 주변을 뒤져 ${mat.name} x${qty}을(를) 챙겼다.`,
        damage: 0,
        recovery: 0,
        drop: { item: mat, itemId: String(mat._id), qty },
        // 수색은 노출을 약간 올림
        pvpBonusNext: 0.16,
      };
    }
    // fallback: 경미한 크레딧
    const cr = Math.max(0, Math.floor(Number(ruleset?.credits?.scavenge ?? 3) + Math.random() * 3));
    return { log: `💳 [${name}] ${context} 잔돈을 주워 크레딧 +${cr}`, damage: 0, recovery: 0, earnedCredits: cr, drop: null };
  }

  // 5) 음식 획득(작게)
  if (picked.k === 'food') {
    const food = pickFood(publicItems);
    if (food?._id) {
      return {
        log: `🍞 [${name}] ${context} 먹을 것을 발견했다. → ${food.name} x1`,
        damage: 0,
        recovery: 0,
        drop: { item: food, itemId: String(food._id), qty: 1 },
        pvpBonusNext: 0.10,
      };
    }
    return { log: `🍞 [${name}] ${context} 먹을 것을 찾았지만 쓸 만한 건 없었다.`, damage: 0, recovery: 0, drop: null };
  }

  // 6) 경미한 사고(함정/낙뢰/낙상 등) — 관전형용으로 피해를 낮추고, 빈도를 줄임
  if (picked.k === 'mishap') {
    const base = isNight ? 4 : 3;
    const late = Math.max(0, day - 4) * 0.5;
    const dmg = clamp(Math.floor(base + Math.random() * 4 + late - p / 90), 1, 10);
    return {
      log: `⚠️ [${name}] ${context} 발밑을 잘못 디뎌 살짝 다쳤다. (피해 -${dmg})`,
      damage: dmg,
      recovery: 0,
      drop: null,
    };
  }

  // 7) 작은 교전(누군가와 스쳐 싸움) — 실제 PvP는 메인 로직이 처리하므로 여기선 '경미'만
  if (picked.k === 'minor_fight') {
    const base = isNight ? 6 : 5;
    const late = Math.max(0, day - 3) * 0.6;
    const dmg = clamp(Math.floor(base + Math.random() * 6 + late - p / 80), 2, 14);
    const cr = Math.max(0, Math.floor(Number(ruleset?.credits?.skirmish ?? 2) + Math.random() * 3));
    return {
      log: `⚔️ [${name}] ${context} 누군가와 마주쳐 짧게 충돌했다. (피해 -${dmg})${cr > 0 ? ` (크레딧 +${cr})` : ''}`,
      damage: dmg,
      recovery: 0,
      earnedCredits: cr,
      drop: null,
      // 노출 증가(다음 페이즈 교전 확률 약간↑)
      pvpBonusNext: 0.14,
    };
  }

  // fallback
  return { silent: true, log: '', damage: 0, recovery: 0, drop: null };
}

