import { getEffectiveStats } from './statusLogic';

/**
 * ⚔️ 통합 전투 시뮬레이터 (보정치 적용됨)
 * @param {Object} p1 - 플레이어 1
 * @param {Object} p2 - 플레이어 2
 * @param {number} day - 현재 날짜
 * @param {Object} settings - ★ [추가] 게임 설정 객체 (가중치 포함)
 */
export function calculateBattle(p1, p2, day, settings = {}) {
    const s1 = getEffectiveStats(p1);
    const s2 = getEffectiveStats(p2);
  
    // 1. 설정에서 가중치 꺼내기 (없으면 기본값 1.0)
    // 안전하게 꺼내기 위해 옵셔널 체이닝(?.) 사용
    const w = settings?.statWeights || { 
        str: 1.0, agi: 1.0, int: 1.0, men: 1.0, 
        luk: 1.0, dex: 1.0, sht: 1.0, end: 1.0 
    };

    // --- 서든데스 가중치 ---
    const suddenDeathMultiplier = 1 + (day * 0.1); 

    let score1 = 0;
    let score2 = 0;
    let logs = [];

    // --- 2. 스킬 및 무기 보너스 (INT, MEN 적용) ---
    const getBonuses = (char, stats, opponentStats) => {
        let skillBonus = 0;
        let wpnBonus = 0;
        let skillLog = "";

        // ★ [INT: 지능] 스킬 공격력 증폭
        // ★ [MEN: 정신] 상대 스킬 피해 경감 (마법 저항력 개념)
        const skillMult = Math.max(0.1, w.int - (opponentStats.men * w.men * 0.005)); 

        // [스킬] 시로코: 드론 지원
        if (char.name.includes("시로코") && !char.name.includes("테러")) {
            skillBonus = (stats.sht * 0.3) * skillMult; // 지능 비례 강화
            skillLog = `🚁 [${char.name}]의 드론 지원 사격!`;
        }
        // [스킬] 시로코*테러: 심연의 힘
        if (char.name.includes("테러")) {
            skillBonus = ((100 - char.hp) * 0.5) * skillMult;
            if (skillBonus > 15) skillLog = `🌑 [${char.name}]의 심연이 폭발합니다!`;
        }

        // [무기] 인벤토리 확인
        const wpn = char.inventory?.find(i => i.type === 'weapon');
        if (wpn) {
            // 무기 효율도 가중치 영향 받음
            wpnBonus = wpn.tags.includes('ranged') 
                ? (stats.sht * w.sht * 0.2) 
                : (stats.str * w.str * 0.2);
        }

        return { skillBonus, wpnBonus, skillLog };
    };

    const p1Bonus = getBonuses(p1, s1, s2);
    const p2Bonus = getBonuses(p2, s2, s1);

    if (p1Bonus.skillLog) logs.push(p1Bonus.skillLog);
    if (p2Bonus.skillLog) logs.push(p2Bonus.skillLog);

    // --- 3. 점수 합산 (가중치 적용) ---
    score1 += (p1Bonus.skillBonus + p1Bonus.wpnBonus) * suddenDeathMultiplier;
    score2 += (p2Bonus.skillBonus + p2Bonus.wpnBonus) * suddenDeathMultiplier;

    // ★ [SHT vs AGI] 사격 vs 회피
    // 기존 0.5 같은 고정 상수 대신 가중치(w.sht, w.agi)를 직접 곱해 영향력 조절
    const shoot1 = Math.max(0, (s1.sht * w.sht) - (s2.agi * w.agi)) * suddenDeathMultiplier;
    const shoot2 = Math.max(0, (s2.sht * w.sht) - (s1.agi * w.agi)) * suddenDeathMultiplier;
    score1 += shoot1;
    score2 += shoot2;

    // ★ [STR+DEX vs END] 근접+손재주 vs 방어
    const melee1 = Math.max(0, (s1.str * w.str) + (s1.dex * w.dex) - (s2.end * w.end)) * suddenDeathMultiplier;
    const melee2 = Math.max(0, (s2.str * w.str) + (s2.dex * w.dex) - (s1.end * w.end)) * suddenDeathMultiplier;
    score1 += melee1;
    score2 += melee2;

    // ★ [LUK: 행운] 랜덤 변수 (크리티컬/운)
    // 행운이 높을수록 최대 20점까지 추가 점수 획득
    score1 += Math.random() * (s1.luk * w.luk * 0.2); 
    score2 += Math.random() * (s2.luk * w.luk * 0.2);

    // --- 무승부 판정 ---
    const diff = score1 - score2;
    const drawThreshold = Math.max(5, 30 - (day * 3)); 

    if (Math.abs(diff) < drawThreshold) {
        const drawLogs = [
            `🤝 [${p1.name}]와(과) [${p2.name}]은(는) 치열한 접전 끝에 승부를 내지 못하고 물러납니다.`,
            `🛡️ [${p1.name}]의 기습을 [${p2.name}]이(가) 간신히 막아내고 거리를 벌립니다.`,
            `⚔️ [${p1.name}]와(과) [${p2.name}]의 무기가 격렬하게 부딪혔지만, 결정타는 없었습니다.`
        ];
        const randomLog = drawLogs[Math.floor(Math.random() * drawLogs.length)];
        return { winner: null, isDraw: true, log: randomLog, type: "normal" };
    }

    // --- 승리 판정 ---
    const winner = diff > 0 ? p1 : p2;
    const loser = diff > 0 ? p2 : p1;

    let winLog = "";
    if (day >= 5) {
        winLog = `🔥 [${winner.name}]의 치명적인 일격이 [${loser.name}]을(를) 완전히 분쇄했습니다!`;
    } else {
        winLog = `💀 [${winner.name}]이(가) [${loser.name}]을(를) 쓰러뜨리고 승리했습니다!`;
    }

    const finalLog = logs.length > 0 ? (logs.join('\n') + '\n' + winLog) : winLog;
    return { winner, log: finalLog, type: "death" };
}