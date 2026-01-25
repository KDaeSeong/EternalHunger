// client/src/utils/itemLogic.js

/**
 * 🎒 아이템 사용 효과 처리
 * @param {Object} character - 아이템을 사용하는 캐릭터
 * @param {Object} item - 사용할 아이템 객체
 */
export function applyItemEffect(character, item) {
    let log = "";
    let recovery = 0;
    let statBoost = null;

    // 아이템 타입 및 태그에 따른 효과 분기 (기획서 기반)
    if (item.type === 'food') {
        recovery = item.tags.includes('healthy') ? 30 : 15;
        log = `🍱 [${character.name}]은(는) 가방에서 [${item.text}]을(를) 꺼내 먹었습니다. (체력 +${recovery})`;
    } 
    else if (item.tags.includes('heal')) {
        recovery = 50;
        log = `🚑 [${character.name}]은(는) [${item.text}]을(를) 사용하여 응급처치를 마쳤습니다. (체력 +50)`;
    } 
    else if (item.tags.includes('book')) {
        statBoost = { int: 5 }; // 지능 영구 상승
        log = `📖 [${character.name}]은(는) [${item.text}]을(를) 읽으며 지식을 습득했습니다. (지능 +5)`;
    }

    return { log, recovery, statBoost };
}