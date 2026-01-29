// client/src/utils/itemLogic.js

/**
 * 🎒 아이템 사용 효과 처리
 * - 레거시( text/type='food' ) + 서버형( name/itemId/qty/tags/type='소모품' 등 ) 혼용 대응
 * @param {Object} character - 아이템을 사용하는 캐릭터
 * @param {Object} item - 사용할 아이템 객체
 */
export function applyItemEffect(character, item) {
  const name = item?.name || item?.text || item?.itemId?.name || '알 수 없는 아이템';
  const tags = Array.isArray(item?.tags) ? item.tags : [];
  const type = String(item?.type || '').toLowerCase();

  let log = '';
  let recovery = 0;
  let statBoost = null;

  const isFood = type === 'food' || tags.includes('food') || tags.includes('healthy');
  const isHeal = tags.includes('heal') || tags.includes('medical');
  const isBook = tags.includes('book');

  if (isFood) {
    recovery = tags.includes('healthy') ? 30 : 15;
    log = `🍱 [${character.name}]은(는) 가방에서 [${name}]을(를) 꺼내 먹었습니다. (체력 +${recovery})`;
  } else if (isHeal) {
    recovery = 50;
    log = `🚑 [${character.name}]은(는) [${name}]을(를) 사용하여 응급처치를 마쳤습니다. (체력 +${recovery})`;
  } else if (isBook) {
    statBoost = { int: 5 };
    log = `📖 [${character.name}]은(는) [${name}]을(를) 읽으며 지식을 습득했습니다. (지능 +5)`;
  } else {
    log = `📦 [${character.name}]은(는) [${name}]을(를) 확인했지만, 사용할 수 있는 효과가 없습니다.`;
  }

  return { log, recovery, statBoost };
}
