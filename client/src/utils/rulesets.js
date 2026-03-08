// client/src/utils/rulesets.js
// 룰 프리셋 모음
// - 변수/함수명: 영문
// - 주석: 한글

// ✅ 시즌10 페이즈 타이밍(초)
// 참고: 이터널 리턴 패치노트(1.43)에서 낮/밤 시간 조정 수치를 그대로 사용
// - 실제 게임 내에서 추가 조정이 있을 수 있으니, 필요하면 여기만 수정하면 됩니다.
const ER_PHASE_SECONDS = {
  1: { morning: 90, night: 90 },
  2: { morning: 90, night: 90 },
  3: { morning: 90, night: 90 },
  4: { morning: 90, night: 90 },
  5: { morning: 90, night: 90 },
  6: { morning: 90, night: 90 },
  7: { morning: 90, night: 90 },
};

// ✅ Fog(퍼플 포그) 타이밍
// - 로얄 로드맵 설명: "Day 2/3/4의 middle"에 Fog zone 생성
// - 이 시뮬레이터에서는 "해당 일차 낮(morning) 페이즈의 중간"을 기본값으로 사용
const DEFAULT_FOG_SCHEDULE = [
  { day: 2, phase: 'morning', at: 'middle' },
  { day: 3, phase: 'morning', at: 'middle' },
  { day: 4, phase: 'morning', at: 'middle' },
];

// 📦 구역 상자(필드 파밍) 확률/미보유(fallback) 규칙
// - 맵에 itemCrates가 없거나, 현재 구역에 상자가 없을 때도 "최소 루프"가 끊기지 않게 유지
const DEFAULT_FIELD_CRATE_DROP = {
  chanceMoved: 0.28,
  chanceStay: 0.12,
  fallbackChanceMoved: 0.20,
  fallbackChanceStay: 0.08,
  fallbackMaxTier: 2,

  // 전설 재료 상자(필드): 2일차 밤 이후부터만 등장(기본)
  legendaryMaterialGate: { day: 2, timeOfDay: 'night' },
  // fallback(맵 상자 미보유)에서 전설 재료 상자를 뽑을 가중치(높을수록 자주)
  legendaryMaterialWeight: 15,
};


// 🏪 마켓(키오스크/드론) 규칙(최소): 판매목록/가격/등장확률을 룰셋으로 고정
// - 시뮬레이터 전용: 서버 마켓 API와 별개로 동작합니다.
const DEFAULT_MARKET_RULES = {
  kiosk: {
    gate: { day: 1, phase: 'night' },
    // 목표(조합) 기반이면 더 적극적으로 이용
    chanceNeed: 0.46,
    chanceIdle: 0.14,
    // 판매 카테고리 토글
    categories: { vf: true, legendary: true, basic: true },
    prices: {
      vf: 500,
      basic: 10,
      legendaryByKey: { meteor: 200, life_tree: 200, mithril: 200, force_core: 350 },
    },
    buySuccess: { vf: 0.90, legendary: 0.92, basic: 0.88 },
    exchange: {
      consumeUnits: 3,
      chanceNeed: 0.90,
      chanceFallback: 0.75,
      preserveNeededSpecials: true,
      spareForceCoreToMithril: 1,
      spareMithrilToTacModule: 2,
    },
    fallback: { vfChance: 0.40, legendaryChance: 0.34, basicChance: 0.55 },
  },
  drone: {
    enabled: true,
    // 드론은 하급 보급(즉시 지급)용: 고정 가격
    price: 10,
    // 인벤이 비었거나 목표 재료가 있으면 조금 더 자주 호출
    chanceNeedLowInv: 0.62,
    chanceNeedDefault: 0.44,
    chanceLowInv: 0.34,
    chanceInv2: 0.24,
    chanceDefault: 0.12,
    // 목표 재료 가중치
    needWeightMul: 12,
    needFallbackWeight: 8,
    needFallbackPrice: 10,
    fallbackKeywords: [
      '천', '가죽', '철', '돌', '나뭇',
      'wood', 'leather', 'fabric', 'iron', 'stone',
    ],
  },
};

// 🌍 월드 스폰(맵 이벤트) 규칙(최소): 전설 상자/자연 코어/보스
// - 스폰/개봉/픽업/보스 드랍을 page.js 하드코딩에서 분리
const DEFAULT_WORLD_SPAWNS = {
  core: {
    gateDay: 1,
    perDayMax: 2,
    scaleDiv: 7,
    pickChance: {
      day: { moved: 0.85, stay: 0.65 },
      night: { moved: 0.55, stay: 0.35 },
    },
    keepDays: 2,
  },
  legendaryCrate: {
    gateDay: 3,
    // 튜닝(최소): 과도한 드랍 방지
    perDayMax: 2,
    scaleDiv: 7,
    // 드랍 가중치(키 기반): page.js 하드코딩 제거용
    dropWeightsByKey: { meteor: 3, life_tree: 3, mithril: 2, force_core: 1 },
    openChance: {
      day: { moved: 0.85, stay: 0.65 },
      night: { moved: 0.55, stay: 0.35 },
    },
    reward: {
      credits: { min: 18, max: 40 },
      bonusDropChance: 0.25,
    },
    keepDays: 3,
  },
  foodCrate: {
    gateDay: 1,
    // 음식 상자는 초반 리스크 관리(회복 루트)용: 과도한 드랍 방지 위해 일일 상한 고정
    perDayMax: 4,
    scaleDiv: 5,
    openChance: {
      day: { moved: 0.70, stay: 0.55 },
      night: { moved: 0.45, stay: 0.30 },
    },
    // 보상 풀/가중치(명시): 음식 vs 의료 vs 하급 재료
    rewardTable: {
      categories: [
        { key: 'food', weight: 55, qty: { min: 1, max: 2 } },
        { key: 'medical', weight: 25, qty: { min: 1, max: 1 } },
        { key: 'material', weight: 20, qty: { min: 1, max: 2 }, tierCap: 1 },
      ],

      // 페이즈(낮/밤)별 카테고리 가중치 보정
      // - 체감용 최소 조정: 밤에는 의료 비중을 조금 높임
      phaseMulByCat: {
        day: { food: 1.0, medical: 1.0, material: 1.0 },
        night: { food: 0.9, medical: 1.25, material: 0.9 },
      },

      // 맵별 카테고리 가중치 보정(옵션)
      // - 키는 mapId(문자열). 기본은 default.
      // - 맵별로 의료/재료 체감을 조금 바꾸고 싶을 때 사용.
      mapMulByMapId: {
        default: { food: 1.0, medical: 1.0, material: 1.0 },
      },
      boosts: {
        // 태그/이름 기반 가중치 보정(간단)
        healthyFood: 2,
        bandageName: 2,
      },
    },
    reward: {
      // 음식 상자에서 소량 크레딧(선택): 없애고 싶으면 0으로
      credits: { min: 2, max: 8 },
    },
    keepDays: 2,
  },
  bosses: {
    alpha: { gateDay: 3, dropKeywords: ['미스릴', 'mithril'], dmg: { min: 6, base: 22, scaleDiv: 9 }, reward: { credits: { min: 24, max: 48 }, bonusDropChance: 0.15 } },
    omega: { gateDay: 4, dropKeywords: ['포스 코어', 'force core', 'forcecore'], dmg: { min: 8, base: 26, scaleDiv: 9 }, reward: { credits: { min: 34, max: 64 }, bonusDropChance: 0.18 } },
    weakline: { gateDay: 5, dropKeywords: ['vf 혈액', 'vf 샘플', 'blood sample', '혈액 샘플', 'vf'], dmg: { min: 6, base: 18, scaleDiv: 10 }, reward: { credits: { min: 50, max: 90 }, bonusDropChance: 0.22 } },
  },
  bossFallback: {
    retreatBase: 0.20,
    retreatPowerBonusMax: 0.25,
  },
};


export const RULESETS = {
  ER_S10: {
    id: 'ER_S10',
    label: 'Eternal Return S10 (하이브리드)',

    // ⏱ 페이즈 내부 틱(초)
    tickSec: 1,
    phaseSecondsByDay: ER_PHASE_SECONDS,

    // 🚫 폭발 타이머(금지구역)
    // - 시작 20초 / 최대 30초 / 처치 시 +5초(캡 적용)
    detonation: {
      startSec: 20,
      maxSec: 30,
      killBonusSec: 5,
      // page.js에서 쓰는 키 이름에 맞춰 둡니다.
      decreasePerSecForbidden: 1,
      regenPerSecOutsideForbidden: 1, // 금지구역 밖에서는 초당 회복(시뮬레이터용 단순화)
      criticalSec: 5,
    },

    // 🚫 금지구역
    // - 금지구역에 들어가면 탈출을 "시도"하지만, 100% 강제 이동은 하지 않습니다.
    //   (머무르면 폭발 타이머로 사망)
    forbidden: {
      escapeMoveChance: 0.95,
    },

    // 🔋 가젯 에너지(시뮬레이터 단순화)
    gadgetEnergy: {
      start: 100,
      max: 100,
      gainPerPhase: 10,
    },

    // 🧰 신규 가젯
    gadgets: {
      portableSafeZone: {
        energyCost: 40,
        cooldownSec: 30,
        durationSec: 7,
        noisePingMeter: 80,
      },
      cnotGate: {
        energyCost: 30,
        cooldownSec: 10,
        channelSec: 3, // 실제 게임: 3초 채널링 후 텔레포트
      },
    },

    // 🌫 퍼플 포그
    fog: {
      enabled: true,
      schedule: DEFAULT_FOG_SCHEDULE,
      warningSec: 30,
      // NOTE: 공식 문서에 "n seconds"로 표기되어 고정값이 명시되지 않은 구간이 있어,
      // 시뮬레이터에선 임시로 45초를 기본값으로 사용합니다.
      durationSec: 45,
    },

    // 🐺🐻 리스폰 규칙
    wildlife: {
      wolvesRespawnAt: 'dayStart',
      bearsRespawnAt: 'nightStart',
    },

    // 💳 크레딧(로드맵 5)
    credits: {
      start: 15,
      basePerPhase: 18,
      kill: 48,
      wildlifeKill: 34,
      mutantKill: 48,
      kioskSell: 0, // 상점 판매는 추후 상점/인벤 연동 시 산정
    },

    // 🏪 마켓(키오스크/드론): 판매목록/가격/등장확률
    market: DEFAULT_MARKET_RULES,

    // 🤖 AI 이동(사람처럼 보이기): 목표 존 TTL
    ai: {
      targetTtlMin: 2,
      targetTtlMax: 4,
      clearOnReach: true,

      // 회피/회복 이동 시 안전 존 탐색 깊이(BFS)
      safeSearchDepth: 3,

      // 저HP 회복 우선(최소): 위험 행동(교전/사냥)보다 안전 이동을 우선
      recoverHpBelow: 38,
      recoverMinSaferDelta: 1,

      // 전투력 낮으면 교전 회피(최소): 상대 대비 불리하면 교전을 피함
      // - ratio = 내Power / (내Power + 상대Power)
      fightAvoidMinRatio: 0.44,
      fightAvoidAbsDelta: 10,
      powerWeaponPerTier: 3,
      powerArmorPerTier: 1.5,
    },


    // 🌍 월드 스폰(맵 이벤트): 전설 상자/보스/자연 코어
    worldSpawns: DEFAULT_WORLD_SPAWNS,

    // 📦 드랍(룰셋): 구역 상자/필드 파밍
    drops: {
      fieldCrate: DEFAULT_FIELD_CRATE_DROP,
    },
    // ⚔️ PvP(캐릭터 vs 캐릭터) 보상/회복 규칙
    // - 1순위 목표: 사망 처리 + 루팅 + 전투 후 숨고르기 최소 규칙을 룰로 고정
    pvp: {
      // 교전 트리거(동일 zone에 n명 이상)
      encounterMinSameZone: 2,
      // 교전 확률(일차/포그 보정 포함)
      encounterBase: 0.32,
      encounterDayScale: 0.06,
      encounterMax: 0.88,
      encounterFogBonus: 0.08,
      // 이벤트(야생/상자/보스 등) 확률의 상한/오프셋(기존 하드코딩 제거용)
      eventOffset: 0.30,
      eventMax: 0.95,

      lootCreditRate: 0.42,
      lootCreditMin: 14,
      lootInventoryUnits: 1,
      restHealMax: 6,

      // 🩸 상태이상(최소): 출혈
      // - 피격 시 확률로 출혈이 걸리고, 페이즈 시작마다 DOT가 들어갑니다.
      // - 붕대/응급 아이템 사용 시 출혈을 제거(시뮬 로직에서 처리)
      bleedEnabled: true,
      bleedChanceOnHit: 0.22,
      bleedMinDamage: 10,
      bleedDurationPhases: 2,
      bleedDotPerPhase: 6,


      // 전투 후 승자 행동(추가 휴식/이동)
      postBattleMoveChance: 0.35,
      postBattleRestHpBelow: 45,
      postBattleRestExtraHealMax: 6,
    },

    // 🧪 소모품(최소): 음식/의료 아이템을 전투 외 타이밍에 자동 사용
    consumables: {
      enabled: true,
      aiUseHpBelow: 60,
      afterBattleHpBelow: 50,
      maxUsesPerPhase: 1,
    },

    // 🎒 인벤토리/장비(최소): 슬롯/스택 상한
    // - 인벤토리 슬롯(아이템 스택 단위): 10칸
    // - 재료: 3개, 소모품: 6개, 장비: 1개(비중첩)
    // - 장비 타입: head/clothes/arm/shoes/weapon(분류만 먼저, 장착 UI는 후속)
    inventory: {
      maxSlots: 10,
      stackMax: { material: 3, consumable: 6, equipment: 1 },
      equipSlots: ['head', 'clothes', 'arm', 'shoes', 'weapon'],
    },

    // 장비(전투 보정 최소)
    equipment: {
      weaponAtkPerTier: 6,
      armorDefPerTier: 4,
      maxTier: 6,
      replaceOnlyIfBetter: true,
    },
  },

  LEGACY: {
    id: 'LEGACY',
    label: 'Legacy (단순 규칙)',
    tickSec: 1,
    phaseSecondsByDay: ER_PHASE_SECONDS,
    // 🚫 폭발 타이머(금지구역) - Legacy에서도 동일하게 사용
    detonation: {
      startSec: 20,
      maxSec: 30,
      killBonusSec: 5,
      decreasePerSecForbidden: 1,
      regenPerSecOutsideForbidden: 1,
      criticalSec: 5,
      // 안전구역 2곳 남으면 40s 유예 후 전 구역 감소
      forceAllAfterSec: 40,
      // 로그 마일스톤(과도한 로그 방지)
      logMilestones: [15, 10, 5, 3, 1, 0],
    },
    gadgetEnergy: null,
    gadgets: null,
    fog: { enabled: false, schedule: [], warningSec: 0, durationSec: 0 },
    wildlife: { wolvesRespawnAt: null, bearsRespawnAt: null },
    credits: { basePerPhase: 10, kill: 0, wildlifeKill: 0, mutantKill: 0, kioskSell: 0 },

    // 🚫 금지구역
    forbidden: {
      escapeMoveChance: 0.95,
    },

    // 📦 드랍(룰셋): 구역 상자/필드 파밍
    drops: {
      fieldCrate: DEFAULT_FIELD_CRATE_DROP,
    },

    // 🏪 마켓(키오스크/드론): 판매목록/가격/등장확률
    market: DEFAULT_MARKET_RULES,

    // 🤖 AI 이동(사람처럼 보이기): 목표 존 TTL
    ai: {
      targetTtlMin: 2,
      targetTtlMax: 4,
      clearOnReach: true,

      // 회피/회복 이동 시 안전 존 탐색 깊이(BFS)
      safeSearchDepth: 3,

      // 저HP 회복 우선(최소): 위험 행동(교전/사냥)보다 안전 이동을 우선
      recoverHpBelow: 38,
      recoverMinSaferDelta: 1,
    },


    // 🌍 월드 스폰(맵 이벤트): 전설 상자/보스/자연 코어
    worldSpawns: DEFAULT_WORLD_SPAWNS,
    pvp: {
      encounterMinSameZone: 2,
      encounterBase: 0.32,
      encounterDayScale: 0.06,
      encounterMax: 0.88,
      encounterFogBonus: 0.00,
      eventOffset: 0.30,
      eventMax: 0.95,

      lootCreditRate: 0.42,
      lootCreditMin: 14,
      lootInventoryUnits: 1,
      restHealMax: 6,

      // 🩸 상태이상(최소): 출혈
      // - 피격 시 확률로 출혈이 걸리고, 페이즈 시작마다 DOT가 들어갑니다.
      // - 붕대/응급 아이템 사용 시 출혈을 제거(시뮬 로직에서 처리)
      bleedEnabled: true,
      bleedChanceOnHit: 0.22,
      bleedMinDamage: 10,
      bleedDurationPhases: 2,
      bleedDotPerPhase: 6,


      // 전투 후 승자 행동(추가 휴식/이동)
      postBattleMoveChance: 0.35,
      postBattleRestHpBelow: 45,
      postBattleRestExtraHealMax: 6,
    },

    // 🧪 소모품(최소): 음식/의료 아이템을 전투 외 타이밍에 자동 사용
    consumables: {
      enabled: true,
      aiUseHpBelow: 60,
      afterBattleHpBelow: 50,
      maxUsesPerPhase: 1,
    },

    // 🎒 인벤토리/장비(최소): 슬롯/스택 상한
    inventory: {
      maxSlots: 10,
      stackMax: { material: 3, consumable: 6, equipment: 1 },
      equipSlots: ['head', 'clothes', 'arm', 'shoes', 'weapon'],
    },

    // 장비(전투 보정 최소)
    equipment: {
      weaponAtkPerTier: 6,
      armorDefPerTier: 4,
      maxTier: 6,
      replaceOnlyIfBetter: true,
    },
  },
};

function safeJsonParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function readRulesetOverride(rulesetId) {
  if (typeof window === 'undefined') return null;
  const key = `eh_ruleset_override_${String(rulesetId || 'ER_S10')}`;
  const raw = window.localStorage.getItem(key);
  const parsed = raw ? safeJsonParse(raw) : null;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  return parsed;
}

function mergeDeep(base, patch) {
  if (patch === null || patch === undefined) return base;
  if (Array.isArray(patch)) return patch;
  if (typeof patch !== 'object') return patch;
  const baseObj = (base && typeof base === 'object') ? base : undefined;
  const out = Array.isArray(baseObj) ? [...baseObj] : { ...(baseObj || {}) };
  for (const k of Object.keys(patch)) {
    const bv = baseObj ? baseObj[k] : undefined;
    out[k] = mergeDeep(bv, patch[k]);
  }
  return out;
}

export function getRuleset(rulesetId) {
  const id = RULESETS[rulesetId] ? rulesetId : 'ER_S10';
  const base = RULESETS[id] || RULESETS.ER_S10;
  const ov = readRulesetOverride(id);
  if (!ov) return base;
  return mergeDeep(base, ov);
}

export function getPhaseDurationSec(ruleset, day, phase) {
  const dayKey = Number(day);
  const table = ruleset.phaseSecondsByDay || {};
  const fallback = table[1] || { morning: 120, night: 120 };
  const row = table[dayKey] || fallback;
  return Math.max(1, Number(row?.[phase] || 120));
}

export function getFogLocalTimeSec(ruleset, day, phase, durationSec) {
  const fog = ruleset?.fog;
  if (!fog?.enabled) return null;

  const hit = (fog.schedule || []).find(s => Number(s.day) === Number(day) && s.phase === phase);
  if (!hit) return null;

  if (hit.at === 'middle') return Math.floor(durationSec / 2);
  if (typeof hit.at === 'number') return Math.max(0, Math.min(durationSec, hit.at));
  return Math.floor(durationSec / 2);
}
