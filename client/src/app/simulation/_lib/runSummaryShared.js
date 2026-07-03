export const GAIN_SOURCE_LABELS = {
  box: '상자',
  foodcrate: '음식상자',
  natural: '자연스폰',
  gather: '채집',
  craft: '제작',
  hunt: '사냥',
  mutant: '변이',
  boss: '보스',
  legend: '전설상자',
  kiosk: '키오스크',
  drone: '드론',
  pvp: 'PvP루팅',
  event: '이벤트',
  unknown: '기타',
};

export const DETAIL_SOURCE_LABELS = {
  box: '상자',
  foodcrate: '음식',
  natural: '자연',
  gather: '채집',
  craft: '제작',
  hunt: '사냥',
  mutant: '변이',
  boss: '보스',
  legend: '전설',
  kiosk: '키오스크',
  drone: '드론',
  pvp: 'PvP',
  event: '이벤트',
  unknown: '기타',
};

const OBJECTIVE_LABELS = {
  natural_core: '코어',
  legendary_crate: '전설상자',
  transcend_crate: '초월상자',
  boss: '보스',
  mutant_wildlife: '변이 야생동물',
  meteor: '운석',
  life_tree: '생명의 나무',
  alpha: '알파',
  omega: '오메가',
  weakline: '위클라인',
  wickeline: '위클라인',
  legendary_material: '전설 재료',
};

export function createRunProgressFallback() {
  return {
    droneCalls: 0,
    kioskGains: 0,
    craftCount: 0,
    totalDeaths: 0,
    totalRevives: 0,
    totalFlees: 0,
    firstLegendAt: null,
    firstTransAt: null,
    latestLegendAt: null,
    latestTransAt: null,
    legendWho: new Set(),
    transWho: new Set(),
    legendCount: 0,
    transCount: 0,
    reviveRate: 0,
    fleeRate: 0,
    legendPace: 'pending',
    transPace: 'pending',
    firstLegendText: '',
    firstTransText: '',
    latestLegendText: '',
    latestTransText: '',
  };
}

export function createRunSupportFallback() {
  return {
    autoUseCount: 0,
    manualUseCount: 0,
    totalHeal: 0,
    totalSatiety: 0,
    skillUseCount: 0,
    tacticalSkillCount: 0,
    weaponSkillCount: 0,
    characterSkillCount: 0,
    appliedEffects: 0,
    immuneEffects: 0,
    resistedEffects: 0,
    topItems: '',
    topEffects: '',
    topTacticalSkills: '',
    topWeaponSkills: '',
    topCharacterSkills: '',
    line: '',
    combatLine: '',
  };
}

export function createRunActionFallback() {
  return {
    queued: 0,
    blocked: 0,
    fleeChosen: 0,
    moveChosen: 0,
    routeFarmChosen: 0,
    craftChosen: 0,
    droneChosen: 0,
    kioskChosen: 0,
    objectiveMoveChosen: 0,
    objectivePressureCount: 0,
    objectivePressureTotal: 0,
    escapeFail: 0,
    escapeNoChase: 0,
    escapedAfterChase: 0,
    caught: 0,
    blinkEscape: 0,
    avgEscape: 0,
    avgChase: 0,
    avgCatch: 0,
    avgPreDamage: 0,
    topBlocked: '',
    topDeferred: '',
    topObjectiveMoves: '',
    line: '',
    chaseLine: '',
    tuningLine: '',
  };
}

export function createObjectiveFallback() {
  return {
    total: 0,
    naturalCore: 0,
    legendaryCrate: 0,
    transcendCrate: 0,
    boss: 0,
    mutantWildlife: 0,
    successCount: 0,
    dangerCount: 0,
    topTypes: '',
    topActors: '',
    topZones: '',
    firstText: '',
    line: '',
    detailLine: '',
  };
}

export function gainEvents(runEvents) {
  return (Array.isArray(runEvents) ? runEvents : []).filter((event) => event && event.kind === 'gain');
}

export function objectiveEvents(runEvents) {
  return (Array.isArray(runEvents) ? runEvents : []).filter((event) => event && event.kind === 'objective');
}

export function positiveQty(event) {
  return Math.max(0, Number(event?.qty ?? 0));
}

export function sourceKey(event) {
  return String(event?.source || 'unknown');
}

export function itemName(itemNameById, id) {
  return itemNameById?.[String(id)] || String(id);
}

export function zoneName(zoneNameById, id) {
  return zoneNameById?.[String(id)] || String(id);
}

export function objectiveLabel(value) {
  const key = String(value || '').trim();
  return OBJECTIVE_LABELS[key] || key;
}

export function topEntries(acc, limit) {
  return Object.entries(acc)
    .filter(([, qty]) => Number(qty) > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

export function stampText(at) {
  if (!at) return '';
  const day = Number(at?.day || 0);
  const phase = String(at?.phase || '-');
  const sec = Math.max(0, Math.floor(Number(at?.sec || 0)));
  const mm = String(Math.floor(sec / 60)).padStart(2, '0');
  const ss = String(sec % 60).padStart(2, '0');
  return `D${day} ${phase} ${mm}:${ss}`;
}
