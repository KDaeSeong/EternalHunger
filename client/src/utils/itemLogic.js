// client/src/utils/itemLogic.js

import {
  makeRegenEffect,
  makeShieldEffect,
  makeStatBuffEffect,
  makeStatusValueEffect,
} from './statusLogic';
import { getErCapsule } from './erMeta';

const SATIETY_EFFECT_NAME = '포만감';

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

function clampNumber(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
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
    hint.includes('증폭') ||
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
    return { key: 'adaptive_power', label: '맞춤 공격 능력치', stats: adaptiveForceStats(character, adaptiveForce) };
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

function getFoodProfile(item) {
  const name = String(item?.name || item?.text || item?.itemId?.name || '').trim();
  const lower = name.toLowerCase();
  const tags = safeTags(item);
  const type = String(item?.type || '').toLowerCase();
  const effect = item?.effect || item?.effects || item?.consumeEffect || {};
  const stats = item?.stats && typeof item.stats === 'object' ? item.stats : {};

  const isApple = lower.includes('apple') || name.includes('사과');
  const isSteak = lower.includes('steak') || name.includes('스테이크');
  const isFood =
    type === 'food' ||
    tags.includes('food') ||
    tags.includes('healthy') ||
    lower.includes('food') ||
    name.includes('음식') ||
    name.includes('빵') ||
    name.includes('치킨') ||
    name.includes('고기') ||
    isApple ||
    isSteak;

  if (!isFood) return null;

  const explicitRecovery = readExplicitRecovery(item);
  const statHp = Math.max(0, readNumber(stats.hp));
  const explicitSatiety = Math.max(0, readNumber(
    item?.satiety,
    item?.fullness,
    item?.foodValue,
    effect?.satiety,
    effect?.fullness,
    stats?.satiety,
    stats?.fullness
  ));

  const recovery = explicitRecovery || statHp || (isSteak ? 38 : isApple ? 16 : tags.includes('healthy') ? 28 : 18);
  const satiety = explicitSatiety || (isSteak ? 55 : isApple ? 24 : tags.includes('healthy') ? 38 : 30);

  return {
    recovery: Math.max(0, Math.round(recovery)),
    satiety: Math.round(clampNumber(satiety, 0, 100)),
    regen: isSteak ? 4 : isApple ? 2 : tags.includes('healthy') ? 3 : 2,
    durationSec: isSteak ? 45 : isApple ? 25 : 30,
  };
}

export function applyItemEffect(character, item) {
  const name = item?.name || item?.text || item?.itemId?.name || '알 수 없는 아이템';
  const tags = safeTags(item);
  const itemId = String(item?._id || item?.itemId || item?.id || '').trim();
  const sourceId = itemId ? `item_${itemId}` : `item_${String(name || '').replace(/\s+/g, '_')}`;

  let log = '';
  let recovery = 0;
  let satiety = 0;
  let statBoost = null;
  let permanentBoost = null;
  let newEffects = [];

  const isBook = tags.includes('book');
  const foodProfile = getFoodProfile(item);
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
  } else if (foodProfile) {
    recovery = foodProfile.recovery;
    satiety = foodProfile.satiety;
    newEffects = [
      foodProfile.regen > 0 ? makeRegenEffect(foodProfile.regen, foodProfile.durationSec, `${sourceId}_food`, { tags: ['positive', 'food'] }) : null,
      satiety > 0 ? makeStatusValueEffect(SATIETY_EFFECT_NAME, foodProfile.durationSec, `${sourceId}_satiety`, { tags: ['positive', 'food', 'satiety'], satiety }) : null,
    ].filter(Boolean);
    log = `🍱 [${character.name}]은(는) 가방에서 [${name}]을(를) 꺼내 먹었습니다. (체력 +${recovery}, 포만감 +${satiety})`;
  } else if (isBook) {
    statBoost = { skillAmp: 8 };
    newEffects = [
      makeStatBuffEffect('집중', { skillAmp: 8, sightRange: 0.4 }, 3, `${sourceId}_book`, { tags: ['positive', 'focus', 'knowledge'] }),
    ].filter(Boolean);
    log = `📖 [${character.name}]은(는) [${name}]을(를) 읽으며 전투 감각을 정리했습니다. (스킬증폭 +8)`;
  } else {
    log = `🔎 [${character.name}]은(는) [${name}]을(를) 확인했지만 사용할 수 있는 효과가 없습니다.`;
  }

  return { log, recovery, satiety, statBoost, permanentBoost, permanentKey: permanentBoost?.key || '', newEffects };
}
