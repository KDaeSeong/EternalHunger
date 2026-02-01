// client/src/utils/eventLogic.js

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
        { id: "wpn_01", text: "녹슨 쇠파이프", type: "weapon", tags: ["blunt"] },
        { id: "wpn_02", text: "정교한 활", type: "weapon", tags: ["ranged"] },
        { id: "misc_01", text: "전공 서적", type: "misc", tags: ["book"] },
        { id: "misc_02", text: "오래된 구급상자", type: "misc", tags: ["heal"] }
    ]
};

export function generateDynamicEvent(char, currentDay) {
    const context = keywordDB.contexts[Math.floor(Math.random() * keywordDB.contexts.length)];
    const object = keywordDB.objects[Math.floor(Math.random() * keywordDB.objects.length)];
    
    // 1. 아이템 발견 확률 (LUK 기반)
    const findChance = Math.random() * 100 + (char.stats.luk || 10);
    
    // [A] 아이템을 발견하여 가방에 넣는 경우 (40% 확률)
    if (findChance > 60) {
        return {
            log: `[${char.name}]은(는) 풀숲에서 [${object.text}]을(를) 발견하여 가방에 넣었습니다!`,
            newItem: { ...object, acquiredDay: currentDay },
            damage: 0
        };
    }

    // [B] 아이템을 즉시 사용하거나 상호작용하는 경우 (기존 로직 통합)
    if (object.type === "food") {
        if (object.tags.includes("poison")) {
            if (char.stats.int > 40) {
                return { log: `[${char.name}]은(는) 지능을 발휘해 [${object.text}]에 독이 든 것을 간파하고 버렸습니다!`, damage: 0 };
            }
            return { 
                log: `[${char.name}]이(가) 독이 든 [${object.text}]을(를) 먹고 식중독에 걸렸습니다!`, 
                damage: 20, 
                newEffect: { name: "식중독", type: "debuff", remainingDuration: 2 } 
            };
        }
        return { log: `[${char.name}]은(는) 발견한 [${object.text}]을(를) 맛있게 먹었습니다.`, recovery: 20 };
    }

    // [C] 야생동물/변이체 조우 확률 (예: 20%)
    const huntChance = Math.random();
    if (huntChance < 0.2) {
        // ruleset에서 정의된 보상금액 가져오기 (기본값 설정)
        const animalCredit = ruleset?.credits?.wildlifeKill || 5; 
        return {
            log: `[${char.name}]은(는) 야생동물을 사냥하여 전리품을 챙겼습니다. (+${animalCredit} Cr)`,
            earnedCredits: animalCredit, // 이 필드를 시뮬레이션에서 처리
            damage: 5 // 사냥 중 입은 경미한 피해
        };
    }

    if (object.type === "weapon") {
        const actionText = object.tags.includes("ranged") ? "조준해 봅니다" : "휘둘러 봅니다";
        const statName = object.tags.includes("ranged") ? "사격" : "숙련도";
        return { log: `[${char.name}]은(는) [${object.text}]를 들고 ${actionText}. ${statName}이 상승하는 기분입니다!`, damage: 0 };
    }

    return { log: `[${char.name}]은(는) ${context.text} 주변을 살피며 평화로운 시간을 보냈습니다.`, damage: 0 };
}