export const GAME_SLUG = 'racing-logos-demo';
export const QUICK_SAVE_SLOT = 'racing-logos-main';
export const SAVE_VERSION = 'racing-logos-v2';

export const PLACEHOLDER_LOGO_BASE = '/games/racing-logos-demo/logos/_placeholder';

export const CORE_TRACKS = [
  { id: 'trk_tokyo', region: 'japan', surface: 'turf', direction: 'left', distanceM: 2400, logoKey: 'tokyo_racecourse' },
  { id: 'trk_ascot', region: 'europe', surface: 'turf', direction: 'right', distanceM: 2400, logoKey: 'ascot_racecourse' },
  { id: 'trk_churchill', region: 'usa', surface: 'dirt', direction: 'left', distanceM: 2000, logoKey: 'churchill_downs' },
];

export const CORE_EVENTS = [
  { id: 'evt_tokyo_cup', trackId: 'trk_tokyo', region: 'japan', surface: 'turf', direction: 'left', distanceM: 2400 },
  { id: 'evt_ascot_mile', trackId: 'trk_ascot', region: 'europe', surface: 'turf', direction: 'right', distanceM: 1600 },
  { id: 'evt_derby_trial', trackId: 'trk_churchill', region: 'usa', surface: 'dirt', direction: 'left', distanceM: 2000 },
];

export const SEASON_CALENDAR_TEMPLATE = [
  { id: 'spring-derby-trial', week: '3월 2주', tier: 'G3', eventId: 'evt_derby_trial', theme: '더트 개막 예선', purse: 720 },
  { id: 'early-summer-tokyo-cup', week: '5월 4주', tier: 'G2', eventId: 'evt_tokyo_cup', theme: '중거리 클래식', purse: 960 },
  { id: 'summer-ascot-mile', week: '7월 3주', tier: 'G1', eventId: 'evt_ascot_mile', theme: '유럽 마일 챔피언십', purse: 1180 },
  { id: 'autumn-tokyo-repeat', week: '10월 1주', tier: 'G1', eventId: 'evt_tokyo_cup', theme: '가을 왕좌전', purse: 1320 },
];

export const EMPTY_LOCAL_PACK = {
  trackNames: {},
  eventNames: {},
  trackLogoKeyOverrides: {},
};

const REGION_LABELS = {
  japan: 'JP',
  europe: 'EU',
  usa: 'US',
};

const REGION_NAMES = {
  japan: '일본',
  europe: '유럽',
  usa: '미국',
};

const SURFACE_NAMES = {
  turf: '잔디',
  dirt: '더트',
};

const DIRECTION_NAMES = {
  left: '좌회전',
  right: '우회전',
};

export const RACE_ENTRIES = [
  { id: 'aurora', name: 'Aurora Line', surface: 'turf', region: 'japan', stamina: 82, pace: 72 },
  { id: 'bluegate', name: 'Bluegate Run', surface: 'dirt', region: 'usa', stamina: 76, pace: 84 },
  { id: 'crown', name: 'Crown Step', surface: 'turf', region: 'europe', stamina: 88, pace: 68 },
  { id: 'meteor', name: 'Meteor Rail', surface: 'dirt', region: 'japan', stamina: 70, pace: 90 },
  { id: 'silver', name: 'Silver Court', surface: 'turf', region: 'usa', stamina: 80, pace: 77 },
];

export const RACE_PHASES = Object.freeze([
  Object.freeze({ id: 'break', label: '출발', icon: 'race-grid' }),
  Object.freeze({ id: 'positioning', label: '초반 자리싸움', icon: 'race-pace' }),
  Object.freeze({ id: 'backstretch', label: '맞은편 직선', icon: 'race-pace' }),
  Object.freeze({ id: 'third-corner', label: '3코너', icon: 'race-overtake' }),
  Object.freeze({ id: 'final-corner', label: '최종 코너', icon: 'race-final-spurt' }),
  Object.freeze({ id: 'home-stretch', label: '결승 직선', icon: 'race-finish' }),
]);

export const RACE_STRATEGIES = Object.freeze({
  front: Object.freeze({ id: 'front', label: '선행', icon: 'race-strategy-front', staminaCost: 3 }),
  pace: Object.freeze({ id: 'pace', label: '선입', icon: 'race-strategy-pace', staminaCost: 0 }),
  closer: Object.freeze({ id: 'closer', label: '추입', icon: 'race-strategy-closer', staminaCost: -1 }),
});

export function createNewState(options = {}) {
  const now = options.now || new Date().toISOString();
  return {
    runId: options.runId || `racing-${Date.now().toString(36)}`,
    startedAt: now,
    updatedAt: now,
    localPack: { ...EMPTY_LOCAL_PACK },
    filters: {
      region: 'all',
      surface: 'all',
      showDebug: false,
      preferLocalLogos: true,
    },
    raceSession: null,
    auditHistory: [],
    raceCards: [],
    log: ['Racing Logos 데모를 불러왔습니다. 공개 placeholder와 로컬팩 오버레이를 함께 검수할 수 있습니다.'],
  };
}

export function normalizeState(value) {
  const base = createNewState();
  if (!value || typeof value !== 'object') return base;
  return {
    ...base,
    ...value,
    localPack: sanitizeLocalPack(value.localPack),
    filters: value.filters && typeof value.filters === 'object' ? { ...base.filters, ...value.filters } : base.filters,
    raceSession: normalizeRaceSession(value.raceSession),
    auditHistory: Array.isArray(value.auditHistory) ? value.auditHistory.slice(0, 16) : [],
    raceCards: Array.isArray(value.raceCards) ? value.raceCards.slice(0, 12) : [],
    log: Array.isArray(value.log) ? value.log.slice(0, 120) : base.log,
  };
}

export function startRaceSessionAction(state, eventId = '', managedEntryId = '', options = {}) {
  const current = normalizeState(state);
  const events = buildEvents(current);
  const event = events.find((row) => row.id === eventId) || events[0];
  if (!event) return addLog(current, '출발할 레이스 이벤트가 없습니다.');
  const managedEntry = RACE_ENTRIES.find((entry) => entry.id === managedEntryId) || RACE_ENTRIES[0];
  const sequence = Math.max(1, Math.round(Number(current.raceSession?.sequence || 0)) + 1);
  const sessionId = String(options.sessionId || `RACE-${current.runId}-${sequence}`);
  const entries = RACE_ENTRIES.map((entry) => ({
    ...entry,
    gridScore: entry.pace + seededPercent(`${sessionId}:${entry.id}:grid`) / 8,
  }))
    .sort((left, right) => right.gridScore - left.gridScore)
    .map((entry, index) => ({
      ...entry,
      position: index + 1,
      previousPosition: index + 1,
      positionDelta: 0,
      raceScore: 0,
      sectionScore: 0,
      staminaPct: 100,
      gapLengths: 0,
      blockedCount: 0,
      status: 'grid',
    }));
  const raceSession = {
    id: sessionId,
    sequence,
    eventId: event.id,
    raceName: event.raceName,
    trackName: event.trackName,
    region: event.region,
    surface: event.surface,
    surfaceName: event.surfaceName,
    directionName: event.directionName,
    distanceM: Number(event.distanceM || 0),
    status: 'grid',
    segment: 0,
    totalSegments: RACE_PHASES.length,
    phaseId: 'grid',
    phaseLabel: '스타팅 게이트',
    managedEntryId: managedEntry.id,
    strategy: 'pace',
    entries,
    overtakes: 0,
    blockedCount: 0,
    finalSpurtStarted: false,
    resultRecorded: false,
    events: [{
      id: `${sessionId}-grid`,
      segment: 0,
      type: 'grid',
      message: `${event.raceName} 게이트 인 완료 · ${managedEntry.name}은(는) ${entries.find((entry) => entry.id === managedEntry.id)?.position || '-'}번 위치입니다.`,
    }],
  };
  return addLog({
    ...current,
    raceSession,
  }, `${event.raceName} 출발 준비: ${event.distanceM.toLocaleString('ko-KR')}m · 관리 엔트리 ${managedEntry.name}.`);
}

export function setRaceStrategyAction(state, strategyId = 'pace') {
  const current = normalizeState(state);
  const session = current.raceSession;
  const strategy = RACE_STRATEGIES[strategyId] || RACE_STRATEGIES.pace;
  if (!session || session.status === 'finished') return addLog(current, '진행 중인 레이스에서만 작전을 변경할 수 있습니다.');
  if (session.strategy === strategy.id) return current;
  return addLog({
    ...current,
    raceSession: {
      ...session,
      strategy: strategy.id,
      events: prependRaceEvent(session, {
        segment: session.segment,
        type: 'strategy',
        message: `${managedEntryName(session)} 작전을 ${strategy.label}(으)로 변경했습니다.`,
      }),
    },
  }, `${managedEntryName(session)}: ${strategy.label} 작전 적용.`);
}


export function advanceRaceSegmentAction(state) {
  const current = normalizeState(state);
  const session = current.raceSession;
  if (!session) return addLog(current, '먼저 레이스 세션을 시작해 주세요.');
  if (session.status === 'finished') return addLog(current, '이미 결승선을 통과한 레이스입니다.');

  const nextSegment = Math.min(session.totalSegments, session.segment + 1);
  const phase = RACE_PHASES[nextSegment - 1] || RACE_PHASES[RACE_PHASES.length - 1];
  const managedStrategy = RACE_STRATEGIES[session.strategy] || RACE_STRATEGIES.pace;
  const blockedEntry = selectBlockedEntry(session, nextSegment, managedStrategy);
  let segmentOvertakes = 0;
  const segmentEvents = [];
  const scoredEntries = session.entries.map((entry) => {
    const isManaged = entry.id === session.managedEntryId;
    const activeStrategy = isManaged ? managedStrategy : aiRaceStrategy(entry, nextSegment);
    const blocked = blockedEntry?.id === entry.id;
    const staminaCost = raceStaminaCost(entry, activeStrategy, nextSegment, session.surface);
    const staminaPct = Math.max(4, entry.staminaPct - staminaCost);
    const fatiguePenalty = Math.max(0, 44 - staminaPct) * 0.42;
    const strategyBonus = raceStrategyBonus(activeStrategy.id, nextSegment);
    const courseBonus = entry.surface === session.surface ? 7 : -4;
    const regionBonus = entry.region === session.region ? 3 : 0;
    const variation = (seededPercent(`${session.id}:${nextSegment}:${entry.id}:section`) - 50) / 3.8;
    const blockedPenalty = blocked ? 17 : 0;
    const sectionScore = Math.max(12, Math.round((
      42
      + entry.pace * 0.34
      + entry.stamina * 0.16
      + strategyBonus
      + courseBonus
      + regionBonus
      + variation
      - fatiguePenalty
      - blockedPenalty
    ) * 10) / 10);
    if (blocked) {
      segmentEvents.push({
        segment: nextSegment,
        type: 'blocked',
        message: `${entry.name}이(가) ${phase.label}에서 진로가 막혀 추진력을 잃었습니다.`,
      });
    }
    return {
      ...entry,
      previousPosition: entry.position,
      raceScore: entry.raceScore + sectionScore,
      sectionScore,
      staminaPct,
      blockedCount: entry.blockedCount + (blocked ? 1 : 0),
      status: blocked ? 'blocked' : nextSegment >= 5 ? 'spurt' : 'racing',
      activeStrategy: activeStrategy.id,
    };
  });

  const orderedEntries = [...scoredEntries]
    .sort((left, right) => right.raceScore - left.raceScore || right.staminaPct - left.staminaPct)
    .map((entry, index, rows) => {
      const position = index + 1;
      const positionDelta = entry.previousPosition - position;
      if (positionDelta > 0) segmentOvertakes += positionDelta;
      return {
        ...entry,
        position,
        positionDelta,
        gapLengths: index === 0 ? 0 : Math.round(Math.max(0, rows[0].raceScore - entry.raceScore) / 7 * 10) / 10,
      };
    });

  const managed = orderedEntries.find((entry) => entry.id === session.managedEntryId);
  if (managed?.positionDelta > 0) {
    segmentEvents.unshift({
      segment: nextSegment,
      type: 'overtake',
      message: `${managed.name}이(가) ${managed.positionDelta}두를 추월해 ${managed.position}위로 올라섰습니다.`,
    });
  }
  if (nextSegment === session.totalSegments - 1) {
    segmentEvents.unshift({
      segment: nextSegment,
      type: 'final-spurt',
      message: `최종 코너 진입 · ${managed?.name || '-'}이(가) ${managedStrategy.label} 작전으로 마지막 승부를 시작합니다.`,
    });
  }
  if (!segmentEvents.length) {
    segmentEvents.push({
      segment: nextSegment,
      type: 'segment',
      message: `${phase.label} 통과 · ${orderedEntries[0]?.name || '-'} 선두, ${managed?.name || '-'} ${managed?.position || '-'}위.`,
    });
  }

  const finished = nextSegment >= session.totalSegments;
  const nextSession = {
    ...session,
    status: finished ? 'finished' : 'racing',
    segment: nextSegment,
    phaseId: phase.id,
    phaseLabel: phase.label,
    entries: orderedEntries,
    overtakes: session.overtakes + segmentOvertakes,
    blockedCount: session.blockedCount + (blockedEntry ? 1 : 0),
    finalSpurtStarted: session.finalSpurtStarted || nextSegment >= session.totalSegments - 1,
    events: prependRaceEvents(session, segmentEvents),
  };

  if (!finished) {
    return addLog({
      ...current,
      raceSession: nextSession,
    }, `${phase.label} · 선두 ${orderedEntries[0]?.name || '-'} · ${managed?.name || '-'} ${managed?.position || '-'}위 · 체력 ${managed?.staminaPct || 0}%.`);
  }

  const winner = orderedEntries[0];
  const runnerUp = orderedEntries[1];
  const finishedSession = {
    ...nextSession,
    resultRecorded: true,
    events: prependRaceEvent(nextSession, {
      segment: nextSegment,
      type: 'finish',
      message: `결승선 통과 · ${winner?.name || '-'} 우승, ${managed?.name || '-'} ${managed?.position || '-'}위.`,
    }),
  };
  const resultCard = {
    id: `SESSION-${session.id}`,
    createdAt: new Date().toISOString(),
    source: 'race-session',
    results: [{
      eventId: session.eventId,
      raceName: session.raceName,
      trackName: session.trackName,
      region: session.region,
      surface: session.surface,
      distanceM: session.distanceM,
      winner: winner?.name || '-',
      runnerUp: runnerUp?.name || '-',
      rating: Math.max(0, Math.round(Number(winner?.raceScore || 0) / session.totalSegments)),
      managedEntry: managed?.name || '-',
      managedPosition: managed?.position || orderedEntries.length,
      strategy: managedStrategy.label,
      overtakes: finishedSession.overtakes,
      blockedCount: finishedSession.blockedCount,
    }],
  };
  return addLog({
    ...current,
    raceSession: finishedSession,
    raceCards: [resultCard, ...current.raceCards.filter((card) => card.id !== resultCard.id)].slice(0, 12),
  }, `${session.raceName} 종료: ${winner?.name || '-'} 우승 · ${managed?.name || '-'} ${managed?.position || '-'}위.`);
}

export function advanceRaceToFinishAction(state) {
  let next = state;
  for (let index = 0; index < RACE_PHASES.length; index += 1) {
    next = advanceRaceSegmentAction(next);
    if (normalizeState(next).raceSession?.status === 'finished') break;
  }
  return next;
}
export function applyLocalPackAction(state, localPack, source = 'manual') {
  const current = normalizeState(state);
  const nextPack = sanitizeLocalPack(localPack);
  const trackCount = Object.keys(nextPack.trackNames).length;
  const eventCount = Object.keys(nextPack.eventNames).length;
  const overrideCount = Object.keys(nextPack.trackLogoKeyOverrides).length;
  return addLog({
    ...current,
    localPack: nextPack,
  }, `${source === 'fetch' ? 'public/local_pack' : '수동 JSON'} 로컬팩 적용: 트랙명 ${trackCount}, 이벤트명 ${eventCount}, 로고키 ${overrideCount}.`);
}

export function clearLocalPackAction(state) {
  const current = normalizeState(state);
  return addLog({
    ...current,
    localPack: { ...EMPTY_LOCAL_PACK },
  }, '로컬팩 오버레이를 비우고 core 데이터 기준으로 되돌렸습니다.');
}

export function setFilterAction(state, patch) {
  const current = normalizeState(state);
  return {
    ...current,
    updatedAt: new Date().toISOString(),
    filters: { ...current.filters, ...(patch || {}) },
  };
}

export function auditLogoPackAction(state) {
  const current = normalizeState(state);
  const tracks = buildTracks(current);
  const events = buildEvents(current);
  const namedTracks = tracks.filter((track) => track.hasLocalName).length;
  const namedEvents = events.filter((event) => event.hasLocalName).length;
  const overriddenLogos = tracks.filter((track) => track.hasLogoOverride).length;
  const localCandidateCount = tracks.reduce((sum, track) => sum + track.localCandidates.length, 0);
  const placeholderOnly = tracks.filter((track) => !track.hasLogoOverride).length;
  const completeness = Math.round(((namedTracks / tracks.length) + (namedEvents / events.length) + (overriddenLogos / tracks.length)) / 3 * 100);
  const audit = {
    id: `AUD-${Date.now().toString(36)}`,
    createdAt: new Date().toISOString(),
    tracks: tracks.length,
    events: events.length,
    namedTracks,
    namedEvents,
    overriddenLogos,
    localCandidateCount,
    placeholderOnly,
    completeness,
    score: completeness * 12 + namedEvents * 25 + overriddenLogos * 40,
  };
  return addLog({
    ...current,
    auditHistory: [audit, ...current.auditHistory].slice(0, 16),
  }, `로고팩 감사 완료: 완성도 ${completeness}%, placeholder 전용 ${placeholderOnly}개.`);
}

export function generateRaceCardAction(state) {
  const current = normalizeState(state);
  const events = visibleEvents(current);
  if (!events.length) return addLog(current, '현재 필터에 맞는 레이스 이벤트가 없습니다.');
  const card = {
    id: `CARD-${Date.now().toString(36)}`,
    createdAt: new Date().toISOString(),
    results: events.map((event, index) => simulateEvent(event, index + current.raceCards.length)),
  };
  return addLog({
    ...current,
    raceCards: [card, ...current.raceCards].slice(0, 12),
  }, `레이스 카드 ${card.results.length}개 이벤트를 생성했습니다.`);
}

export function generateSeasonCardAction(state) {
  const current = normalizeState(state);
  const rows = seasonCalendarRows(current);
  if (!rows.length) return addLog(current, '시즌 캘린더에 편성된 이벤트가 없습니다.');
  const card = {
    id: `SEASON-${Date.now().toString(36)}`,
    createdAt: new Date().toISOString(),
    season: true,
    results: rows.map((row) => ({
      ...row.preview,
      eventId: row.eventId,
      raceName: row.raceName,
      trackName: row.trackName,
      region: row.region,
      surface: row.surface,
      distanceM: row.distanceM,
      week: row.week,
      tier: row.tier,
      readiness: row.readiness,
    })),
  };
  return addLog({
    ...current,
    raceCards: [card, ...current.raceCards].slice(0, 12),
  }, `시즌 캘린더 카드 ${card.results.length}개 라운드를 생성했습니다.`);
}

export function buildTracks(state) {
  const current = normalizeState(state);
  return CORE_TRACKS.map((track) => {
    const logoKey = current.localPack.trackLogoKeyOverrides[track.id] || track.logoKey;
    return {
      ...track,
      name: current.localPack.trackNames[track.id] || track.id,
      logoKey,
      regionLabel: REGION_LABELS[track.region] || track.region,
      regionName: REGION_NAMES[track.region] || track.region,
      surfaceName: SURFACE_NAMES[track.surface] || track.surface,
      directionName: DIRECTION_NAMES[track.direction] || track.direction,
      hasLocalName: Boolean(current.localPack.trackNames[track.id]),
      hasLogoOverride: Boolean(current.localPack.trackLogoKeyOverrides[track.id]),
      localCandidates: getLocalLogoCandidates(logoKey),
      fallbackLogo: getPlaceholderLogoUrl(track.region),
    };
  });
}

export function buildEvents(state) {
  const current = normalizeState(state);
  const tracksById = new Map(buildTracks(current).map((track) => [track.id, track]));
  return CORE_EVENTS.map((event) => {
    const track = tracksById.get(event.trackId);
    return {
      ...event,
      raceName: current.localPack.eventNames[event.id] || event.id,
      trackName: track?.name || event.trackId,
      trackLogoKey: track?.logoKey || event.trackId,
      regionLabel: REGION_LABELS[event.region] || event.region,
      regionName: REGION_NAMES[event.region] || event.region,
      surfaceName: SURFACE_NAMES[event.surface] || event.surface,
      directionName: DIRECTION_NAMES[event.direction] || event.direction,
      fallbackLogo: getPlaceholderLogoUrl(event.region),
      localCandidates: getLocalLogoCandidates(track?.logoKey || event.trackId),
      hasLocalName: Boolean(current.localPack.eventNames[event.id]),
    };
  });
}

export function localPackMatrix(state) {
  const tracks = buildTracks(state);
  const events = buildEvents(state);
  const trackRows = tracks.map((track) => {
    const missing = [
      track.hasLocalName ? '' : '트랙명',
      track.hasLogoOverride ? '' : '로고키',
    ].filter(Boolean);
    return {
      id: `track-${track.id}`,
      kind: 'track',
      kindLabel: '트랙',
      sourceId: track.id,
      name: track.name,
      requiredKey: `trackNames.${track.id}`,
      logoKeyPath: `trackLogoKeyOverrides.${track.id}`,
      logoKey: track.logoKey,
      candidateText: track.localCandidates.join(' / '),
      hasName: track.hasLocalName,
      hasLogo: track.hasLogoOverride,
      complete: missing.length === 0,
      status: missing.length ? `${missing.join(', ')} 필요` : '완료',
    };
  });
  const eventRows = events.map((event) => ({
    id: `event-${event.id}`,
    kind: 'event',
    kindLabel: '이벤트',
    sourceId: event.id,
    name: event.raceName,
    requiredKey: `eventNames.${event.id}`,
    logoKeyPath: `tracks.${event.trackId}`,
    logoKey: event.trackLogoKey,
    candidateText: event.localCandidates.join(' / '),
    hasName: event.hasLocalName,
    hasLogo: true,
    complete: event.hasLocalName,
    status: event.hasLocalName ? '완료' : '이벤트명 필요',
  }));
  const rows = [...trackRows, ...eventRows];
  return {
    rows,
    totals: {
      rows: rows.length,
      completed: rows.filter((row) => row.complete).length,
      missingNames: rows.filter((row) => !row.hasName).length,
      missingLogoOverrides: trackRows.filter((row) => !row.hasLogo).length,
      localCandidateCount: rows.reduce((sum, row) => sum + (row.candidateText ? row.candidateText.split(' / ').length : 0), 0),
      trackNameCount: trackRows.filter((row) => row.hasName).length,
      eventNameCount: eventRows.filter((row) => row.hasName).length,
      logoOverrideCount: trackRows.filter((row) => row.hasLogo).length,
    },
  };
}

export function seasonCalendarRows(state) {
  const current = normalizeState(state);
  const eventsById = new Map(buildEvents(current).map((event) => [event.id, event]));
  const tracksById = new Map(buildTracks(current).map((track) => [track.id, track]));
  return SEASON_CALENDAR_TEMPLATE.map((slot, index) => {
    const event = eventsById.get(slot.eventId) || null;
    const track = event ? tracksById.get(event.trackId) : null;
    const missing = [
      event?.hasLocalName ? '' : '이벤트명',
      track?.hasLocalName ? '' : '트랙명',
      track?.hasLogoOverride ? '' : '로고키',
    ].filter(Boolean);
    const preview = event ? simulateEvent(event, index + 100) : null;
    const readiness = Math.max(0, Math.round((3 - missing.length) / 3 * 100));
    return {
      ...slot,
      eventId: event?.id || slot.eventId,
      raceName: event?.raceName || slot.eventId,
      trackId: event?.trackId || '',
      trackName: event?.trackName || '-',
      region: event?.region || '',
      regionName: event?.regionName || '',
      surface: event?.surface || '',
      surfaceName: event?.surfaceName || '',
      directionName: event?.directionName || '',
      distanceM: Number(event?.distanceM || 0),
      logoKey: track?.logoKey || event?.trackLogoKey || '',
      fallbackLogo: event?.fallbackLogo || '',
      localCandidates: event?.localCandidates || [],
      missing,
      readiness,
      status: missing.length ? `${missing.join(', ')} 보강 필요` : '편성 가능',
      preview: preview || { winner: '-', runnerUp: '-', rating: 0 },
      projectedInterest: Math.max(40, Math.min(100, Math.round((slot.purse / 18) + readiness * 0.35 + Number(preview?.rating || 0) * 0.12))),
    };
  });
}

export function seasonCalendarReport(state) {
  const rows = seasonCalendarRows(state);
  const readyRows = rows.filter((row) => row.missing.length === 0);
  const regions = Array.from(new Set(rows.map((row) => row.region).filter(Boolean)));
  const surfaces = Array.from(new Set(rows.map((row) => row.surface).filter(Boolean)));
  const averageReadiness = rows.length
    ? Math.round(rows.reduce((sum, row) => sum + row.readiness, 0) / rows.length)
    : 0;
  const projectedInterest = rows.length
    ? Math.round(rows.reduce((sum, row) => sum + row.projectedInterest, 0) / rows.length)
    : 0;
  const missingRows = rows.filter((row) => row.missing.length > 0);
  const recommendations = [
    missingRows.length ? `${missingRows[0].raceName}부터 ${missingRows[0].missing.join(', ')}을 보강하면 캘린더 노출 품질이 가장 빨리 올라갑니다.` : '',
    regions.length < 3 ? '지역 분포가 좁습니다. 공개 후보팩을 확장할 때 지역별 이벤트를 하나씩 더 배치하세요.' : '',
    surfaces.length < 2 ? '주로가 한쪽으로 치우쳤습니다. turf/dirt 이벤트를 모두 포함하면 시즌 카드가 더 다양해집니다.' : '',
    projectedInterest < 70 ? '예상 관심도가 낮습니다. 상금과 대표 이벤트명을 보강해서 시즌 카드의 첫인상을 올리세요.' : '',
  ].filter(Boolean);
  if (!recommendations.length) recommendations.push('시즌 캘린더는 현재 공개용 검수 기준을 충족합니다. 다음 단계는 실제 장기 결과 데이터팩 분리입니다.');
  return {
    rows,
    readyRows: readyRows.length,
    totalRows: rows.length,
    averageReadiness,
    projectedInterest,
    regions,
    surfaces,
    missingRows,
    recommendations,
  };
}

function buildDataPackRow(id, label, value, detail, pct, status = 'ready') {
  return {
    id,
    label,
    value,
    detail,
    pct: Math.round(Math.max(0, Math.min(100, Number(pct || 0)))),
    status,
  };
}

export function dataPackReleaseReportForState(state) {
  const current = normalizeState(state);
  const matrix = localPackMatrix(current);
  const calendar = seasonCalendarReport(current);
  const audit = latestAudit(current);
  const seasonCards = current.raceCards.filter((card) => card.season);
  const eventCards = current.raceCards.filter((card) => !card.season);
  const resultRows = current.raceCards.slice(0, 8).flatMap((card) => (
    (card.results || []).map((result, index) => ({
      id: `${card.id}-${result.eventId}-${index}`,
      cardId: card.id,
      season: Boolean(card.season),
      raceName: result.raceName,
      trackName: result.trackName,
      winner: result.winner,
      runnerUp: result.runnerUp,
      rating: Number(result.rating || 0),
      week: result.week || '',
      surface: result.surface,
      distanceM: Number(result.distanceM || 0),
    }))
  ));
  const avgRating = resultRows.length
    ? Math.round(resultRows.reduce((sum, row) => sum + row.rating, 0) / resultRows.length)
    : 0;
  const releaseScore = Math.round(Math.max(0, Math.min(100,
    audit.completeness * 0.34
      + calendar.averageReadiness * 0.24
      + Math.min(100, seasonCards.length * 34 + eventCards.length * 16) * 0.16
      + Math.min(100, resultRows.length * 7) * 0.14
      + Math.min(100, matrix.totals.localCandidateCount * 4) * 0.12,
  )));
  const packRows = [
    buildDataPackRow(
      'core-pack',
      'core 데이터팩',
      `${CORE_TRACKS.length}T / ${CORE_EVENTS.length}E`,
      '공개 가능한 트랙/이벤트 id, 지역, 주로, 방향, 거리 정보입니다.',
      100,
      'complete',
    ),
    buildDataPackRow(
      'public-placeholder',
      'public placeholder',
      `${audit.placeholderOnly}개 placeholder`,
      '저작권 이슈 없이 배포 가능한 fallback 로고 경로입니다.',
      Math.max(20, 100 - audit.placeholderOnly * 22),
      audit.placeholderOnly ? 'ready' : 'complete',
    ),
    buildDataPackRow(
      'local-pack',
      'private local_pack',
      `${matrix.totals.completed}/${matrix.totals.rows}`,
      '실명, 로고키, 후보 경로를 개인 로컬 데이터팩으로 분리해 검수합니다.',
      matrix.totals.rows ? matrix.totals.completed / matrix.totals.rows * 100 : 0,
      matrix.totals.completed === matrix.totals.rows ? 'complete' : 'ready',
    ),
    buildDataPackRow(
      'season-pack',
      'season calendar',
      `${calendar.readyRows}/${calendar.totalRows}`,
      '시즌 라운드 편성과 예상 관심도, 보강 필요 항목을 분리 관리합니다.',
      calendar.averageReadiness,
      calendar.readyRows === calendar.totalRows ? 'complete' : 'ready',
    ),
  ];
  const modelRows = [
    buildDataPackRow(
      'event-card',
      '이벤트 결과 모델',
      `${eventCards.length}장`,
      '필터된 이벤트를 카드 단위 결과로 생성해 단기 검수에 사용합니다.',
      Math.min(100, eventCards.length * 45),
      eventCards.length ? 'complete' : 'ready',
    ),
    buildDataPackRow(
      'season-card',
      '시즌 결과 모델',
      `${seasonCards.length}장`,
      '시즌 캘린더 전체를 장기 결과 카드로 저장해 장기 레이스 흐름을 분리합니다.',
      Math.min(100, seasonCards.length * 55),
      seasonCards.length ? 'complete' : 'ready',
    ),
    buildDataPackRow(
      'rating-ledger',
      '레이팅 원장',
      resultRows.length ? `${resultRows.length}개 결과` : '결과 없음',
      resultRows.length ? `평균 레이팅 ${avgRating}, winner/runner-up/track/surface/distance가 누적됩니다.` : '이벤트 카드나 시즌 카드를 생성하면 결과 원장이 채워집니다.',
      Math.min(100, resultRows.length * 7),
      resultRows.length ? 'complete' : 'ready',
    ),
  ];
  const recommendations = [];
  if (matrix.totals.completed < matrix.totals.rows) recommendations.push('private local_pack 매트릭스의 누락 이름과 로고키를 먼저 채우세요.');
  if (calendar.readyRows < calendar.totalRows) recommendations.push('시즌 캘린더 보강 필요 라운드를 정리하면 장기 결과 모델 품질이 올라갑니다.');
  if (!seasonCards.length) recommendations.push('시즌 카드 생성을 한 번 실행해 장기 레이스 결과 모델을 검증하세요.');
  if (!eventCards.length) recommendations.push('필터별 이벤트 카드를 만들어 단기 결과 모델도 비교하세요.');
  if (!recommendations.length) recommendations.push('배포용 core/placeholder와 개인용 local_pack, 결과 모델이 분리되어 있습니다. 전적 기록으로 감사 스냅샷을 남기세요.');
  return {
    releaseScore,
    packRows,
    modelRows,
    resultRows,
    seasonCards: seasonCards.length,
    eventCards: eventCards.length,
    avgRating,
    recommendations,
  };
}

export function visibleTracks(state) {
  const current = normalizeState(state);
  return buildTracks(current).filter((track) => matchFilters(track, current.filters));
}

export function visibleEvents(state) {
  const current = normalizeState(state);
  return buildEvents(current).filter((event) => matchFilters(event, current.filters));
}

export function latestAudit(state) {
  const current = normalizeState(state);
  return current.auditHistory[0] || estimateAudit(current);
}

export function scoreState(state) {
  const current = normalizeState(state);
  const audit = latestAudit(current);
  const raceScore = current.raceCards.reduce((sum, card) => sum + card.results.reduce((inner, result) => inner + result.rating, 0), 0);
  const managedEntry = current.raceSession?.entries?.find((entry) => entry.id === current.raceSession?.managedEntryId);
  const sessionScore = current.raceSession
    ? current.raceSession.segment * 25 + Math.max(0, 6 - Number(managedEntry?.position || 6)) * 30
    : 0;
  return Math.max(0, Math.round(audit.score + raceScore + current.raceCards.length * 60 + sessionScore));
}

export function getPlayTimeSec(state) {
  const start = new Date(state.startedAt || '').getTime();
  if (!Number.isFinite(start)) return 0;
  return Math.max(0, Math.floor((Date.now() - start) / 1000));
}

export function summaryForState(state) {
  const current = normalizeState(state);
  const audit = latestAudit(current);
  const matrix = localPackMatrix(current);
  const calendar = seasonCalendarReport(current);
  const dataPack = dataPackReleaseReportForState(current);
  return {
    tracks: CORE_TRACKS.length,
    events: CORE_EVENTS.length,
    completeness: audit.completeness,
    calendarReadiness: calendar.averageReadiness,
    dataPackReleaseScore: dataPack.releaseScore,
    seasonResultCards: dataPack.seasonCards,
    eventResultCards: dataPack.eventCards,
    placeholderOnly: audit.placeholderOnly,
    missingNames: matrix.totals.missingNames,
    missingLogoOverrides: matrix.totals.missingLogoOverrides,
    raceCards: current.raceCards.length,
    raceSessionStatus: current.raceSession?.status || 'not-started',
    raceSessionSegment: current.raceSession?.segment || 0,
    raceSessionTotalSegments: current.raceSession?.totalSegments || RACE_PHASES.length,
    managedEntry: current.raceSession ? managedEntryName(current.raceSession) : '',
    managedPosition: current.raceSession?.entries?.find((entry) => entry.id === current.raceSession?.managedEntryId)?.position || 0,
    completedRaceSessions: current.raceCards.filter((card) => card.source === 'race-session').length,
    raceOvertakes: current.raceSession?.overtakes || 0,
    raceBlockedCount: current.raceSession?.blockedCount || 0,
    score: scoreState(current),
  };
}

export function sampleLocalPackText() {
  return JSON.stringify({
    trackNames: {
      trk_tokyo: 'Tokyo Racecourse',
      trk_ascot: 'Ascot Racecourse',
      trk_churchill: 'Churchill Downs',
    },
    eventNames: {
      evt_tokyo_cup: 'Tokyo Cup',
      evt_ascot_mile: 'Ascot Mile',
      evt_derby_trial: 'Derby Trial',
    },
    trackLogoKeyOverrides: {
      trk_tokyo: 'tokyo_racecourse',
      trk_ascot: 'ascot_racecourse',
      trk_churchill: 'churchill_downs',
    },
  }, null, 2);
}

export function parseLocalPackText(text) {
  if (!String(text || '').trim()) return { ok: true, value: { ...EMPTY_LOCAL_PACK } };
  try {
    return { ok: true, value: sanitizeLocalPack(JSON.parse(text)) };
  } catch (err) {
    return { ok: false, error: err?.message || 'JSON 파싱에 실패했습니다.' };
  }
}

export function getPlaceholderLogoUrl(fallbackKey = 'generic') {
  const key = normalizeKey(fallbackKey) || 'generic';
  return `${PLACEHOLDER_LOGO_BASE}/${key}.svg`;
}

export function getLocalLogoCandidates(logoKey) {
  const key = normalizeKey(logoKey);
  if (!key) return [];
  return [
    `/local_pack/logos/${key}.png`,
    `/local_pack/logos/${key}.webp`,
    `/local_pack/logos/${key}.svg`,
  ];
}

export function normalizeKey(input) {
  return String(input || '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .toLowerCase();
}

function sanitizeLocalPack(value) {
  if (!value || typeof value !== 'object') return { ...EMPTY_LOCAL_PACK };
  return {
    trackNames: sanitizeRecord(value.trackNames),
    eventNames: sanitizeRecord(value.eventNames),
    trackLogoKeyOverrides: sanitizeRecord(value.trackLogoKeyOverrides),
  };
}

function sanitizeRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value)
    .map(([key, entry]) => [String(key || '').trim(), String(entry || '').trim()])
    .filter(([key, entry]) => key && entry));
}

function matchFilters(row, filters) {
  const region = filters?.region || 'all';
  const surface = filters?.surface || 'all';
  return (region === 'all' || row.region === region) && (surface === 'all' || row.surface === surface);
}

function estimateAudit(state) {
  const tracks = buildTracks(state);
  const events = buildEvents(state);
  const namedTracks = tracks.filter((track) => track.hasLocalName).length;
  const namedEvents = events.filter((event) => event.hasLocalName).length;
  const overriddenLogos = tracks.filter((track) => track.hasLogoOverride).length;
  const completeness = Math.round(((namedTracks / tracks.length) + (namedEvents / events.length) + (overriddenLogos / tracks.length)) / 3 * 100);
  return {
    id: 'ESTIMATE',
    createdAt: state.updatedAt,
    tracks: tracks.length,
    events: events.length,
    namedTracks,
    namedEvents,
    overriddenLogos,
    localCandidateCount: tracks.reduce((sum, track) => sum + track.localCandidates.length, 0),
    placeholderOnly: tracks.filter((track) => !track.hasLogoOverride).length,
    completeness,
    score: completeness * 12 + namedEvents * 25 + overriddenLogos * 40,
  };
}


export function formatRaceGap(value) {
  const gap = Math.max(0, Number(value || 0));
  return gap <= 0 ? '선두' : `+${gap.toFixed(1)}마신`;
}

function normalizeRaceSession(value) {
  if (!value || typeof value !== 'object') return null;
  const status = ['grid', 'racing', 'finished'].includes(value.status) ? value.status : 'grid';
  const segment = Math.max(0, Math.min(RACE_PHASES.length, Math.round(Number(value.segment || 0))));
  const sourceEntries = new Map((Array.isArray(value.entries) ? value.entries : []).map((entry) => [entry?.id, entry]));
  const entries = RACE_ENTRIES.map((baseEntry, index) => {
    const entry = sourceEntries.get(baseEntry.id) || {};
    return {
      ...baseEntry,
      position: Math.max(1, Math.round(Number(entry.position || index + 1))),
      previousPosition: Math.max(1, Math.round(Number(entry.previousPosition || entry.position || index + 1))),
      positionDelta: Math.round(Number(entry.positionDelta || 0)),
      gridScore: Number(entry.gridScore || baseEntry.pace),
      raceScore: Math.max(0, Number(entry.raceScore || 0)),
      sectionScore: Math.max(0, Number(entry.sectionScore || 0)),
      staminaPct: Math.max(0, Math.min(100, Number(entry.staminaPct ?? 100))),
      gapLengths: Math.max(0, Number(entry.gapLengths || 0)),
      blockedCount: Math.max(0, Math.round(Number(entry.blockedCount || 0))),
      status: String(entry.status || status),
      activeStrategy: RACE_STRATEGIES[entry.activeStrategy] ? entry.activeStrategy : 'pace',
    };
  }).sort((left, right) => left.position - right.position);
  const managedEntryId = entries.some((entry) => entry.id === value.managedEntryId)
    ? value.managedEntryId
    : entries[0]?.id || RACE_ENTRIES[0].id;
  const phase = segment > 0 ? RACE_PHASES[segment - 1] : null;
  return {
    id: String(value.id || 'RACE-RESTORED'),
    eventId: String(value.eventId || ''),
    sequence: Math.max(1, Math.round(Number(value.sequence || 1))),
    raceName: String(value.raceName || value.eventId || '레이스'),
    trackName: String(value.trackName || '-'),
    region: String(value.region || ''),
    surface: String(value.surface || 'turf'),
    surfaceName: String(value.surfaceName || SURFACE_NAMES[value.surface] || value.surface || '잔디'),
    directionName: String(value.directionName || ''),
    distanceM: Math.max(0, Number(value.distanceM || 0)),
    status,
    segment,
    totalSegments: RACE_PHASES.length,
    phaseId: String(value.phaseId || phase?.id || 'grid'),
    phaseLabel: String(value.phaseLabel || phase?.label || '스타팅 게이트'),
    managedEntryId,
    strategy: RACE_STRATEGIES[value.strategy] ? value.strategy : 'pace',
    entries,
    overtakes: Math.max(0, Math.round(Number(value.overtakes || 0))),
    blockedCount: Math.max(0, Math.round(Number(value.blockedCount || 0))),
    finalSpurtStarted: Boolean(value.finalSpurtStarted),
    resultRecorded: Boolean(value.resultRecorded),
    events: (Array.isArray(value.events) ? value.events : []).slice(0, 40).map((event, index) => ({
      id: String(event?.id || `${value.id || 'RACE'}-${index}`),
      segment: Math.max(0, Math.round(Number(event?.segment || 0))),
      type: String(event?.type || 'segment'),
      message: String(event?.message || ''),
    })).filter((event) => event.message),
  };
}

function managedEntryName(session) {
  return session?.entries?.find((entry) => entry.id === session.managedEntryId)?.name || '관리 엔트리';
}

function prependRaceEvent(session, event) {
  return prependRaceEvents(session, [event]);
}

function prependRaceEvents(session, events) {
  const previousEvents = Array.isArray(session?.events) ? session.events : [];
  const nextEvents = events.map((event, index) => ({
    ...event,
    id: event.id || `${session?.id || 'RACE'}-${event.segment || 0}-${event.type || 'segment'}-${previousEvents.length + index}`,
  }));
  return [...nextEvents, ...previousEvents].slice(0, 40);
}

function aiRaceStrategy(entry, segment) {
  const preferred = {
    aurora: 'pace',
    bluegate: 'front',
    crown: 'closer',
    meteor: 'front',
    silver: 'pace',
  }[entry.id] || 'pace';
  if (segment >= 5 && entry.stamina >= 82) return RACE_STRATEGIES.closer;
  return RACE_STRATEGIES[preferred];
}

function raceStaminaCost(entry, strategy, segment, surface) {
  const courseCost = entry.surface === surface ? 0 : 2;
  const paceCost = entry.pace >= 84 ? 1 : 0;
  const closingCost = segment >= 5 ? 2 : 0;
  return Math.max(4, 8 + strategy.staminaCost + courseCost + paceCost + closingCost);
}

function raceStrategyBonus(strategyId, segment) {
  if (strategyId === 'front') {
    if (segment <= 2) return 11;
    if (segment <= 4) return 3;
    return -7;
  }
  if (strategyId === 'closer') {
    if (segment <= 2) return -7;
    if (segment <= 4) return 2;
    return 13;
  }
  return segment >= 2 && segment <= 5 ? 5 : 1;
}

function selectBlockedEntry(session, segment, managedStrategy) {
  const threshold = segment === 1 || segment >= 5 ? 9 : 15;
  const candidates = session.entries.map((entry) => {
    const strategy = entry.id === session.managedEntryId ? managedStrategy : aiRaceStrategy(entry, segment);
    const crowdingRisk = strategy.id === 'closer' && segment <= 3 ? 4 : strategy.id === 'front' && segment === 1 ? 2 : 0;
    return {
      entry,
      roll: seededPercent(`${session.id}:${segment}:${entry.id}:blocked`),
      threshold: threshold + crowdingRisk,
    };
  }).sort((left, right) => left.roll - right.roll);
  return candidates[0] && candidates[0].roll < candidates[0].threshold ? candidates[0].entry : null;
}

function seededPercent(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0) % 101;
}
function simulateEvent(event, salt) {
  const rows = RACE_ENTRIES.map((entry) => {
    const surfaceBonus = entry.surface === event.surface ? 12 : -5;
    const regionBonus = entry.region === event.region ? 8 : 0;
    const distanceBias = Math.max(-12, Math.min(12, Math.round((2400 - event.distanceM) / 100)));
    const rating = entry.stamina + entry.pace + surfaceBonus + regionBonus + distanceBias + seededRoll(`${event.id}:${entry.id}:${salt}`);
    return {
      ...entry,
      rating,
    };
  }).sort((a, b) => b.rating - a.rating);
  return {
    eventId: event.id,
    raceName: event.raceName,
    trackName: event.trackName,
    region: event.region,
    surface: event.surface,
    distanceM: event.distanceM,
    winner: rows[0].name,
    runnerUp: rows[1].name,
    rating: rows[0].rating,
  };
}

function seededRoll(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  return Math.abs(hash % 21);
}

function addLog(state, message) {
  return {
    ...state,
    updatedAt: new Date().toISOString(),
    log: [message, ...state.log].slice(0, 120),
  };
}
