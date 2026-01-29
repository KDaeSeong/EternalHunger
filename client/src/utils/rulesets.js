// client/src/utils/rulesets.js
// 룰 프리셋 모음
// - 변수/함수명: 영문
// - 주석: 한글

// ✅ 시즌10 페이즈 타이밍(초)
// 참고: 이터널 리턴 패치노트(1.43)에서 낮/밤 시간 조정 수치를 그대로 사용
// - 실제 게임 내에서 추가 조정이 있을 수 있으니, 필요하면 여기만 수정하면 됩니다.
const ER_PHASE_SECONDS = {
  1: { morning: 140, night: 110 },
  2: { morning: 130, night: 130 },
  3: { morning: 130, night: 120 },
  4: { morning: 110, night: 110 },
  5: { morning: 100, night: 90 },
  6: { morning: 50,  night: 90 },
  7: { morning: 60,  night: 80 },
};

// ✅ Fog(퍼플 포그) 타이밍
// - 로얄 로드맵 설명: "Day 2/3/4의 middle"에 Fog zone 생성
// - 이 시뮬레이터에서는 "해당 일차 낮(morning) 페이즈의 중간"을 기본값으로 사용
const DEFAULT_FOG_SCHEDULE = [
  { day: 2, phase: 'morning', at: 'middle' },
  { day: 3, phase: 'morning', at: 'middle' },
  { day: 4, phase: 'morning', at: 'middle' },
];

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
      regenPerSecOutside: 1, // 금지구역 밖에서는 초당 회복(시뮬레이터용 단순화)
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
      basePerPhase: 10,
      kill: 25,
      wildlifeKill: 5,
      mutantKill: 8,
      kioskSell: 0, // 상점 판매는 추후 상점/인벤 연동 시 산정
    },
  },

  LEGACY: {
    id: 'LEGACY',
    label: 'Legacy (단순 규칙)',
    tickSec: 0,
    phaseSecondsByDay: ER_PHASE_SECONDS,
    detonation: null,
    gadgetEnergy: null,
    gadgets: null,
    fog: { enabled: false, schedule: [], warningSec: 0, durationSec: 0 },
    wildlife: { wolvesRespawnAt: null, bearsRespawnAt: null },
    credits: { basePerPhase: 10, kill: 0, wildlifeKill: 0, mutantKill: 0, kioskSell: 0 },
  },
};

export function getRuleset(rulesetId) {
  return RULESETS[rulesetId] || RULESETS.ER_S10;
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
