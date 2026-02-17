// server/utils/defaultItemTree.js
// ✅ 기본 아이템/레시피 트리(시뮬레이션 프로토타입용)
// - DB에 아무 아이템도 없을 때도 "하급 → 희귀 → 전설/영웅" 조합 루프가 돌도록 최소 세트를 제공합니다.
// - mode:
//   - 'missing' (기본): 없는 아이템만 생성 + 레시피가 비어있는 것만 채움(기존 커스텀 데이터 보호)
//   - 'force' : 동일 이름 아이템도 기본값으로 덮어씀(주의)

const Item = require('../models/Item');

const DEFAULT_ITEM_TREE = [
  // --- 하급 재료 (Tier 1) ---
  {
    key: 'stone',
    name: '돌',
    type: '재료',
    tier: 1,
    rarity: 'common',
    stackMax: 99,
    baseCreditValue: 20,
    tags: ['basic', 'stone'],
    description: '하급 재료. 다양한 조합의 기초가 된다.',
  },
  {
    key: 'iron_scrap',
    name: '철 조각',
    type: '재료',
    tier: 1,
    rarity: 'common',
    stackMax: 99,
    baseCreditValue: 25,
    tags: ['basic', 'iron'],
    description: '하급 재료. 정제 철의 재료.',
  },
  {
    key: 'fabric_scrap',
    name: '천 조각',
    type: '재료',
    tier: 1,
    rarity: 'common',
    stackMax: 99,
    baseCreditValue: 25,
    tags: ['basic', 'fabric'],
    description: '하급 재료. 튼튼한 천의 재료.',
  },
  {
    key: 'leather',
    name: '가죽',
    type: '재료',
    tier: 1,
    rarity: 'common',
    stackMax: 99,
    baseCreditValue: 30,
    tags: ['basic', 'leather'],
    description: '하급 재료. 강화 가죽의 재료.',
  },
  {
    key: 'wood_branch',
    name: '나뭇가지',
    type: '재료',
    tier: 1,
    rarity: 'common',
    stackMax: 99,
    baseCreditValue: 20,
    tags: ['basic', 'wood'],
    description: '하급 재료. 손질된 목재의 재료.',
  },
  {
    key: 'small_parts',
    name: '작은 부품',
    type: '재료',
    tier: 1,
    rarity: 'common',
    stackMax: 99,
    baseCreditValue: 30,
    tags: ['basic', 'parts'],
    description: '하급 재료. 정밀 부품의 재료.',
  },

  // --- 소모품 샘플(최소) ---
  {
    key: 'fresh_apple',
    name: '신선한 사과',
    type: 'food',
    tier: 1,
    rarity: 'common',
    stackMax: 6,
    baseCreditValue: 35,
    tags: ['food', 'healthy'],
    description: '기본 회복 음식. (체력 회복)\n※ 시뮬레이션에서는 자동으로 사용될 수 있습니다.',
  },
  {
    key: 'bandage',
    name: '붕대',
    type: '소모품',
    tier: 1,
    rarity: 'common',
    stackMax: 6,
    baseCreditValue: 60,
    tags: ['heal', 'medical', 'bandage'],
    description: '기본 회복 소모품. (체력 회복)\n※ 출혈 상태를 완화하는 데 사용된다.',
  },

  // --- 희귀 재료 (Tier 2) ---
  {
    key: 'refined_iron',
    name: '정제 철',
    type: '재료',
    tier: 2,
    rarity: 'rare',
    stackMax: 99,
    baseCreditValue: 80,
    tags: ['rare', 'iron'],
    description: '희귀 재료. 무기 조합에 자주 쓰인다.',
    recipeKeys: [{ key: 'iron_scrap', qty: 2 }],
  },
  {
    key: 'sturdy_fabric',
    name: '튼튼한 천',
    type: '재료',
    tier: 2,
    rarity: 'rare',
    stackMax: 99,
    baseCreditValue: 80,
    tags: ['rare', 'fabric'],
    description: '희귀 재료. 방어구/장비 조합에 자주 쓰인다.',
    recipeKeys: [{ key: 'fabric_scrap', qty: 2 }],
  },
  {
    key: 'reinforced_leather',
    name: '강화 가죽',
    type: '재료',
    tier: 2,
    rarity: 'rare',
    stackMax: 99,
    baseCreditValue: 90,
    tags: ['rare', 'leather'],
    description: '희귀 재료. 방어구 조합의 핵심.',
    recipeKeys: [{ key: 'leather', qty: 2 }],
  },
  {
    key: 'treated_wood',
    name: '손질된 목재',
    type: '재료',
    tier: 2,
    rarity: 'rare',
    stackMax: 99,
    baseCreditValue: 70,
    tags: ['rare', 'wood'],
    description: '희귀 재료. 무기/도구 조합에 자주 쓰인다.',
    recipeKeys: [{ key: 'wood_branch', qty: 2 }],
  },
  {
    key: 'precision_parts',
    name: '정밀 부품',
    type: '재료',
    tier: 2,
    rarity: 'rare',
    stackMax: 99,
    baseCreditValue: 90,
    tags: ['rare', 'parts'],
    description: '희귀 재료. 장비/기계 조합에 자주 쓰인다.',
    recipeKeys: [{ key: 'small_parts', qty: 2 }],
  },

  // --- 희귀 장비 (Tier 3) ---
  {
    key: 'rare_sword',
    name: '희귀 검',
    type: '무기',
    tier: 3,
    rarity: 'epic',
    stackMax: 1,
    baseCreditValue: 240,
    tags: ['weapon', 'rare_equipment'],
    stats: { atk: 12, def: 0, hp: 0 },
    description: '희귀 장비. 전설/영웅 조합의 베이스로 사용.',
    recipeKeys: [
      { key: 'refined_iron', qty: 1 },
      { key: 'treated_wood', qty: 1 },
    ],
  },
  {
    key: 'rare_armor',
    name: '희귀 방어구',
    type: '방어구',
    tier: 3,
    rarity: 'epic',
    stackMax: 1,
    baseCreditValue: 260,
    tags: ['armor', 'rare_equipment'],
    stats: { atk: 0, def: 10, hp: 15 },
    description: '희귀 장비. 생존력을 크게 올려준다.',
    recipeKeys: [
      { key: 'reinforced_leather', qty: 1 },
      { key: 'sturdy_fabric', qty: 1 },
    ],
  },

  // --- 전설 재료 4종 (Tier 4) ---
  { key: 'meteor', name: '운석', type: '재료', tier: 4, rarity: 'legendary', stackMax: 9, baseCreditValue: 800, tags: ['legendary_core','meteor'], description: '전설 재료. 2일차 낮 이후부터 등장/거래 가능.' },
  { key: 'life_tree', name: '생명의 나무', type: '재료', tier: 4, rarity: 'legendary', stackMax: 9, baseCreditValue: 800, tags: ['legendary_core','life_tree'], description: '전설 재료. 2일차 낮 이후부터 등장/거래 가능.' },
  { key: 'mithril', name: '미스릴', type: '재료', tier: 4, rarity: 'legendary', stackMax: 9, baseCreditValue: 900, tags: ['legendary_core','mithril'], description: '전설 재료. 3일차 낮 이후부터 등장/거래 가능.' },

  // 포스 코어는 (운석 + 생명의 나무) 조합으로도 획득 가능
  {
    key: 'force_core',
    name: '포스 코어',
    type: '재료',
    tier: 4,
    rarity: 'legendary',
    stackMax: 9,
    baseCreditValue: 1200,
    tags: ['legendary_core','force_core'],
    description: '전설 재료. (운석 + 생명의 나무)로 조합 가능 / 4일차 낮 이후에도 획득 경로가 열린다.',
    recipeKeys: [
      { key: 'meteor', qty: 1 },
      { key: 'life_tree', qty: 1 },
    ],
  },

  // --- VF 혈액 샘플 (Tier 4) ---
  {
    key: 'vf_sample',
    name: 'VF 혈액 샘플',
    type: '재료',
    tier: 4,
    rarity: 'hero',
    stackMax: 9,
    baseCreditValue: 500,
    tags: ['vf', 'hero_material'],
    description: '영웅 등급 조합 재료. 4일차 낮 이후 키오스크에서 구매 가능.',
  },

  // --- 전설 장비 (Tier 5): "전설 재료 + 희귀 장비" ---
  {
    key: 'legend_sword_meteor',
    name: '전설 무기(운석)',
    type: '무기',
    tier: 5,
    rarity: 'legendary',
    stackMax: 1,
    baseCreditValue: 1800,
    tags: ['weapon', 'legendary', 'from_meteor'],
    stats: { atk: 22, def: 0, hp: 0 },
    description: '전설 장비(운석).',
    recipeKeys: [
      { key: 'meteor', qty: 1 },
      { key: 'rare_sword', qty: 1 },
    ],
  },
  {
    key: 'legend_sword_tree',
    name: '전설 무기(생나)',
    type: '무기',
    tier: 5,
    rarity: 'legendary',
    stackMax: 1,
    baseCreditValue: 1800,
    tags: ['weapon', 'legendary', 'from_life_tree'],
    stats: { atk: 20, def: 0, hp: 10 },
    description: '전설 장비(생명의 나무).',
    recipeKeys: [
      { key: 'life_tree', qty: 1 },
      { key: 'rare_sword', qty: 1 },
    ],
  },
  {
    key: 'legend_sword_mithril',
    name: '전설 무기(미스릴)',
    type: '무기',
    tier: 5,
    rarity: 'legendary',
    stackMax: 1,
    baseCreditValue: 1900,
    tags: ['weapon', 'legendary', 'from_mithril'],
    stats: { atk: 21, def: 2, hp: 0 },
    description: '전설 장비(미스릴).',
    recipeKeys: [
      { key: 'mithril', qty: 1 },
      { key: 'rare_sword', qty: 1 },
    ],
  },
  {
    key: 'legend_sword_force',
    name: '전설 무기(포스코어)',
    type: '무기',
    tier: 5,
    rarity: 'legendary',
    stackMax: 1,
    baseCreditValue: 2200,
    tags: ['weapon', 'legendary', 'from_force_core'],
    stats: { atk: 24, def: 0, hp: 0 },
    description: '전설 장비(포스 코어).',
    recipeKeys: [
      { key: 'force_core', qty: 1 },
      { key: 'rare_sword', qty: 1 },
    ],
  },

  // --- 영웅 장비 (Tier 6): "VF 샘플 + 하위 아이템" ---
  {
    key: 'hero_sword_vf',
    name: '영웅 무기(VF)',
    type: '무기',
    tier: 6,
    rarity: 'hero',
    stackMax: 1,
    baseCreditValue: 2000,
    tags: ['weapon', 'hero', 'vf'],
    stats: { atk: 23, def: 0, hp: 5 },
    description: '영웅 장비(VF 혈액 샘플 기반).',
    recipeKeys: [
      { key: 'vf_sample', qty: 1 },
      { key: 'rare_sword', qty: 1 },
    ],
  },

  // --- 초월 장비 샘플 (Tier 4): "하급 재료 + VF 혈액 샘플" ---
  {
    key: 'transcend_sword_vf',
    name: '초월 무기(VF)',
    type: '무기',
    tier: 4,
    rarity: 'transcendent',
    stackMax: 1,
    baseCreditValue: 3200,
    tags: ['weapon', 'transcendent', 'vf'],
    stats: { atk: 28, def: 0, hp: 0 },
    description: '초월 장비. (하급 재료 + VF 혈액 샘플) 조합 샘플.',
    recipeKeys: [
      { key: 'vf_sample', qty: 1 },
      { key: 'iron_scrap', qty: 2 },
    ],
  },
  {
    key: 'transcend_armor_vf',
    name: '초월 방어구(VF)',
    type: '방어구',
    tier: 4,
    rarity: 'transcendent',
    stackMax: 1,
    baseCreditValue: 3000,
    tags: ['armor', 'transcendent', 'vf'],
    stats: { atk: 0, def: 18, hp: 25 },
    description: '초월 장비. (하급 재료 + VF 혈액 샘플) 조합 샘플.',
    recipeKeys: [
      { key: 'vf_sample', qty: 1 },
      { key: 'leather', qty: 2 },
    ],
  },
];

function pickStats(defObj) {
  const s = defObj?.stats;
  if (!s) return undefined;
  return {
    atk: Number(s.atk || 0),
    def: Number(s.def || 0),
    hp: Number(s.hp || 0),
  };
}

/**
 * upsertDefaultItemTree
 * @param {Object} opts
 * @param {'missing'|'force'} opts.mode
 * @returns {Object} summary
 */
async function upsertDefaultItemTree(opts = {}) {
  const mode = (opts?.mode === 'force') ? 'force' : 'missing';

  // 1) 이미 존재하는 아이템 조회(name 기준)
  const names = DEFAULT_ITEM_TREE.map((x) => x.name);
  const existing = await Item.find({ name: { $in: names } });
  const byName = new Map(existing.map((it) => [String(it.name), it]));

  const created = [];
  const updated = [];
  const skipped = [];

  // 2) 아이템 기본 필드 upsert(레시피는 2차에서 처리)
  for (const def of DEFAULT_ITEM_TREE) {
    const exist = byName.get(def.name);

    const baseDoc = {
      name: def.name,
      type: def.type,
      tags: Array.isArray(def.tags) ? def.tags : [],
      rarity: def.rarity,
      tier: Number(def.tier || 1),
      stackMax: Number(def.stackMax || 1),
      value: Number(def.baseCreditValue || 0),        // UI 호환
      baseCreditValue: Number(def.baseCreditValue || 0),
      stats: pickStats(def) || { atk: 0, def: 0, hp: 0 },
      description: String(def.description || ''),
    };

    if (!exist) {
      const doc = await Item.create(baseDoc);
      byName.set(def.name, doc);
      created.push({ name: def.name, id: String(doc._id) });
      continue;
    }

    if (mode === 'force') {
      // 덮어쓰기
      const doc = await Item.findByIdAndUpdate(exist._id, baseDoc, { new: true });
      byName.set(def.name, doc);
      updated.push({ name: def.name, id: String(doc._id) });
      continue;
    }

    // missing 모드: 기존 아이템은 건드리지 않음
    skipped.push({ name: def.name, id: String(exist._id) });
  }

  // 3) 레시피 upsert(ingredient objectId로 변환)
  const recipeUpdated = [];
  for (const def of DEFAULT_ITEM_TREE) {
    if (!Array.isArray(def.recipeKeys) || def.recipeKeys.length === 0) continue;

    const target = byName.get(def.name);
    if (!target) continue;

    // missing 모드에서는 "레시피가 비어있을 때만" 채움
    if (mode !== 'force') {
      const ing0 = target?.recipe?.ingredients;
      if (Array.isArray(ing0) && ing0.length > 0) continue;
    }

    const ings = [];
    for (const rk of def.recipeKeys) {
      const ingDef = DEFAULT_ITEM_TREE.find((x) => x.key === rk.key);
      if (!ingDef) continue;
      const ingItem = byName.get(ingDef.name);
      if (!ingItem) continue;
      ings.push({ itemId: ingItem._id, qty: Math.max(1, Number(rk.qty || 1)) });
    }
    if (!ings.length) continue;

    target.recipe = {
      ingredients: ings,
      creditsCost: 0,
      resultQty: 1,
    };
    await target.save();
    recipeUpdated.push({ name: def.name, id: String(target._id) });
  }

  return {
    mode,
    createdCount: created.length,
    updatedCount: updated.length,
    skippedCount: skipped.length,
    recipeUpdatedCount: recipeUpdated.length,
    created,
    updated,
    skipped,
    recipeUpdated,
  };
}

module.exports = {
  DEFAULT_ITEM_TREE,
  upsertDefaultItemTree,
};
