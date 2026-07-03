// client/src/utils/rulesets.js
// 룰 프리셋 모음
// - 변수/함수명: 영문
// - 주석: 한글

// ✅ 시즌 11 페이즈 타이밍(초)
// 참고: 이터널 리턴 패치노트(1.43)에서 낮/밤 시간 조정 수치를 그대로 사용
// - 실제 게임 내에서 추가 조정이 있을 수 있으니, 필요하면 여기만 수정하면 됩니다.
const ER_PHASE_SECONDS = {
  1: { morning: 140, night: 110 },
  2: { morning: 130, night: 120 },
  3: { morning: 130, night: 110 },
  4: { morning: 100, night: 110 },
  5: { morning: 80, night: 80 },
  6: { morning: 70, night: 50 },
  7: { morning: 120, night: 50 },
  8: { morning: 150, night: 150 },
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
  goalLootBoost: 10,
  earlyRoute: {
    chanceMoved: 0.78,
    chanceStay: 0.48,
    chanceFarm: 0.92,
    maxTier: 2,
    equipmentMaxTier: 2,
    routeWeight: 8,
    equipmentWeight: 6,
    goalWeight: 18,
    maxQty: 2,
  },

  // 전설 재료 상자(필드): 2일차 밤 이후부터만 등장(기본)
  legendaryMaterialGate: { day: 2, timeOfDay: 'night' },
  // fallback(맵 상자 미보유)에서 전설 재료 상자를 뽑을 가중치(높을수록 자주)
  legendaryMaterialWeight: 15,
};


// 🏪 마켓(키오스크/드론) 규칙(최소): 판매목록/가격/등장확률을 룰셋으로 고정
// - 시뮬레이터 전용: 서버 마켓 API와 별개로 동작합니다.
const DEFAULT_MARKET_RULES = {
  kiosk: {
    gate: { day: 2, phase: 'morning' },
    // 목표(조합) 기반이면 더 적극적으로 이용
    chanceNeed: 0.46,
    chanceIdle: 0.14,
    // 판매 카테고리 토글
    categories: { vf: true, legendary: true, basic: true },
    prices: {
      vf: 500,
      basic: 10,
      legendaryByKey: { meteor: 200, life_tree: 200, mithril: 250, force_core: 350 },
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
    surplus: { buyChance: 0.72 },
  },
  drone: {
    enabled: true,
    maxTier: 1,
    // 드론은 하급 보급(즉시 지급)용: 고정 가격
    price: 10,
    // 인벤이 비었거나 목표 재료가 있으면 조금 더 자주 호출
    chanceNeedLowInv: 0.62,
    chanceNeedDefault: 0.44,
    chanceLowInv: 0.34,
    chanceInv2: 0.24,
    chanceDefault: 0.12,
    surplusMinCredits: 180,
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
    gateDay: 2,
    perDayMax: 2,
    scaleDiv: 7,
    pickChance: {
      day: { moved: 0.85, stay: 0.65 },
      night: { moved: 0.55, stay: 0.35 },
    },
    keepDays: 2,
  },
  legendaryCrate: {
    gateDay: 2,
    // 튜닝(최소): 과도한 드랍 방지
    perDayMax: 3,
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
  transcendCrate: {
    enabled: true,
    gateDay: 4,
    phase: 'night',
    count: 2,
    optionsCount: 3,
    keepDays: 2,
    worldOnly: true,
  },
  dimensionRift: {
    enabled: true,
    days: [2, 3, 4],
    phase: 'night',
    count: 4,
    maxTeams: 2,
    contestChance: 0.38,
    rewardCreditsByDay: { 2: 45, 3: 65, 4: 90 },
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
    // 보상 풀/가중치(명시): 음식 vs 하급 재료
    rewardTable: {
      categories: [
        { key: 'food', weight: 70, qty: { min: 1, max: 2 } },
        { key: 'material', weight: 30, qty: { min: 1, max: 2 }, tierCap: 1 },
      ],

      // 페이즈(낮/밤)별 카테고리 가중치 보정
      // - 체감용 최소 조정: 밤에는 포만감 보충용 음식 비중을 조금 높임
      phaseMulByCat: {
        day: { food: 1.0, material: 1.0 },
        night: { food: 1.15, material: 0.9 },
      },

      // 맵별 카테고리 가중치 보정(옵션)
      // - 키는 mapId(문자열). 기본은 default.
      // - 맵별로 음식/재료 체감을 조금 바꾸고 싶을 때 사용.
      mapMulByMapId: {
        default: { food: 1.0, material: 1.0 },
      },
      boosts: {
        // 태그/이름 기반 가중치 보정(간단)
        healthyFood: 2,
      },
    },
    reward: {
      // 음식 상자에서 소량 크레딧(선택): 없애고 싶으면 0으로
      credits: { min: 2, max: 8 },
    },
    keepDays: 2,
  },
  bosses: {
    alpha: { gateDay: 2, dropKeywords: ['미스릴', 'mithril'], dmg: { min: 6, base: 22, scaleDiv: 9 }, reward: { credits: { min: 24, max: 48 }, bonusDropChance: 0.15 } },
    omega: { gateDay: 3, dropKeywords: ['포스 코어', 'force core', 'forcecore'], dmg: { min: 8, base: 26, scaleDiv: 9 }, reward: { credits: { min: 34, max: 64 }, bonusDropChance: 0.18 } },
    weakline: { gateDay: 4, dropKeywords: ['vf 혈액', 'vf 샘플', 'blood sample', '혈액 샘플', 'vf'], dmg: { min: 6, base: 18, scaleDiv: 10 }, reward: { credits: { min: 50, max: 90 }, bonusDropChance: 0.22 } },
  },
  wildlife: {
    enabled: true,
    perZoneMinDay: 1,
    perZoneMinNight: 1,
    extraTotalDay: 8,
    extraTotalNight: 10,
    topupCapPerPhase: 18,
    speciesByTimeOfDay: {
      day: [
        { key: 'chicken', weight: 5 },
        { key: 'bat', weight: 3 },
        { key: 'boar', weight: 3 },
        { key: 'dog', weight: 3 },
        { key: 'wolf', weight: 2 },
      ],
      night: [
        { key: 'bat', weight: 3 },
        { key: 'boar', weight: 3 },
        { key: 'dog', weight: 2 },
        { key: 'wolf', weight: 3 },
        { key: 'bear', weight: 3 },
      ],
    },
    hotspotWeights: {
      forest: 2.0,
      pond: 1.6,
      stream: 1.6,
      beach: 1.4,
      port: 1.2,
    },
  },
  bossFallback: {
    retreatBase: 0.20,
    retreatPowerBonusMax: 0.25,
  },
  mutantWildlife: {
    enabled: true,
    gateDay: 2,
    intervalNights: 2,
    spawnChance: 0.75,
  },
};


export const DEFAULT_RULESET_ID = 'ER_S11';

const LEGACY_RULESET_ALIASES = {
  ['ER_S' + '10']: DEFAULT_RULESET_ID,
};

export const RULESETS = {
  ER_S11: {
    id: 'ER_S11',
    label: 'Eternal Return S11 (하이브리드)',

    // ⏱ 페이즈 내부 틱(초)
    tickSec: 1,
    phaseSecondsByDay: ER_PHASE_SECONDS,
    suddenDeath: {
      totalSec: 370,
      forceGather: true,
      forcedClash: true,
      forceClashMaxRounds: 10,
    },

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
      natural: {
        earlyPerCreditSec: 1.45,
        lateGate: { day: 2, timeOfDay: 'night' },
        latePerCreditSec: 2,
      },
      kill: 48,
      wildlifeKill: 34,
      mutantKill: 48,
      kioskSell: 0, // 상점 판매는 추후 상점/인벤 연동 시 산정
    },

    revive: {
      corpseWindowSec: 30,
      corpseInteractSec: 5,
      corpseDamageDivisor: 12,
      autoDelaySecPerLevel: 5,
      autoCutoff: { day: 2, timeOfDay: 'night' },
      teamWipeProtectionCutoff: { day: 2, timeOfDay: 'day' },
      paidStart: { day: 3, timeOfDay: 'day' },
      paidCutoff: { day: 5, timeOfDay: 'day' },
      paidCostBase: 200,
      paidCostPerUse: 0,
      hpRatio: 0.65,
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
      recoverHpBelow: 30,
      recoverMinSaferDelta: 1,
      erPresetStatScale: 1,
      earlyRouteFarmAttempts: 5,
      earlyRouteMaxSearches: 4,
      // 1일차 낮 루트 파밍은 실제 ER 템포에 맞춰 영웅(T4) 5부위 완성을 목표로 합니다.
      day1AbstractFallbackMaxTier: 4,

      // 전투력 낮으면 교전 회피(최소): 상대 대비 불리하면 교전을 피함
      // - ratio = 내Power / (내Power + 상대Power)
      fightAvoidMinRatio: 0.40,
      fightAvoidAbsDelta: 12,
      fightAvoidChance: 0.28,
      fightAvoidExtremeRatio: 0.23,
      fightAvoidExtremeDelta: 42,
      escapeHpBelow: 34,
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
    // - 1순위 목표: 사망 처리 + 루팅 + 전투 후 재정비 최소 규칙을 룰로 고정
    pvp: {
      // 교전 트리거(동일 zone에 n명 이상)
      encounterMinSameZone: 2,
      // 교전 확률(일차/포그 보정 포함)
      encounterBase: 0.50,
      encounterDayScale: 0.09,
      encounterMax: 0.96,
      encounterFogBonus: 0.08,
      earlyRouteFarmEncounterMult: 0.82,
      earlyRouteFarmAvoidChance: 0.30,
      lowHpEncounterMult: 0.42,
      midgameEncounterBonus: 0.18,
      midgameLowHpEncounterMult: 0.86,
      lootCreditRate: 0.42,
      lootCreditMin: 14,
      lootInventoryUnits: 1,
      restHealMax: 3,

      damageBase: 23,
      damageDayScale: 5,
      earlyLethalDamageDayEnd: 4,
      earlyLethalDamageFlat: 14,
      earlyLethalLowHpBonusBelow: 50,
      earlyLethalLowHpBonus: 18,
      earlyLethalFinishHpBelow: 30,
      earlyLethalFinishChanceBase: 0.30,
      earlyLethalFinishChanceDayScale: 0.09,
      earlyLethalFinishRatioBonus: 0.20,
      earlyLethalFinishMax: 0.74,
      midgameLethalFinishBonus: 0.16,
      criticalFleeHpBelow: 20,
      criticalFleeChance: 0.18,


      // 전투 후 승자 행동(추가 휴식/이동)
      postBattleMoveChance: 0.35,
      postBattleRestHpBelow: 45,
      postBattleRestExtraHealMax: 4,
    },

    // 🧪 소모품(최소): 음식 아이템을 전투 외 타이밍에 자동 사용
    consumables: {
      enabled: true,
      aiUseHpBelow: 60,
      afterBattleHpBelow: 50,
      aiUseSatietyBelow: 35,
      satietyDecayPerAction: 1,
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
      autoDropLowValue: true,
      autoDropMinIncomingScore: 14,
      autoDropScoreMargin: 8,
      autoDropConsumablesForPriority: true,
      autoDropConsumableMinIncomingScore: 50,
      autoDropConsumableMaxTier: 2,
    },

    // 장비(전투 보정 최소)
    equipment: {
      weaponAtkPerTier: 6,
      armorDefPerTier: 4,
      maxTier: 6,
      replaceOnlyIfBetter: true,
      immediateSpecialCraft: {
        legendGate: { day: 2, timeOfDay: 'night' },
        transGate: { day: 4, timeOfDay: 'day' },
        perDayMax: 1,
        perPhaseMax: 1,
      },
    },

    battle: {
      erMetaScale: 1,
    },

    skills: {
      enabled: true,
      characterSkills: true,
      aiUseSkills: true,
      showSkillLogs: true,
      cooldownScale: 1,
    },

    diagnostics: {
      thresholds: {
        minMidDeathShare: 0.34,
        maxEndDeathShare: 0.52,
        minPvpDeathShare: 0.48,
        minCaughtShare: 0.24,
        minHeroGearReadyShare: 0.70,
      },
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
      recoverHpBelow: 30,
      recoverMinSaferDelta: 1,
      erPresetStatScale: 0.45,
      earlyRouteFarmAttempts: 5,
      earlyRouteMaxSearches: 4,
      day1AbstractFallbackMaxTier: 4,
      fightAvoidMinRatio: 0.40,
      fightAvoidAbsDelta: 12,
      fightAvoidChance: 0.34,
      fightAvoidExtremeRatio: 0.23,
      fightAvoidExtremeDelta: 42,
      escapeHpBelow: 34,
    },


    // 🌍 월드 스폰(맵 이벤트): 전설 상자/보스/자연 코어
    worldSpawns: DEFAULT_WORLD_SPAWNS,
    pvp: {
      encounterMinSameZone: 2,
      encounterBase: 0.50,
      encounterDayScale: 0.09,
      encounterMax: 0.96,
      encounterFogBonus: 0.00,
      earlyRouteFarmEncounterMult: 0.82,
      earlyRouteFarmAvoidChance: 0.30,
      lowHpEncounterMult: 0.42,
      midgameEncounterBonus: 0.12,
      midgameLowHpEncounterMult: 0.74,
      lootCreditRate: 0.42,
      lootCreditMin: 14,
      lootInventoryUnits: 1,
      restHealMax: 3,

      damageBase: 23,
      damageDayScale: 5,
      earlyLethalDamageDayEnd: 4,
      earlyLethalDamageFlat: 14,
      earlyLethalLowHpBonusBelow: 50,
      earlyLethalLowHpBonus: 18,
      earlyLethalFinishHpBelow: 30,
      earlyLethalFinishChanceBase: 0.26,
      earlyLethalFinishChanceDayScale: 0.08,
      earlyLethalFinishRatioBonus: 0.18,
      earlyLethalFinishMax: 0.68,
      midgameLethalFinishBonus: 0.10,
      criticalFleeHpBelow: 20,
      criticalFleeChance: 0.18,


      // 전투 후 승자 행동(추가 휴식/이동)
      postBattleMoveChance: 0.35,
      postBattleRestHpBelow: 45,
      postBattleRestExtraHealMax: 4,
    },

    // 🧪 소모품(최소): 음식 아이템을 전투 외 타이밍에 자동 사용
    consumables: {
      enabled: true,
      aiUseHpBelow: 60,
      afterBattleHpBelow: 50,
      aiUseSatietyBelow: 35,
      satietyDecayPerAction: 1,
      maxUsesPerPhase: 1,
    },

    // 🎒 인벤토리/장비(최소): 슬롯/스택 상한
    inventory: {
      maxSlots: 10,
      stackMax: { material: 3, consumable: 6, equipment: 1 },
      equipSlots: ['head', 'clothes', 'arm', 'shoes', 'weapon'],
      autoDropLowValue: true,
      autoDropMinIncomingScore: 14,
      autoDropScoreMargin: 8,
      autoDropConsumablesForPriority: true,
      autoDropConsumableMinIncomingScore: 50,
      autoDropConsumableMaxTier: 2,
    },

    // 장비(전투 보정 최소)
    equipment: {
      weaponAtkPerTier: 6,
      armorDefPerTier: 4,
      maxTier: 6,
      replaceOnlyIfBetter: true,
      immediateSpecialCraft: {
        legendGate: { day: 2, timeOfDay: 'night' },
        transGate: { day: 4, timeOfDay: 'day' },
        perDayMax: 1,
        perPhaseMax: 1,
      },
    },

    battle: {
      erMetaScale: 0.65,
    },

    skills: {
      enabled: false,
      characterSkills: false,
      aiUseSkills: false,
      showSkillLogs: false,
      cooldownScale: 1,
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
  const id = normalizeRulesetId(rulesetId);
  const keys = [`eh_ruleset_override_${id}`];
  if (id === DEFAULT_RULESET_ID) keys.push(`eh_ruleset_override_${'ER_S' + '10'}`);

  for (const key of keys) {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? safeJsonParse(raw) : null;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
  }
  return null;
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

export function normalizeRulesetId(rulesetId) {
  const raw = String(rulesetId || DEFAULT_RULESET_ID);
  const aliased = LEGACY_RULESET_ALIASES[raw] || raw;
  return RULESETS[aliased] ? aliased : DEFAULT_RULESET_ID;
}

export function getRuleset(rulesetId) {
  const id = normalizeRulesetId(rulesetId);
  const base = RULESETS[id] || RULESETS[DEFAULT_RULESET_ID];
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

export function getNaturalCreditGain(ruleset, day, phase, durationSec) {
  const credits = ruleset?.credits || {};
  const natural = credits?.natural || null;
  if (!natural) return Math.max(0, Number(credits?.basePerPhase || 0));

  const curDay = Number(day || 0);
  const curTod = phase === 'morning' ? 'day' : 'night';
  const gateDay = Number(natural?.lateGate?.day ?? 2);
  const gateTod = String(natural?.lateGate?.timeOfDay ?? natural?.lateGate?.phase ?? 'night');
  const todOrder = { day: 0, night: 1 };
  const isLate = curDay > gateDay || (curDay === gateDay && (todOrder[curTod] ?? 0) >= (todOrder[gateTod] ?? 1));
  const interval = Math.max(0.1, Number(isLate ? natural?.latePerCreditSec : natural?.earlyPerCreditSec) || 1);
  return Math.max(0, Math.floor(Math.max(0, Number(durationSec || 0)) / interval));
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
