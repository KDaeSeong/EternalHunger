// client/src/utils/equipmentCatalog.js
// 장비(무기/방어구) 자동 생성 카탈로그
// - 변수/함수명은 영어, 주석은 한글

const randInt = (a, b) => {
  const x = Math.floor(Number(a));
  const y = Math.floor(Number(b));
  if (!Number.isFinite(x) || !Number.isFinite(y)) return 0;
  if (y <= x) return x;
  return x + Math.floor(Math.random() * (y - x + 1));
};

const randFloat = (a, b) => {
  const x = Number(a);
  const y = Number(b);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return 0;
  if (y <= x) return x;
  return x + Math.random() * (y - x);
};

const pick = (arr) => {
  const list = Array.isArray(arr) ? arr : [];
  if (!list.length) return null;
  return list[Math.floor(Math.random() * list.length)];
};

const uid = (prefix) => `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1e9)}`;

// 무기 타입(요청 목록)
export const WEAPON_TYPES_KO = [
  '권총', '돌격소총', '저격총',
  '장갑', '톤파', '쌍절곤', '아르카나',
  '검', '쌍검', '망치', '방망이', '채찍',
  '투척', '암기', '활', '석궁',
  '도끼', '단검', '창', '레이피어',
];

// 과거 레거시 표기 보정
const WEAPON_TYPE_ALIASES = {
  '돌소총': '돌격소총',
};

export function normalizeWeaponType(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  return WEAPON_TYPE_ALIASES[s] || s;
}

const GRADES = [
  { tier: 1, ko: '일반', mult: 1.00 },
  { tier: 2, ko: '고급', mult: 1.35 },
  { tier: 3, ko: '희귀', mult: 1.85 },
  { tier: 4, ko: '영웅', mult: 2.55 },
  { tier: 5, ko: '전설', mult: 3.45 },
  { tier: 6, ko: '초월', mult: 4.55 },
];

const getGrade = (tier) => {
  const t = Math.max(1, Math.min(6, Math.floor(Number(tier || 1))));
  return GRADES.find((g) => g.tier === t) || GRADES[0];
};

// 등급 가중치(기본) + 날짜 보정(조금)
function rollTier(day = 1) {
  const d = Math.max(1, Number(day || 1));
  const boost = Math.min(2.2, 1 + d * 0.03);
  const weights = [
    { tier: 1, w: 55 },
    { tier: 2, w: 25 },
    { tier: 3, w: 12 },
    { tier: 4, w: 6 * boost },
    { tier: 5, w: 1.6 * boost },
    { tier: 6, w: 0.4 * boost },
  ];
  const total = weights.reduce((s, x) => s + Math.max(0, x.w), 0);
  let r = Math.random() * total;
  for (const it of weights) {
    r -= Math.max(0, it.w);
    if (r <= 0) return it.tier;
  }
  return 1;
}

// --- 이름 풀(현실 장비/신화 전설) ---
const REAL_WEAPON_NAMES = {
  권총: ['Glock 17', 'Beretta M9', 'SIG P226', 'Desert Eagle'],
  돌격소총: ['AK-47', 'M4A1', 'HK416', 'FN SCAR-L'],
  저격총: ['Remington 700', 'M24 SWS', 'Barrett M82', 'AWM'],
  장갑: ['Combat Gloves', 'Leather Gloves', 'Knuckle Wraps'],
  톤파: ['Police Tonfa', 'Side-Handle Baton'],
  쌍절곤: ['Oak Nunchaku', 'Iron Nunchaku'],
  아르카나: ['Tarot Deck', 'Crystal Orb', 'Grimoire'],
  검: ['Longsword', 'Katana', 'Saber'],
  쌍검: ['Twin Blades', 'Dual Short Swords'],
  망치: ['War Hammer', 'Sledgehammer'],
  방망이: ['Aluminum Bat', 'Wooden Bat'],
  채찍: ['Leather Whip', 'Chain Whip'],
  투척: ['Throwing Axe', 'Boomerang'],
  암기: ['Throwing Knife', 'Shuriken'],
  활: ['Recurve Bow', 'Longbow'],
  석궁: ['Light Crossbow', 'Heavy Crossbow'],
  도끼: ['Hatchet', 'Battle Axe'],
  단검: ['Stiletto', 'Dagger'],
  창: ['Spear', 'Pike'],
  레이피어: ['Rapier', 'Estoc'],
};

const REAL_ARMOR_NAMES = {
  head: ['FAST Helmet', 'Kevlar Helmet', 'Motorcycle Helmet'],
  clothes: ['Kevlar Vest', 'Tactical Vest', 'Leather Jacket'],
  arm: ['Tactical Gloves', 'Bracer', 'Gauntlet'],
  shoes: ['Tactical Boots', 'Trail Runners', 'Combat Boots'],
};

const LEGENDARY_NAMES = {
  weapon: ['엑스칼리버','그람','듀란달','쿠사나기','궁니르','미스틸테인','마사무네','묠니르','아론다이트','칼라드볼그','클라우 솔라스','라에바테인','티르빙','발뭉','요이우스','줄피카르','프리드웬','라그나로크','아스칼론','흐룬팅'],
  head: ['하데스의 투구','미네르바의 투구','아테나의 헬름','라의 관','천마의 관','용왕의 투구'],
  clothes: ['드래곤 스케일 아머','황금 양털 망토','불사조의 로브','아킬레우스의 갑옷','니벨룽의 갑주','시구르드의 망토'],
  arm: ['헤라클레스의 건틀릿','거인의 완갑','토르의 팔찌','페가수스의 완갑','가이아의 완갑'],
  shoes: ['헤르메스의 샌들','바람신의 장화','이카로스의 날개신발','스틱스의 부츠','번개의 부츠'],
};

const TRANSCEND_NAMES = {
  weapon: ['태초의 검','성창 아스트라','천공의 도끼','별을 베는 쌍검','아카샤의 서','종말의 망치','시공의 창','오로보로스의 사슬','천상의 레이피어','심연의 단검','태양의 활','월광 석궁','파멸의 톤파','무한의 쌍절곤','공허의 채찍','폭풍의 방망이','신벌의 도끼','칠흑의 망치','천룡의 창','허무의 권총'],
  head: ['성좌의 왕관','천문 투구','천계의 후드','별빛 투구','절대자의 면갑'],
  clothes: ['은하의 갑주','태초의 흉갑','심연의 로브','천공의 망토','성운의 로브'],
  arm: ['차원의 완갑','별빛 건틀릿','시공의 건틀릿','심연의 완갑'],
  shoes: ['공허 보행자','시간의 부츠','차원 도약 부츠','별의 걸음','영원의 신발'],
};

const NAME_HISTORY = new Map();

function pickUnique(pool, histKey, maxHist = 8) {
  const list = Array.isArray(pool) ? pool.filter(Boolean) : [];
  if (!list.length) return null;

  const key = String(histKey || '');
  const hist = NAME_HISTORY.get(key) || [];
  const banned = new Set(hist);

  // 중복 방지(간단): 최근에 쓴 이름은 가급적 피합니다.
  const tries = Math.min(16, Math.max(6, list.length * 2));
  let chosen = null;

  for (let i = 0; i < tries; i += 1) {
    const cand = list[Math.floor(Math.random() * list.length)];
    if (!cand) continue;
    if (!banned.has(cand)) { chosen = cand; break; }
  }
  if (!chosen) chosen = list[Math.floor(Math.random() * list.length)];

  const cap = Math.max(3, Math.floor(Number(maxHist || 8)));
  const next = [...hist, chosen].slice(-cap);
  NAME_HISTORY.set(key, next);
  return chosen;
}

function pickName(slot, weaponType, tier) {
  const slotKey = slot === 'weapon' ? 'weapon' : String(slot || 'clothes');
  const wt = slotKey === 'weapon' ? normalizeWeaponType(weaponType) : '';

  if (tier >= 6) {
    const pool = TRANSCEND_NAMES[slotKey] || [];
    return pickUnique(pool, `transc:${slotKey}:${wt}`, 10) || '초월 장비';
  }
  if (tier >= 5) {
    const pool = LEGENDARY_NAMES[slotKey] || [];
    return pickUnique(pool, `legend:${slotKey}:${wt}`, 10) || '전설 장비';
  }

  if (slotKey === 'weapon') {
    const pool = REAL_WEAPON_NAMES[wt] || [];
    return pick(pool) || wt || '무기';
  }
  const pool = REAL_ARMOR_NAMES[slotKey] || [];
  return pick(pool) || '방어구';
}

// --- 스탯 생성 ---
function makeWeaponStats(tier, archetype) {
  const g = getGrade(tier);
  const scale = g.mult;
  const stats = {};

  const baseAtk = Math.max(1, Math.round(randInt(10, 18) * scale));

  if (archetype === 'amp_only') {
    stats.atk = 0;
    stats.skillAmp = Number(randFloat(0.12, 0.26) * (0.8 + scale * 0.22)).toFixed(3) * 1;
    return stats;
  }

  stats.atk = baseAtk;
  if (archetype === 'atk_speed') {
    stats.atkSpeed = Number(randFloat(0.05, 0.14) * (0.85 + scale * 0.18)).toFixed(3) * 1;
    return stats;
  }
  // atk_amp
  stats.skillAmp = Number(randFloat(0.06, 0.16) * (0.85 + scale * 0.18)).toFixed(3) * 1;
  return stats;
}

function pickAffixes(tier, exclude = []) {
  const t = Math.max(1, Math.min(6, Math.floor(Number(tier || 1))));
  const count = t <= 2 ? 1 : (t <= 4 ? 2 : 3);
  const pool = ['critChance', 'cdr', 'lifesteal'].filter((k) => !exclude.includes(k));

  const picked = [];
  while (pool.length && picked.length < count) {
    const i = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(i, 1)[0]);
  }
  return picked;
}

function makeArmorStats(tier, slot) {
  const g = getGrade(tier);
  const scale = g.mult;
  const stats = {};

  // 베이스(공격력/체력/스킬증폭)
  const basePick = pick(['atk', 'hp', 'skillAmp']) || 'hp';
  if (basePick === 'atk') stats.atk = Math.max(1, Math.round(randInt(2, 6) * scale));
  if (basePick === 'hp') stats.hp = Math.max(5, Math.round(randInt(18, 45) * scale));
  if (basePick === 'skillAmp') stats.skillAmp = Number(randFloat(0.03, 0.10) * (0.8 + scale * 0.20)).toFixed(3) * 1;

  const affs = pickAffixes(tier, []);
  for (const a of affs) {
    if (a === 'critChance') stats.critChance = Number(randFloat(0.02, 0.10) * (0.9 + scale * 0.12)).toFixed(3) * 1;
    if (a === 'cdr') stats.cdr = Number(randFloat(0.02, 0.12) * (0.9 + scale * 0.12)).toFixed(3) * 1;
    if (a === 'lifesteal') stats.lifesteal = Number(randFloat(0.01, 0.08) * (0.9 + scale * 0.12)).toFixed(3) * 1;
  }

  // 신발은 이동속도 추가
  if (String(slot) === 'shoes') {
    stats.moveSpeed = Number(randFloat(0.03, 0.12) * (0.9 + scale * 0.12)).toFixed(3) * 1;
  }

  return stats;
}

// 장비 아이템 생성(무기/옷/팔/머리/신발)
export function createEquipmentItem({ slot, day = 1, tier = null, weaponType = '' } = {}) {
  const equipSlot = String(slot || '').toLowerCase() || 'clothes';
  const fixedTier = tier != null ? Math.max(1, Math.min(6, Math.floor(Number(tier)))) : null;
  const rolledTier = fixedTier || rollTier(day);
  const g = getGrade(rolledTier);

  const id = uid(equipSlot === 'weapon' ? 'wpn' : 'eq');
  const wt = equipSlot === 'weapon' ? normalizeWeaponType(weaponType) : '';

  let archetype = '';
  let stats = {};

  if (equipSlot === 'weapon') {
    archetype = pick(['atk_speed', 'atk_amp', 'amp_only']) || 'atk_speed';
    stats = makeWeaponStats(rolledTier, archetype);
  } else {
    stats = makeArmorStats(rolledTier, equipSlot);
  }

  const baseName = pickName(equipSlot === 'weapon' ? 'weapon' : equipSlot, wt, rolledTier);
  const display = `${g.ko} ${baseName}`;

  const tags = ['equipment', equipSlot === 'weapon' ? 'weapon' : 'armor', equipSlot, g.ko];
  if (equipSlot === 'weapon') {
    tags.push(wt);
    // 원거리 태그(간단 판정)
    if (['권총', '돌격소총', '저격총', '아르카나', '활', '석궁', '투척', '암기'].includes(wt)) tags.push('ranged');
    if (['권총', '돌격소총', '저격총'].includes(wt)) tags.push('gun', '총', 'shoot');
  }

  return {
    // legacy/혼용 대응: id + itemId 같이 제공
    id,
    itemId: id,
    qty: 1,
    name: display,
    text: display,
    type: equipSlot === 'weapon' ? 'weapon' : '방어구',
    category: 'equipment',
    tags,
    tier: rolledTier,
    grade: g.ko,
    rarity: g.ko,
    equipSlot,
    weaponType: equipSlot === 'weapon' ? wt : undefined,
    archetype: equipSlot === 'weapon' ? archetype : undefined,
    stats,
    acquiredDay: Number(day || 1),
  };
}
