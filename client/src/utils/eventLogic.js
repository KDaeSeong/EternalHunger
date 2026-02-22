// client/src/utils/eventLogic.js

const keywordDB = {
    contexts: [
        { text: "배가 너무 고파서 허겁지겁", condition: "hungry" },
        { text: "살기 가득한 눈빛으로", condition: "angry" },
        { text: "콧노래를 흥얼거리며", condition: "normal" },
        { text: "상처를 부여잡고", condition: "injured" }
    ],
    objects: [
        { id: "food_01", text: "수상한 샌드위치", type: "food", tags: ["poison"] },
        { id: "food_02", text: "신선한 사과", type: "food", tags: ["healthy"] },
        { id: "misc_01", text: "전공 서적", type: "misc", tags: ["book"] },
        { id: "misc_02", text: "오래된 구급상자", type: "misc", tags: ["heal"] }
    ]
};


// --- 수집/보스 드랍 재료(간단 풀) ---
const MAT_ITEMS = {
  meteor: { id: 'mat_meteor', text: '운석 파편', type: 'material', tags: ['material', 'meteor'] },
  worldTree: { id: 'mat_world_tree', text: '생명의 나무 수액', type: 'material', tags: ['material', 'tree', 'world_tree'] },
  forceCore: { id: 'mat_force_core', text: '포스 코어', type: 'material', tags: ['material', 'core', 'force_core'] },
  mithril: { id: 'mat_mithril', text: '미스릴', type: 'material', tags: ['material', 'mithril'] },
  vfBlood: { id: 'mat_vf_blood', text: 'VF 혈액 샘플', type: 'material', tags: ['material', 'vf', 'blood'] },
};

function cloneMat(mat, day) {
  return { ...mat, acquiredDay: day };
}

// --- 장비/무기 랜덤 생성(간단 풀) ---
const EQUIP_GRADES = [
  { tier: 1, ko: '일반', w: 55 },
  { tier: 2, ko: '고급', w: 25 },
  { tier: 3, ko: '희귀', w: 12 },
  { tier: 4, ko: '영웅', w: 6 },
  { tier: 5, ko: '전설', w: 1.6 },
  { tier: 6, ko: '초월', w: 0.4 },
];

const WEAPON_TYPES = [
  { ko: '권총', ranged: true },
  { ko: '돌소총', ranged: true },
  { ko: '저격총', ranged: true },
  { ko: '장갑', ranged: false },
  { ko: '톤파', ranged: false },
  { ko: '쌍절곤', ranged: false },
  { ko: '아르카나', ranged: true },
  { ko: '검', ranged: false },
  { ko: '쌍검', ranged: false },
  { ko: '망치', ranged: false },
  { ko: '방망이', ranged: false },
  { ko: '채찍', ranged: false },
  { ko: '투척', ranged: true },
  { ko: '암기', ranged: true },
  { ko: '활', ranged: true },
  { ko: '석궁', ranged: true },
  { ko: '도끼', ranged: false },
  { ko: '단검', ranged: false },
  { ko: '창', ranged: false },
  { ko: '레이피어', ranged: false },
];

const ARMOR_SLOTS = [
  { slot: 'clothes', ko: '옷' },
  { slot: 'head', ko: '머리' },
  { slot: 'arm', ko: '팔' },
  { slot: 'shoes', ko: '신발' },
];

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

function uid(prefix) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1e9)}`;
}

function rollGrade(day = 1) {
  // 진행이 늦어질수록 상위 등급이 아주 조금 더 잘 뜨게(가벼운 보정)
  const d = Math.max(1, Number(day || 1));
  const boost = Math.min(2.2, 1 + d * 0.03);
  const tweaked = EQUIP_GRADES.map((g) => ({ ...g, w: g.tier >= 4 ? g.w * boost : g.w }));
  return pickWeighted(tweaked) || EQUIP_GRADES[0];
}

function makeWeapon(day = 1) {
  const g = rollGrade(day);
  const w = WEAPON_TYPES[Math.floor(Math.random() * WEAPON_TYPES.length)];
  const tags = ['weapon', w.ranged ? 'ranged' : 'melee', w.ranged ? '총' : '근접', w.ko];
  return {
    id: uid('wpn'),
    text: `${g.ko} ${w.ko}`,
    type: 'weapon',
    tags,
    tier: g.tier,
    equipSlot: 'weapon',
    weaponType: w.ko,
    grade: g.ko,
  };
}

function makeArmor(day = 1) {
  const g = rollGrade(day);
  const s = ARMOR_SLOTS[Math.floor(Math.random() * ARMOR_SLOTS.length)];
  return {
    id: uid('eq'),
    text: `${g.ko} ${s.ko} 장비`,
    type: '방어구',
    tags: ['equipment', 'armor', s.slot, s.ko],
    tier: g.tier,
    equipSlot: s.slot,
    grade: g.ko,
  };
}

function rollRandomLootObject(day = 1) {
  // 장비/무기를 기본 풀로 섞어준다.
  if (Math.random() < 0.62) return Math.random() < 0.55 ? makeWeapon(day) : makeArmor(day);
  return keywordDB.objects[Math.floor(Math.random() * keywordDB.objects.length)];
}


// [수정] 인자에 ruleset 추가!
export function generateDynamicEvent(char, currentDay, ruleset) { 
    const context = keywordDB.contexts[Math.floor(Math.random() * keywordDB.contexts.length)];
    const object = rollRandomLootObject(currentDay);

    // 0) 이벤트 타입: 수집/사냥을 우선 처리
    const modeRoll = Math.random();

    // [S] 수집 이벤트(운석/생명의 나무/상자) — 수집 후 교전 확률이 증가(다음 페이즈)
    if (modeRoll < 0.24) {
        const pvpBonusNext = 0.22;
        if (modeRoll < 0.10) {
            return {
                log: `[${char.name}]은(는) 운석 파편을 발견해 회수했습니다! (수집 중 노출 ↑)`,
                newItem: cloneMat(MAT_ITEMS.meteor, currentDay),
                pvpBonusNext,
                damage: 0,
            };
        }
        if (modeRoll < 0.18) {
            return {
                log: `[${char.name}]은(는) 생명의 나무에서 수액을 채취했습니다! (수집 중 노출 ↑)`,
                newItem: cloneMat(MAT_ITEMS.worldTree, currentDay),
                pvpBonusNext,
                damage: 0,
            };
        }
        const loot = rollRandomLootObject(currentDay);
        return {
            log: `[${char.name}]은(는) 상자를 수색해 [${loot.text}]을(를) 획득했습니다! (수집 중 노출 ↑)`,
            newItem: { ...loot, acquiredDay: currentDay },
            pvpBonusNext,
            damage: 0,
        };
    }

    // [H] 사냥 이벤트(야생동물/변이체/보스)
    if (modeRoll < 0.52) {
        const p = (Number(char?.stats?.str || 0) + Number(char?.stats?.agi || 0) + Number(char?.stats?.sht || 0) + Number(char?.stats?.end || 0));
        const score = Math.random() * 40 + 20 + p * 0.7;

        const r = Math.random();
        let mob = '야생동물';
        let diff = 55;
        let drop = null;
        let credit = Number(ruleset?.credits?.wildlifeKill || 5);
        let winDmg = 6;
        let loseDmg = 16;

        // 보스/변이체
        if (r < 0.06) { mob = '위클라인'; diff = 92; drop = MAT_ITEMS.vfBlood; credit = Number(ruleset?.credits?.bossKill || 14); winDmg = 14; loseDmg = 28; }
        else if (r < 0.14) { mob = '오메가'; diff = 88; drop = MAT_ITEMS.forceCore; credit = Number(ruleset?.credits?.bossKill || 14); winDmg = 12; loseDmg = 26; }
        else if (r < 0.24) { mob = '알파'; diff = 82; drop = MAT_ITEMS.mithril; credit = Number(ruleset?.credits?.bossKill || 14); winDmg = 10; loseDmg = 24; }
        else if (r < 0.44) { mob = '변이체'; diff = 70; credit = Number(ruleset?.credits?.mutantKill || 9); winDmg = 8; loseDmg = 20; }

        if (score >= diff) {
            const extra = drop ? `, 전리품: [${drop.text}]` : '';
            return {
                log: `[${char.name}]은(는) ${mob}를 사냥했습니다! (+${credit} Cr${extra})`,
                earnedCredits: credit,
                newItem: drop ? cloneMat(drop, currentDay) : null,
                damage: winDmg,
            };
        }
        return {
            log: `[${char.name}]은(는) ${mob} 사냥에 실패해 부상을 입었습니다...`,
            damage: loseDmg,
        };
    }

    // 1. 아이템 발견 확률 (LUK 기반)
    const findChance = Math.random() * 100 + (char.stats.luk || 10);
    
    // [A] 아이템 발견
    if (findChance > 60) {
        return {
            log: `[${char.name}]은(는) 풀숲에서 [${object.text}]을(를) 발견하여 가방에 넣었습니다!`,
            newItem: { ...object, acquiredDay: currentDay },
            damage: 0
        };
    }

    // [B] 음식/무기 상호작용
    if (object.type === "food") {
        if (object.tags.includes("poison")) {
            if ((char.stats.int || 0) > 40) { // 안전하게 int 참조
                return { log: `[${char.name}]은(는) 지능을 발휘해 [${object.text}]에 독이 든 것을 간파하고 버렸습니다!`, damage: 0 };
            }
            return { 
                log: `[${char.name}]이(가) 독이 든 [${object.text}]을(를) 먹고 식중독에 걸렸습니다!`, 
                damage: 20, 
                newEffect: { name: "식중독", type: "debuff", remainingDuration: 2 } 
            };
        }
        return { log: `[${char.name}]은(는) 발견한 [${object.text}]을(를) 맛있게 먹었습니다.`, recovery: 20 };
    }

    // [C] 사냥 이벤트는 상단(modeRoll)에서 처리됩니다.

    if (object.type === "weapon") {
        const actionText = object.tags.includes("ranged") ? "조준해 봅니다" : "휘둘러 봅니다";
        const statName = object.tags.includes("ranged") ? "사격" : "숙련도";
        return { log: `[${char.name}]은(는) [${object.text}]를 들고 ${actionText}. ${statName}이 상승하는 기분입니다!`, damage: 0 };
    }

    return { log: `[${char.name}]은(는) ${context.text} 주변을 살피며 평화로운 시간을 보냈습니다.`, damage: 0 };
}