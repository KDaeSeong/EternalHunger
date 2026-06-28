const EMPTY_PHASE_COUNTS = {
  opening: 0,
  early: 0,
  mid: 0,
  end: 0,
  unknown: 0,
};

const DEFAULT_THRESHOLDS = {
  minMidDeathShare: 0.32,
  maxEndDeathShare: 0.55,
  minPvpDeathShare: 0.45,
  minCaughtShare: 0.22,
  minHeroGearReadyShare: 0.70,
};

function cleanStr(value) {
  return String(value || '').trim();
}

function asList(value) {
  return Array.isArray(value) ? value : [];
}

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function eventAt(event) {
  const at = event?.at && typeof event.at === 'object' ? event.at : event;
  return {
    day: Math.max(0, Math.floor(num(at?.day, 0))),
    phase: cleanStr(at?.phase || at?.timeOfDay || ''),
    sec: Math.max(0, Math.floor(num(at?.sec, 0))),
  };
}

function phaseBand(event) {
  const at = eventAt(event);
  const phase = at.phase === 'night' ? 'night' : 'morning';
  if (!at.day) return 'unknown';
  if (at.day === 1) return 'opening';
  if (at.day === 2 && phase === 'morning') return 'early';
  if (at.day < 6) return 'mid';
  return 'end';
}

function inc(target, key, amount = 1) {
  const k = cleanStr(key) || 'unknown';
  target[k] = num(target[k], 0) + amount;
}

function eventKind(event) {
  return cleanStr(event?.kind || event?.type || '');
}

function eventActorId(event) {
  return cleanStr(event?.who || event?.whoId || event?.actorId || event?.characterId || '');
}

function dedupeActors(survivors, dead) {
  const out = [];
  const seen = new Set();
  for (const actor of [...asList(survivors), ...asList(dead)]) {
    if (!actor || typeof actor !== 'object') continue;
    const key = cleanStr(actor._id || actor.id || actor.name || `idx:${out.length}`);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(actor);
  }
  return out;
}

function equippedItems(actor) {
  const eq = actor?.equipped;
  if (Array.isArray(eq)) return eq.filter(Boolean);
  if (eq && typeof eq === 'object') return Object.values(eq).filter(Boolean);
  return [];
}

function itemTier(item, itemMetaById) {
  const id = cleanStr(item?._id || item?.itemId || item?.id || item?.externalId || '');
  const meta = id ? itemMetaById?.[id] : null;
  return Math.max(0, Math.floor(num(item?.tier ?? item?.craftedTier ?? meta?.tier, 0)));
}

function buildEquipmentSummary(actors, itemMetaById) {
  const tierCounts = { t1: 0, t2: 0, t3: 0, t4: 0, t5: 0, t6: 0, unknown: 0 };
  let heroGearReadyCount = 0;
  let legendaryReadyCount = 0;
  let totalEquipped = 0;

  const actorsSummary = actors.map((actor) => {
    const items = equippedItems(actor);
    let heroOrBetter = 0;
    let legendOrBetter = 0;
    let bestTier = 0;
    for (const item of items) {
      const tier = itemTier(item, itemMetaById);
      bestTier = Math.max(bestTier, tier);
      totalEquipped += 1;
      if (tier >= 1 && tier <= 6) tierCounts[`t${tier}`] += 1;
      else tierCounts.unknown += 1;
      if (tier >= 4) heroOrBetter += 1;
      if (tier >= 5) legendOrBetter += 1;
    }
    if (heroOrBetter >= 5) heroGearReadyCount += 1;
    if (legendOrBetter >= 3) legendaryReadyCount += 1;
    return {
      id: cleanStr(actor?._id || actor?.id || ''),
      name: cleanStr(actor?.name || ''),
      equippedCount: items.length,
      heroOrBetter,
      legendOrBetter,
      bestTier,
    };
  });

  return {
    totalEquipped,
    tierCounts,
    heroGearReadyCount,
    legendaryReadyCount,
    actors: actorsSummary,
  };
}

function buildRecommendations(metrics, thresholds) {
  const notes = [];
  const deathTotal = Math.max(1, metrics.deaths.total);
  const midShare = metrics.deaths.byBand.mid / deathTotal;
  const endShare = metrics.deaths.byBand.end / deathTotal;
  const pvpShare = metrics.deaths.pvp / deathTotal;
  const caughtShare = metrics.chase.total ? metrics.chase.caught / metrics.chase.total : 0;
  const actorTotal = Math.max(1, metrics.participants.total);
  const heroReadyShare = metrics.equipment.heroGearReadyCount / actorTotal;

  if (metrics.deaths.total > 0 && midShare < thresholds.minMidDeathShare) {
    notes.push('중반 사망 비율이 낮습니다. 2일차 밤~5일차 밤의 교전 발생률과 도주 회피율을 우선 조정하세요.');
  }
  if (metrics.deaths.total > 0 && endShare > thresholds.maxEndDeathShare) {
    notes.push('사망이 후반에 몰립니다. 서든데스 직접 조정보다 중반 오브젝트/차원의 틈 교전 압박을 높이는 편이 안전합니다.');
  }
  if (metrics.deaths.total > 0 && pvpShare < thresholds.minPvpDeathShare) {
    notes.push('전투 사망 비율이 낮습니다. 야생동물/금지구역 사망보다 PvP 결정력이 낮은지 확인하세요.');
  }
  if (metrics.chase.total >= 5 && caughtShare < thresholds.minCaughtShare) {
    notes.push('추격 성공률이 낮습니다. 도주 성공 보정 또는 저체력 교전 회피 보정을 낮출 필요가 있습니다.');
  }
  if (actorTotal >= 8 && heroReadyShare < thresholds.minHeroGearReadyShare) {
    notes.push('영웅 장비 5부위 완성률이 낮습니다. 1일차 낮 루트 파밍과 필드 상자 fallback을 점검하세요.');
  }
  if (!notes.length) notes.push('핵심 진단 지표가 권장 범위 안에 있습니다. 다음 변경은 seed별 편차를 비교하면서 진행하세요.');
  return notes;
}

export function getEmptySimulationDiagnostics() {
  return {
    participants: { alive: 0, dead: 0, total: 0 },
    events: { total: 0, byKind: {} },
    deaths: { total: 0, pvp: 0, nonPvp: 0, byBand: { ...EMPTY_PHASE_COUNTS } },
    chase: { total: 0, caught: 0, escaped: 0, blinkEscape: 0 },
    objectives: { total: 0, byObjective: {} },
    equipment: buildEquipmentSummary([], {}),
    recommendations: [],
  };
}

export function buildSimulationDiagnostics({
  runEvents,
  survivors,
  dead,
  itemMetaById,
  ruleset,
} = {}) {
  const events = asList(runEvents);
  const aliveList = asList(survivors);
  const deadList = asList(dead);
  const actors = dedupeActors(aliveList, deadList);
  const thresholds = {
    ...DEFAULT_THRESHOLDS,
    ...(ruleset?.diagnostics?.thresholds || {}),
  };

  const metrics = getEmptySimulationDiagnostics();
  metrics.participants = {
    alive: aliveList.length,
    dead: deadList.length,
    total: actors.length,
  };
  metrics.events.total = events.length;

  for (const event of events) {
    const kind = eventKind(event);
    if (kind) inc(metrics.events.byKind, kind);

    if (kind === 'death') {
      metrics.deaths.total += 1;
      inc(metrics.deaths.byBand, phaseBand(event));
      if (cleanStr(event?.by)) metrics.deaths.pvp += 1;
      else metrics.deaths.nonPvp += 1;
    }

    if (kind === 'chase') {
      metrics.chase.total += 1;
      if (event?.caught || event?.outcome === 'caught') metrics.chase.caught += 1;
      if (event?.escaped || String(event?.outcome || '').includes('escape')) metrics.chase.escaped += 1;
      if (event?.outcome === 'blink_escape') metrics.chase.blinkEscape += 1;
    }

    if (kind === 'objective') {
      metrics.objectives.total += 1;
      inc(metrics.objectives.byObjective, event?.objective || event?.target || event?.subkind || 'unknown');
    }
  }

  metrics.equipment = buildEquipmentSummary(actors, itemMetaById || {});
  metrics.recommendations = buildRecommendations(metrics, thresholds);
  return metrics;
}

export function formatDiagnosticsLine(metrics) {
  const m = metrics || getEmptySimulationDiagnostics();
  const d = m.deaths || {};
  const b = d.byBand || EMPTY_PHASE_COUNTS;
  return [
    `사망 ${d.total || 0}명`,
    `중반 ${b.mid || 0}명`,
    `후반 ${b.end || 0}명`,
    `PvP ${d.pvp || 0}명`,
    `영웅5부위 ${m.equipment?.heroGearReadyCount || 0}/${m.participants?.total || 0}`,
  ].join(' · ');
}

