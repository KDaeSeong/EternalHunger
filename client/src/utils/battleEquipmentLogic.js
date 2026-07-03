import { isErRangedWeaponType, normalizeErWeaponType } from './erMeta';

// 내부 유틸 (legacy/normalized 아이템 혼용 대응)
const norm = (v) => String(v ?? '').trim().toLowerCase();
const hasTag = (item, tag) => Array.isArray(item?.tags) && item.tags.map((t) => String(t)).includes(tag);

// 아이템 tier 유틸(없으면 1)
export const getTier = (item) => Math.max(1, Number(item?.tier || 1));

const clampTier = (tier, maxTier) => {
  const t = Math.floor(Number(tier || 1));
  const m = Math.max(1, Math.floor(Number(maxTier || 1)));
  return Math.max(1, Math.min(m, t));
};

const normalizeRatioStat = (value, max = 0.75) => {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n <= 0) return 0;
  const ratio = n > 1 ? n / 100 : n;
  return Math.max(0, Math.min(max, ratio));
};

const isWeaponItem = (item) => {
  const t = norm(item?.type);
  // legacy(type='weapon') + normalized(한국어/동의어) 혼용
  if (['weapon', '무기', 'armory', '병기'].includes(t)) return true;
  // 태그 기반
  if (hasTag(item, 'weapon')) return true;
  return false;
};

export const pickWeapon = (character) => {
  const inv = Array.isArray(character?.inventory) ? character.inventory : [];
  const eqId = String(character?.equipped?.weapon || '');
  const equipped = eqId
    ? inv.find((i) => String(i?.itemId || i?.id || i?._id || '') === eqId)
    : null;
  const candidates = inv.filter((i) => String(i?.equipSlot || '') === 'weapon' || isWeaponItem(i));
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => getTier(b) - getTier(a));
  const best = candidates[0] || null;
  if (!equipped) return best;
  if (!best) return equipped;
  return getTier(best) > getTier(equipped) ? best : equipped;
};

const pickEquipBySlot = (character, slot) => {
  const inv = Array.isArray(character?.inventory) ? character.inventory : [];
  const s = String(slot || '');
  const eqId = String(character?.equipped?.[s] || '');
  const equipped = eqId
    ? inv.find((i) => String(i?.itemId || i?.id || i?._id || '') === eqId)
    : null;
  const candidates = inv.filter((i) => String(i?.equipSlot || '') === s);
  if (!candidates.length) return equipped || null;
  candidates.sort((a, b) => getTier(b) - getTier(a));
  const best = candidates[0] || null;
  if (!equipped) return best;
  if (!best) return equipped;
  return getTier(best) > getTier(equipped) ? best : equipped;
};

export const getEquipDeltas = (character, settings = {}) => {
  const eq = settings?.battle?.equipment || settings?.equipment || {};
  const weaponAtkPerTier = Number(eq.weaponAtkPerTier ?? 0);
  const armorDefPerTier = Number(eq.armorDefPerTier ?? 0);
  const maxTier = Number(eq.maxTier ?? 5);

  // 무기 1개(weapon 슬롯)
  const wpn = pickWeapon(character);
  const wTier = wpn ? clampTier(getTier(wpn), maxTier) : 0;
  const wType = normalizeErWeaponType(wpn?.weaponType || character?.weaponType || '');
  const ranged = !!wpn && (hasTag(wpn, 'ranged') || hasTag(wpn, 'shoot') || hasTag(wpn, 'gun') || hasTag(wpn, '총') || isErRangedWeaponType(wType));
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
    attackPowerAdd: weaponAtk,
    defenseAdd: armorDef,
    armorDef,
    weaponTier: wTier,
    armorTierSum,
    weaponIsRanged: ranged,
  };
};

// 장비 아이템(stats) 합산(새 카탈로그 대응)
// - equipmentCatalog.js에서 생성되는 stats(atk/hp/skillAmp/atkSpeed/critChance/cdr/lifesteal/moveSpeed/armorPen/adaptiveForce)를 전투 점수에 반영
export const getEquipStatTotals = (character) => {
  const totals = { atk: 0, def: 0, hp: 0, skillAmp: 0, atkSpeed: 0, critChance: 0, cdr: 0, lifesteal: 0, moveSpeed: 0, armorPen: 0, adaptiveForce: 0, weaponType: '', weaponIsRanged: false };
  const add = (src) => {
    const s = src && typeof src === 'object' ? src : {};
    totals.atk += Number(s.atk || 0);
    totals.def += Number(s.def || 0);
    totals.hp += Number(s.hp || 0);
    totals.skillAmp += Number(s.skillAmp || 0);
    totals.atkSpeed += Number(s.atkSpeed || 0);
    totals.critChance += Number(s.critChance || 0);
    totals.cdr += Number(s.cdr || 0);
    totals.lifesteal += Number(s.lifesteal || 0);
    totals.moveSpeed += Number(s.moveSpeed || 0);
    totals.armorPen += normalizeRatioStat(s.armorPen);
    totals.adaptiveForce += Number(s.adaptiveForce || 0);
  };

  // 무기 1개(weapon)
  const wpn = pickWeapon(character);
  if (wpn) {
    add(wpn.stats);
    totals.weaponType = normalizeErWeaponType(wpn.weaponType || character?.weaponType || '');
    totals.weaponIsRanged = hasTag(wpn, 'ranged') || hasTag(wpn, 'shoot') || hasTag(wpn, 'gun') || hasTag(wpn, '총') || isErRangedWeaponType(totals.weaponType);
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
  totals.armorPen = Math.max(0, Math.min(0.75, totals.armorPen));
  totals.skillAmp = Math.max(0, Math.min(2.5, totals.skillAmp));
  totals.adaptiveForce = Math.max(0, totals.adaptiveForce);
  totals.hp = Math.max(0, totals.hp);
  totals.atk = Math.max(0, totals.atk);
  totals.def = Math.max(0, totals.def);

  return totals;
};

export const formatEquipBrief = (character, eq) => {
  const name = String(character?.name || '???');
  const wTier = Number(eq?.weaponTier || 0);
  const aTier = Number(eq?.armorTierSum || 0);
  const attackPowerAdd = Number(eq?.attackPowerAdd || 0);
  const defenseAdd = Number(eq?.defenseAdd || 0);

  const parts = [];
  if (wTier > 0) {
    const atkPart = attackPowerAdd > 0 ? `+공격력${attackPowerAdd}` : '+공격력0';
    parts.push(`무기T${wTier}(${atkPart})`);
  }
  if (aTier > 0) parts.push(`방어T${aTier}(+방어력${defenseAdd})`);
  if (parts.length === 0) parts.push('장비 없음');
  return `[${name}] ${parts.join(' ')}`;
};

const prefersSkillAmpFromAdaptiveForce = (character, stats, equipStats) => {
  const wpn = pickWeapon(character);
  const archetype = String(wpn?.archetype || character?.archetype || '').toLowerCase();
  if (archetype.includes('amp')) return true;
  const weaponType = normalizeErWeaponType(equipStats?.weaponType || wpn?.weaponType || character?.weaponType || '');
  if (['아르카나', '기타', '카메라'].includes(weaponType)) return true;
  const attack = Number(stats?.attackPower || 0);
  const amp = Number(stats?.skillAmp || 0) + Number(equipStats?.skillAmp || 0) * 100;
  return amp >= attack;
};

export const resolveAdaptiveForceStats = (character, stats, equipStats) => {
  const adaptiveForce = Math.max(0, Number(equipStats?.adaptiveForce || 0));
  if (adaptiveForce <= 0) return { attackPower: 0, skillAmp: 0 };
  if (prefersSkillAmpFromAdaptiveForce(character, stats, equipStats)) {
    return { attackPower: 0, skillAmp: adaptiveForce * 2 };
  }
  return { attackPower: adaptiveForce, skillAmp: 0 };
};

const readRawCharacterStat = (character, key) => {
  const direct = Number(character?.stats?.[key] ?? character?.[key]);
  if (Number.isFinite(direct) && direct !== 0) return direct;
  const permanent = Number(character?.itemPermanentBonuses?.stats?.[key]);
  return Number.isFinite(permanent) ? permanent : 0;
};

export const getTotalArmorPen = (character, equipStats) => {
  return Math.max(0, Math.min(0.75,
    normalizeRatioStat(equipStats?.armorPen) +
    normalizeRatioStat(readRawCharacterStat(character, 'armorPen'))
  ));
};
