// client/src/utils/itemLogic.js

import {
  EFFECT_AIRBORNE,
  EFFECT_BURN,
  EFFECT_COOLDOWN_UP,
  EFFECT_FOOD_POISON,
  EFFECT_HEAL_REDUCTION,
  EFFECT_KNOCKBACK,
  EFFECT_POISON,
  EFFECT_SLOW,
  EFFECT_STUN,
  makeRegenEffect,
  makeShieldEffect,
  makeStatBuffEffect,
} from './statusLogic';
import { getErCapsule } from './erMeta';

function safeTags(item) {
  return Array.isArray(item?.tags) ? item.tags.map((x) => String(x || '').toLowerCase()) : [];
}

function readNumber(...values) {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n) && n !== 0) return n;
  }
  return 0;
}

function readExplicitRecovery(item) {
  const effect = item?.effect || item?.effects || item?.consumeEffect || {};
  const stats = item?.stats && typeof item.stats === 'object' ? item.stats : {};
  return Math.max(0, readNumber(
    item?.heal,
    item?.healing,
    item?.recovery,
    item?.recover,
    item?.hpRecover,
    item?.hpRecovery,
    item?.restoreHp,
    effect?.heal,
    effect?.healing,
    effect?.recovery,
    effect?.hpRecover,
    stats?.heal,
    stats?.recovery,
    stats?.hpRecover,
    stats?.hpRecovery
  ));
}

function adaptiveAttackStat(character) {
  const stats = character?.stats && typeof character.stats === 'object' ? character.stats : {};
  const hint = [
    character?.archetype,
    character?.role,
    character?.weaponType,
    character?.strategy,
  ].map((v) => String(v || '').toLowerCase()).join(' ');
  if (
    hint.includes('skill') ||
    hint.includes('amp') ||
    hint.includes('mage') ||
    hint.includes('caster') ||
    hint.includes('스킬') ||
    hint.includes('스증') ||
    hint.includes('아르카나') ||
    hint.includes('기타') ||
    hint.includes('카메라')
  ) {
    return 'skillAmp';
  }
  return Number(stats?.skillAmp || 0) > Number(stats?.attackPower || 0) ? 'skillAmp' : 'attackPower';
}

function adaptiveForceStats(character, value) {
  const n = Math.max(0, Number(value || 0));
  if (!Number.isFinite(n) || n <= 0) return {};
  const key = adaptiveAttackStat(character);
  return key === 'skillAmp' ? { skillAmp: n * 2 } : { attackPower: n };
}

function permanentConsumableBoost(character, item) {
  const name = String(item?.name || item?.text || item?.itemId?.name || '').trim();
  const lower = name.toLowerCase();
  const desc = String(item?.description || item?.desc || '').toLowerCase();
  const tags = safeTags(item);
  const stats = item?.stats && typeof item.stats === 'object' ? item.stats : {};
  const subtype = String(item?.itemSubType || item?.subType || '').toLowerCase();
  const permanentHint = tags.includes('permanent') || tags.includes('enhance') || tags.includes('강화') || subtype.includes('강화') || desc.includes('영구');

  if (name.includes('대환단') || lower.includes('daihuandan')) {
    return { key: 'max_hp', label: '최대 체력', maxHp: Math.max(1, readNumber(stats.hp, item?.maxHp, 90) || 90) };
  }
  if (name.includes('성수') || lower.includes('holy water')) {
    return { key: 'defense', label: '방어력', stats: { defense: Math.max(1, readNumber(stats.def, item?.def, 9) || 9) } };
  }
  if (name.includes('셀레네') || lower.includes('selene')) {
    const adaptiveForce = Math.max(1, readNumber(stats.adaptiveForce, stats.atk, stats.skillAmp, item?.adaptiveForce, item?.adaptiveStat, 6) || 6);
    return { key: 'adaptive_power', label: '맞춤형 능력치', stats: adaptiveForceStats(character, adaptiveForce) };
  }
  if (name.includes('컴뱃 에피네프린') || lower.includes('combat epinephrine') || lower.includes('epinephrine')) {
    return { key: 'move_speed', label: '이동 속도', moveSpeed: Math.max(0.01, readNumber(stats.moveSpeed, item?.moveSpeed, 0.1) || 0.1) };
  }

  if (!permanentHint) return null;

  const boost = { key: String(item?._id || item?.itemId || name || 'permanent'), label: '영구 보너스', stats: {} };
  const hp = readNumber(stats.hp, item?.maxHp);
  const def = readNumber(stats.def, item?.def);
  const atk = readNumber(stats.atk, item?.atk);
  const skillAmp = readNumber(stats.skillAmp, item?.skillAmp);
  const adaptiveForce = readNumber(stats.adaptiveForce, item?.adaptiveForce, item?.adaptiveStat);
  const armorPen = readNumber(stats.armorPen, item?.armorPen);
  const moveSpeed = readNumber(stats.moveSpeed, item?.moveSpeed);

  if (hp > 0) boost.maxHp = hp;
  if (def > 0) boost.stats.defense = def;
  if (adaptiveForce > 0) {
    Object.entries(adaptiveForceStats(character, adaptiveForce)).forEach(([key, value]) => {
      boost.stats[key] = Math.max(Number(boost.stats[key] || 0), Number(value || 0));
    });
  } else if (atk > 0) {
    boost.stats[adaptiveAttackStat(character)] = atk;
  }
  if (skillAmp > 0) boost.stats.skillAmp = Math.max(Number(boost.stats.skillAmp || 0), skillAmp);
  if (armorPen > 0) boost.stats.armorPen = armorPen;
  if (moveSpeed > 0) boost.moveSpeed = moveSpeed;

  if (!boost.maxHp && !boost.moveSpeed && Object.keys(boost.stats).length === 0) return null;
  return boost;
}

/**
 * 🎒 아이템 사용 효과 처리
 * - 레거시( text/type='food' ) + 서버형( name/itemId/qty/tags/type='소모품' 등 ) 혼용 대응
 * - 즉시 회복 + 공용 상태효과 payload(newEffects) + 정화 정보까지 같이 반환
 */
export function applyItemEffect(character, item) {
  const name = item?.name || item?.text || item?.itemId?.name || '알 수 없는 아이템';
  const tags = safeTags(item);
  const type = String(item?.type || '').toLowerCase();
  const itemId = String(item?._id || item?.itemId || item?.id || '').trim();
  const sourceId = itemId ? `item_${itemId}` : `item_${String(name || '').replace(/\s+/g, '_')}`;

  const lowerName = String(name || '').toLowerCase();
  const isFoodName = lowerName.includes('food') || name.includes('음식') || name.includes('빵') || name.includes('스테이크') || name.includes('치킨');
  const isHealName = lowerName.includes('bandage') || lowerName.includes('medkit') || name.includes('붕대') || name.includes('응급');
  const isDrinkName = lowerName.includes('drink') || lowerName.includes('water') || lowerName.includes('coffee') || lowerName.includes('juice') || name.includes('음료') || name.includes('물') || name.includes('커피');

  let log = '';
  let recovery = 0;
  let statBoost = null;
  let permanentBoost = null;
  let cleanse = null;
  let newEffects = [];

  const isFood = type === 'food' || tags.includes('food') || tags.includes('healthy') || isFoodName;
  const isHeal = tags.includes('heal') || tags.includes('medical') || isHealName;
  const isDrink = type === 'drink' || tags.includes('drink') || tags.includes('beverage') || isDrinkName;
  const isBook = tags.includes('book');
  const isHealthy = tags.includes('healthy');
  const isEnergy = tags.includes('energy') || lowerName.includes('에너지') || lowerName.includes('드링크') || lowerName.includes('energy');
  const isBandage = lowerName.includes('bandage') || name.includes('붕대');
  const erCapsule = getErCapsule(item);
  const permanent = permanentConsumableBoost(character, item);

  if (permanent) {
    permanentBoost = permanent;
    const parts = [];
    if (permanent.maxHp) parts.push(`최대 체력 +${Math.round(Number(permanent.maxHp || 0))}`);
    if (permanent.moveSpeed) parts.push(`이동 속도 +${Number(permanent.moveSpeed || 0)}`);
    Object.entries(permanent.stats || {}).forEach(([key, value]) => {
      if (Number(value || 0) !== 0) parts.push(`${key} +${Number(value || 0)}`);
    });
    log = `💊 [${character.name}]은(는) [${name}]을(를) 사용했습니다. 영구 보너스: ${parts.join(', ') || permanent.label}`;
  } else if (erCapsule) {
    recovery = Math.max(0, Number(erCapsule.heal || 0));
    newEffects = [
      erCapsule.shield ? makeShieldEffect(erCapsule.shield, erCapsule.duration || 3, `${sourceId}_capsule_shield`, { tags: ['positive', 'capsule'] }) : null,
      erCapsule.regen ? makeRegenEffect(erCapsule.regen, erCapsule.duration || 3, `${sourceId}_capsule_regen`, { tags: ['positive', 'capsule'] }) : null,
      erCapsule.stats ? makeStatBuffEffect('각성', erCapsule.stats, erCapsule.duration || 3, `${sourceId}_capsule_stats`, { tags: ['positive', 'capsule', `capsule:${erCapsule.code}`] }) : null,
    ].filter(Boolean);
    log = `💊 [${character.name}]은(는) [${name}]을(를) 사용했습니다. ${erCapsule.log || '캡슐 효과가 적용됩니다.'}${recovery > 0 ? ` (체력 +${recovery})` : ''}`;
  } else if (isHeal) {
    recovery = readExplicitRecovery(item) || (isBandage ? 35 : 50);
    cleanse = {
      names: [
        EFFECT_POISON,
        EFFECT_BURN,
        EFFECT_FOOD_POISON,
        EFFECT_AIRBORNE,
        EFFECT_HEAL_REDUCTION,
        EFFECT_STUN,
        EFFECT_KNOCKBACK,
        EFFECT_SLOW,
        EFFECT_COOLDOWN_UP,
      ],
      removeAllNegative: false,
      bonusHeal: isBandage ? 4 : 6,
    };
    newEffects = [
      makeRegenEffect(isBandage ? 5 : 8, isBandage ? 2 : 3, `${sourceId}_heal`),
      makeShieldEffect(isBandage ? 4 : 8, 1, `${sourceId}_guard`),
    ].filter(Boolean);
    log = `🚑 [${character.name}]은(는) [${name}]을(를) 사용하여 응급처치를 마쳤습니다. (체력 +${recovery})`;
  } else if (isDrink) {
    recovery = readExplicitRecovery(item) || (isEnergy ? 12 : 8);
    newEffects = [
      makeRegenEffect(isEnergy ? 4 : 2, 2, `${sourceId}_drink_regen`),
      makeStatBuffEffect('각성', isEnergy ? { attackSpeed: 0.05, sightRange: 0.3 } : { attackSpeed: 0.025, maxHp: 3 }, isEnergy ? 3 : 2, `${sourceId}_drink_stim`, { tags: ['positive', 'stim'] }),
    ].filter(Boolean);
    log = `🥤 [${character.name}]은(는) [${name}]을(를) 마시며 컨디션을 끌어올렸습니다. (체력 +${recovery})`;
  } else if (isFood) {
    const statHp = Math.max(0, readNumber(item?.stats?.hp));
    recovery = readExplicitRecovery(item) || statHp || (isHealthy ? 30 : 15);
    newEffects = [
      makeRegenEffect(isHealthy ? 7 : 4, isHealthy ? 3 : 2, `${sourceId}_food`),
      isHealthy ? makeStatBuffEffect('집중', { defense: 2, maxHp: 5 }, 2, `${sourceId}_focus`, { tags: ['positive', 'food', 'focus'] }) : null,
    ].filter(Boolean);
    log = `🍱 [${character.name}]은(는) 가방에서 [${name}]을(를) 꺼내 먹었습니다. (체력 +${recovery})`;
  } else if (isBook) {
    statBoost = { skillAmp: 8 };
    newEffects = [
      makeStatBuffEffect('집중', { skillAmp: 8, sightRange: 0.4 }, 3, `${sourceId}_book`, { tags: ['positive', 'focus', 'knowledge'] }),
    ].filter(Boolean);
    log = `📖 [${character.name}]은(는) [${name}]을(를) 읽으며 지식을 습득했습니다. (지능 +5)`;
  } else {
    log = `📦 [${character.name}]은(는) [${name}]을(를) 확인했지만, 사용할 수 있는 효과가 없습니다.`;
  }

  return { log, recovery, statBoost, permanentBoost, permanentKey: permanentBoost?.key || '', cleanse, newEffects };
}
