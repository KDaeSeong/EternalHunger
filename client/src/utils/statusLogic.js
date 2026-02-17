// client/src/utils/statusLogic.js

/**
 * 🧮 상태 이상이 반영된 최종 스탯 계산
 * @param {Object} character - 캐릭터 객체 (activeEffects 포함)
 * @returns {Object} 보정된 8대 스탯
 */
export function getEffectiveStats(character) {
    // 기본 스탯 복사
    let effective = { ...character.stats };

    // 적용 중인 모든 효과를 순회하며 스탯 가감
    character.activeEffects?.forEach(effect => {
        if (effect.statModifiers) {
            Object.keys(effect.statModifiers).forEach(stat => {
                effective[stat] += effect.statModifiers[stat];
            });
        }
        
        // 특수 판정: 식중독 등의 스탯 반토막 로직 (기획서 2.2절)
        if (effect.name === "식중독") {
            effective.end = Math.floor(effective.end * 0.5);
        }
    });

    // 최소치(1) 보정
    Object.keys(effective).forEach(key => {
        if (effective[key] < 1) effective[key] = 1;
    });

    return effective;
}

/**
 * ⏳ 턴 종료 시 상태 이상 업데이트 (지속 시간 감소 및 종료 처리)
 */
export function updateEffects(character) {
    if (!character.activeEffects) return character;

    let hpChange = 0;
    const nextEffects = character.activeEffects.map(eff => {
        // DOT 데미지 처리 (식중독 등)
        if (eff.name === "식중독") hpChange -= 10;
        // DOT 데미지 처리 (출혈)
        if (eff.name === "출혈") hpChange -= Math.max(1, Number(eff?.dotDamage ?? eff?.dot ?? 6));
        
        return { ...eff, remainingDuration: eff.remainingDuration - 1 };
    }).filter(eff => eff.remainingDuration !== 0); // 기간 끝난 효과 제거

    return {
        ...character,
        activeEffects: nextEffects,
        hp: character.hp + hpChange
    };
}