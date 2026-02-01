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


// [수정] 인자에 ruleset 추가!
export function generateDynamicEvent(char, currentDay, ruleset) { 
    const context = keywordDB.contexts[Math.floor(Math.random() * keywordDB.contexts.length)];
    const object = keywordDB.objects[Math.floor(Math.random() * keywordDB.objects.length)];
    
    // 1. 아이템 발견 확률 (LUK 기반)
    const findChance = Math.random() * 100 + (char.stats.luk || 10);
    
    // [A] 아이템 발견
    if (findChance > 60) {
        return {
            log: `[${char.name}]은(는) 풀숲에서 [${object.text}]을(를) 발견하여 가방에 넣었습니다!`,
            newItem: { ...object, acquiredDay: currentDay },
            damage: 0
        };
    }

    // [B] 음식/무기 상호작용
    if (object.type === "food") {
        if (object.tags.includes("poison")) {
            if ((char.stats.int || 0) > 40) { // 안전하게 int 참조
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

    // [C] 야생동물/변이체 조우 (수정하신 부분)
    const huntChance = Math.random();
    if (huntChance < 0.2) {
        // ruleset 인자가 들어와야 여기서 에러가 안 납니다.
        const animalCredit = ruleset?.credits?.wildlifeKill || 5; 
        return {
            log: `[${char.name}]은(는) 야생동물을 사냥하여 전리품을 챙겼습니다. (+${animalCredit} Cr)`,
            earnedCredits: animalCredit, // 이 값을 simulation/page.js에서 받아줘야 함
            damage: 5
        };
    }

    if (object.type === "weapon") {
        const actionText = object.tags.includes("ranged") ? "조준해 봅니다" : "휘둘러 봅니다";
        const statName = object.tags.includes("ranged") ? "사격" : "숙련도";
        return { log: `[${char.name}]은(는) [${object.text}]를 들고 ${actionText}. ${statName}이 상승하는 기분입니다!`, damage: 0 };
    }

    return { log: `[${char.name}]은(는) ${context.text} 주변을 살피며 평화로운 시간을 보냈습니다.`, damage: 0 };
}