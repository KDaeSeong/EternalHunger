// client/src/utils/eventLogic.js

import { createEquipmentItem, normalizeWeaponType } from './equipmentCatalog';

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
  { ko: '돌격소총', ranged: true },
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
  return createEquipmentItem({ slot: 'weapon', day });
}

function makeArmor(day = 1) {
  // 무기 이외 슬롯(옷/머리/팔/신발)
  const slots = ['clothes', 'head', 'arm', 'shoes'];
  const slot = slots[Math.floor(Math.random() * slots.length)] || 'clothes';
  return createEquipmentItem({ slot, day });
}

function rollRandomLootObject(day = 1) {
  // 장비/무기를 기본 풀로 섞어준다.
  if (Math.random() < 0.62) return Math.random() < 0.55 ? makeWeapon(day) : makeArmor(day);
  return keywordDB.objects[Math.floor(Math.random() * keywordDB.objects.length)];
}


// [수정] 인자에 ruleset/phase 추가!
export function generateDynamicEvent(char, currentDay, ruleset, currentPhase = 'morning') { 
    const context = keywordDB.contexts[Math.floor(Math.random() * keywordDB.contexts.length)];
    const object = rollRandomLootObject(currentDay);

    // 0) 이벤트 타입: 수집/사냥을 우선 처리
    const modeRoll = Math.random();

    // [S] 수집 이벤트(상자) — 스폰 기반 특수 재료(운석/생명의 나무)는 월드 스폰에서만 획득
    if (modeRoll < 0.24) {
        const pvpBonusNext = 0.22;
        const loot = rollRandomLootObject(currentDay);
        return {
            log: `[${char.name}]은(는) 상자를 수색해 [${loot.text}]을(를) 획득했습니다! (수집 중 노출 ↑)`,
            newItem: { ...loot, acquiredDay: currentDay },
            pvpBonusNext,
            damage: 0,
        };
    }

    // [H] 사냥 이벤트(야생동물) — 보스/변이체는 월드 스폰(구역 조우)에서만 처리
    if (modeRoll < 0.52) {
        const p = (Number(char?.stats?.str || 0) + Number(char?.stats?.agi || 0) + Number(char?.stats?.sht || 0) + Number(char?.stats?.end || 0));
        const score = Math.random() * 40 + 20 + p * 0.7;

        // --- 스폰 규칙(요청): 늑대=낮, 곰=밤, 닭/멧돼지/박쥐/들개=매 페이즈 ---
        const isNight = String(currentPhase || '') === 'night';
        const mobs = [
            ...(isNight ? ['곰'] : ['늑대']),
            '멧돼지',
            '닭',
            '박쥐',
            '들개',
        ];
        const mob = mobs[Math.floor(Math.random() * mobs.length)] || (isNight ? '곰' : '늑대');

        const diff = 55;
        const credit = Number(ruleset?.credits?.wildlifeKill || 5);
        const winDmg = 6;
        const loseDmg = 16;

        if (score >= diff) {
            return {
                log: `[${char.name}]은(는) ${mob}를 사냥했습니다! (+${credit} Cr)`,
                earnedCredits: credit,
                newItem: null,
                damage: winDmg,
            };
        }
        return {
            log: `[${char.name}]은(는) ${mob} 사냥에 실패해 부상을 입었습니다...`,
            damage: loseDmg,
        };
    }


