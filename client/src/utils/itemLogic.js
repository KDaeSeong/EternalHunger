// client/src/utils/itemLogic.js

import { EFFECT_BLEED, EFFECT_BURN, EFFECT_FOOD_POISON, EFFECT_POISON, makeRegenEffect, makeShieldEffect, makeStatBuffEffect } from './statusLogic';

function safeTags(item) {
  return Array.isArray(item?.tags) ? item.tags.map((x) => String(x || '').toLowerCase()) : [];
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
  let cleanse = null;
  let newEffects = [];

  const isFood = type === 'food' || tags.includes('food') || tags.includes('healthy') || isFoodName;
  const isHeal = tags.includes('heal') || tags.includes('medical') || isHealName;
  const isDrink = type === 'drink' || tags.includes('drink') || tags.includes('beverage') || isDrinkName;
  const isBook = tags.includes('book');
  const isHealthy = tags.includes('healthy');
  const isEnergy = tags.includes('energy') || lowerName.includes('에너지') || lowerName.includes('드링크') || lowerName.includes('energy');
  const isBandage = lowerName.includes('bandage') || name.includes('붕대');

  if (isHeal) {
    recovery = isBandage ? 35 : 50;
    cleanse = {
      names: [EFFECT_BLEED, EFFECT_POISON, EFFECT_BURN, EFFECT_FOOD_POISON],
      removeAllNegative: false,
      bonusHeal: isBandage ? 4 : 6,
    };
    newEffects = [
      makeRegenEffect(isBandage ? 5 : 8, isBandage ? 2 : 3, `${sourceId}_heal`),
      makeShieldEffect(isBandage ? 4 : 8, 1, `${sourceId}_guard`),
    ].filter(Boolean);
    log = `🚑 [${character.name}]은(는) [${name}]을(를) 사용하여 응급처치를 마쳤습니다. (체력 +${recovery})`;
  } else if (isDrink) {
    recovery = isEnergy ? 12 : 8;
    newEffects = [
      makeRegenEffect(isEnergy ? 4 : 2, 2, `${sourceId}_drink_regen`),
      makeStatBuffEffect('각성', isEnergy ? { agi: 4, luk: 2 } : { agi: 2, men: 1 }, isEnergy ? 3 : 2, `${sourceId}_drink_stim`, { tags: ['positive', 'stim'] }),
    ].filter(Boolean);
    log = `🥤 [${character.name}]은(는) [${name}]을(를) 마시며 컨디션을 끌어올렸습니다. (체력 +${recovery})`;
  } else if (isFood) {
    recovery = isHealthy ? 30 : 15;
    newEffects = [
      makeRegenEffect(isHealthy ? 7 : 4, isHealthy ? 3 : 2, `${sourceId}_food`),
      isHealthy ? makeStatBuffEffect('집중', { end: 2, men: 2 }, 2, `${sourceId}_focus`, { tags: ['positive', 'food', 'focus'] }) : null,
    ].filter(Boolean);
    log = `🍱 [${character.name}]은(는) 가방에서 [${name}]을(를) 꺼내 먹었습니다. (체력 +${recovery})`;
  } else if (isBook) {
    statBoost = { int: 5 };
    newEffects = [
      makeStatBuffEffect('집중', { int: 5, men: 2 }, 3, `${sourceId}_book`, { tags: ['positive', 'focus', 'knowledge'] }),
    ].filter(Boolean);
    log = `📖 [${character.name}]은(는) [${name}]을(를) 읽으며 지식을 습득했습니다. (지능 +5)`;
  } else {
    log = `📦 [${character.name}]은(는) [${name}]을(를) 확인했지만, 사용할 수 있는 효과가 없습니다.`;
  }

  return { log, recovery, statBoost, cleanse, newEffects };
}
