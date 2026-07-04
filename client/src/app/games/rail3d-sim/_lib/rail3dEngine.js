import sampleService from '../_data/sampleService.json';
import sampleSegments from '../_data/sampleSegments.json';
import sampleTrack from '../_data/sampleTrack.json';

export const GAME_SLUG = 'rail3d-sim';
export const QUICK_SAVE_SLOT = 'rail3d-sim-main';
export const SAVE_VERSION = 'rail3d-sim-v1';

export const TRACK = sampleTrack;
export const SERVICE = sampleService;
export const SEGMENTS = sampleSegments.segments || [];

const DEFAULT_STEP_SECONDS = 30;

export function createNewState(options = {}) {
  const now = options.now || new Date().toISOString();
  const servicesById = servicesMap();
  const trains = SERVICE.trains.map((trainDef) => {
    const service = servicesById[trainDef.serviceId];
    const firstStop = service?.stops?.[0] || null;
    const firstPoint = firstStop ? getStopPoint(firstStop.stationId) : null;
    return {
      id: trainDef.id,
      serviceId: trainDef.serviceId,
      phase: 'DWELL',
      stopIndex: 0,
      nextStopIndex: 1,
      pose: firstPoint ? { ...firstPoint, dir: trainDef.spawn.dir || 1 } : { edgeId: trainDef.spawn.edgeId, headS: trainDef.spawn.headS, dir: trainDef.spawn.dir || 1 },
      speedKmh: 0,
      signalState: 'GO',
      blockedBy: null,
      waitSeconds: 0,
      actualArriveS: firstStop ? { 0: firstStop.arriveS } : {},
      actualDepartS: {},
    };
  });
  const state = {
    runId: options.runId || `rail-${Date.now().toString(36)}`,
    startedAt: now,
    updatedAt: now,
    nowS: 0,
    stepSeconds: DEFAULT_STEP_SECONDS,
    lookaheadBlocks: 1,
    trains,
    blocks: buildBlocks(),
    segmentTokens: buildSegmentTokens(trains),
    log: ['Rail3D MVP 노선 시뮬레이션을 시작했습니다. Step으로 시간표와 블록 점유를 확인하세요.'],
  };
  return refreshBlocks(state);
}

export function normalizeState(value) {
  const base = createNewState();
  if (!value || typeof value !== 'object') return base;
  return refreshBlocks({
    ...base,
    ...value,
    trains: Array.isArray(value.trains) && value.trains.length ? value.trains : base.trains,
    blocks: Array.isArray(value.blocks) && value.blocks.length ? value.blocks : base.blocks,
    segmentTokens: Array.isArray(value.segmentTokens) ? value.segmentTokens : base.segmentTokens,
    log: Array.isArray(value.log) ? value.log.slice(0, 120) : base.log,
  });
}

export function stepAction(state, seconds = null) {
  let current = normalizeState(state);
  const dt = Number(seconds || current.stepSeconds || DEFAULT_STEP_SECONDS);
  const nextNow = Number(current.nowS || 0) + dt;
  const occupied = new Map();
  const segmentOwners = buildSegmentOwnerMap(current.trains);
  const nextTrains = current.trains.map((train) => {
    const advanced = advanceTrain(current, train, nextNow, dt, occupied, segmentOwners);
    const key = blockKey(advanced.pose.edgeId, advanced.pose.headS);
    if (key && advanced.phase !== 'DONE') occupied.set(key, advanced.id);
    return advanced;
  });
  current = refreshBlocks({
    ...current,
    nowS: nextNow,
    trains: nextTrains,
  });
  const stopped = nextTrains.filter((train) => train.signalState === 'STOP').length;
  const done = nextTrains.filter((train) => train.phase === 'DONE').length;
  return addLog(current, `${formatTime(nextNow)} 진행. STOP ${stopped}편, 종착 ${done}/${nextTrains.length}편.`);
}

export function runForAction(state, seconds = 300) {
  let current = normalizeState(state);
  const step = Math.max(5, Number(current.stepSeconds || DEFAULT_STEP_SECONDS));
  const count = Math.max(1, Math.ceil(Number(seconds || 0) / step));
  for (let i = 0; i < count; i += 1) current = stepAction(current, step);
  return current;
}

export function setStepSecondsAction(state, seconds) {
  const current = normalizeState(state);
  return {
    ...current,
    updatedAt: new Date().toISOString(),
    stepSeconds: Math.max(5, Math.min(300, Math.round(Number(seconds || DEFAULT_STEP_SECONDS)))),
  };
}

export function setLookaheadBlocksAction(state, blocks) {
  const current = normalizeState(state);
  return addLog({
    ...current,
    lookaheadBlocks: Math.max(0, Math.min(3, Math.round(Number(blocks || 0)))),
  }, `신호 예약 lookahead를 ${Math.max(0, Math.min(3, Math.round(Number(blocks || 0))))}블록으로 조정했습니다.`);
}

export function trainRows(state) {
  const current = normalizeState(state);
  const servicesById = servicesMap();
  return current.trains.map((train) => {
    const service = servicesById[train.serviceId];
    const nextStop = service?.stops?.[train.nextStopIndex] || service?.stops?.[train.stopIndex] || null;
    const nextStation = nextStop ? stationName(nextStop.stationId) : '종착';
    const lastArrivalDelay = Object.entries(train.actualArriveS || {})
      .map(([index, actual]) => Number(actual) - Number(service?.stops?.[Number(index)]?.arriveS || 0))
      .filter((delay) => Number.isFinite(delay))
      .pop() || 0;
    return {
      id: train.id,
      serviceName: service?.name || train.serviceId,
      phase: train.phase,
      signalState: train.signalState,
      blockedBy: train.blockedBy,
      stopReason: train.stopReason || null,
      tokenWait: train.tokenWait || null,
      segmentId: segmentIdForPose(train.pose),
      nextStation,
      edgeId: train.pose.edgeId,
      headS: Math.round(train.pose.headS),
      speedKmh: Math.round(train.speedKmh),
      waitSeconds: Math.round(train.waitSeconds || 0),
      lastArrivalDelay,
    };
  });
}

export function blockSummary(state) {
  const current = normalizeState(state);
  return current.blocks.reduce((summary, block) => {
    summary.total += 1;
    summary[block.state] = (summary[block.state] || 0) + 1;
    return summary;
  }, { total: 0, FREE: 0, OCCUPIED: 0, RESERVED: 0 });
}

export function segmentSummary(state) {
  const current = normalizeState(state);
  const owners = buildSegmentOwnerMap(current.trains);
  return SEGMENTS.map((segment) => ({
    id: segment.id,
    edgeIds: segment.edgeIds || [],
    entryStations: segment.entryStations || [],
    owner: owners.get(segment.id) || null,
    waiting: current.trains
      .filter((train) => train.stopReason?.kind === 'TOKEN_WAIT' && train.tokenWait === segment.id)
      .map((train) => train.id),
  }));
}

export function mapViewState(state) {
  const current = normalizeState(state);
  return {
    nodes: TRACK.nodes,
    edges: TRACK.edges,
    stations: TRACK.stations,
    blocks: current.blocks,
    segments: segmentSummary(current),
    trains: current.trains.map((train) => ({
      ...train,
      point: pointOnEdge(train.pose.edgeId, train.pose.headS),
    })),
  };
}

export function scoreState(state) {
  const current = normalizeState(state);
  const rows = trainRows(current);
  const arrivedStops = current.trains.reduce((sum, train) => sum + Object.keys(train.actualArriveS || {}).length, 0);
  const totalDelay = rows.reduce((sum, row) => sum + Math.max(0, Number(row.lastArrivalDelay || 0)), 0);
  const totalWait = rows.reduce((sum, row) => sum + Number(row.waitSeconds || 0), 0);
  const tokenWait = rows.filter((row) => row.stopReason?.kind === 'TOKEN_WAIT').length;
  const completed = rows.filter((row) => row.phase === 'DONE').length;
  return Math.max(0, Math.round(arrivedStops * 180 + completed * 600 - totalDelay * 4 - totalWait * 0.5 - tokenWait * 120));
}

export function getPlayTimeSec(state) {
  const start = new Date(state.startedAt || '').getTime();
  if (!Number.isFinite(start)) return 0;
  return Math.max(0, Math.floor((Date.now() - start) / 1000));
}

export function summaryForState(state) {
  const current = normalizeState(state);
  const rows = trainRows(current);
  return {
    nowS: current.nowS,
    time: formatTime(current.nowS),
    trains: rows.length,
    completed: rows.filter((row) => row.phase === 'DONE').length,
    stopped: rows.filter((row) => row.signalState === 'STOP').length,
    tokenWaits: rows.filter((row) => row.stopReason?.kind === 'TOKEN_WAIT').length,
    waitSeconds: rows.reduce((sum, row) => sum + row.waitSeconds, 0),
    score: scoreState(current),
  };
}

export function scheduleReport(state) {
  const current = normalizeState(state);
  const servicesById = servicesMap();
  const trains = current.trains.map((train) => {
    const service = servicesById[train.serviceId] || { id: train.serviceId, name: train.serviceId, stops: [] };
    const stops = (service.stops || []).map((stop, index) => {
      const actualArrive = train.actualArriveS?.[index];
      const actualDepart = train.actualDepartS?.[index];
      const hasArrived = Number.isFinite(Number(actualArrive));
      const hasDeparted = Number.isFinite(Number(actualDepart));
      let status = '대기';
      if (hasDeparted) status = '출발';
      else if (hasArrived || train.stopIndex === index) status = train.phase === 'DWELL' ? '정차' : '도착';
      else if (train.nextStopIndex === index && train.phase === 'RUNNING') status = '접근';
      if (train.phase === 'DONE' && index === (service.stops || []).length - 1) status = '종착';
      return {
        index,
        stationId: stop.stationId,
        stationName: stationName(stop.stationId),
        status,
        scheduledArriveS: Number(stop.arriveS || 0),
        scheduledDepartS: Number(stop.departS || stop.arriveS || 0),
        actualArriveS: hasArrived ? Number(actualArrive) : null,
        actualDepartS: hasDeparted ? Number(actualDepart) : null,
        arriveDelayS: hasArrived ? Number(actualArrive) - Number(stop.arriveS || 0) : null,
        departDelayS: hasDeparted ? Number(actualDepart) - Number(stop.departS || stop.arriveS || 0) : null,
      };
    });
    const arrived = stops.filter((stop) => stop.actualArriveS !== null).length;
    const positiveDelayS = stops.reduce((sum, stop) => sum + Math.max(0, Number(stop.arriveDelayS || 0)), 0);
    const maxDelayS = stops.reduce((max, stop) => Math.max(max, Math.max(0, Number(stop.arriveDelayS || 0))), 0);
    const nextStop = stops[train.nextStopIndex] || stops[train.stopIndex] || null;
    return {
      id: train.id,
      serviceId: service.id,
      serviceName: service.name || service.id,
      phase: train.phase,
      signalState: train.signalState,
      stopReason: train.stopReason || null,
      blockedBy: train.blockedBy || null,
      tokenWait: train.tokenWait || null,
      waitSeconds: Math.round(Number(train.waitSeconds || 0)),
      arrived,
      totalStops: stops.length,
      remaining: Math.max(0, stops.length - arrived),
      nextStation: nextStop?.stationName || '종착',
      positiveDelayS: Math.round(positiveDelayS),
      maxDelayS: Math.round(maxDelayS),
      stops,
    };
  });
  const totals = {
    trains: trains.length,
    completed: trains.filter((train) => train.phase === 'DONE').length,
    stopped: trains.filter((train) => train.signalState === 'STOP').length,
    tokenWaits: trains.filter((train) => train.stopReason?.kind === 'TOKEN_WAIT').length,
    totalWaitS: trains.reduce((sum, train) => sum + train.waitSeconds, 0),
    totalDelayS: trains.reduce((sum, train) => sum + train.positiveDelayS, 0),
    maxDelayS: trains.reduce((max, train) => Math.max(max, train.maxDelayS), 0),
    arrivedStops: trains.reduce((sum, train) => sum + train.arrived, 0),
    totalStops: trains.reduce((sum, train) => sum + train.totalStops, 0),
  };
  const recommendations = [];
  if (totals.tokenWaits) recommendations.push('단선 구간 토큰 대기가 발생했습니다. 출발 간격이나 lookahead 블록을 조정해 보세요.');
  if (totals.stopped && !totals.tokenWaits) recommendations.push('블록 점유 때문에 정지 중인 열차가 있습니다. 예약 블록 수를 줄이면 흐름이 개선될 수 있습니다.');
  if (totals.totalDelayS > 120) recommendations.push('누적 지연이 큽니다. 정차 시간이 짧은 역과 병목 구간을 우선 확인하세요.');
  if (!recommendations.length) recommendations.push('현재 운행은 시간표 기준으로 안정권입니다.');
  return { trains, totals, recommendations };
}

export function formatTime(totalSeconds) {
  const safe = Math.max(0, Math.round(Number(totalSeconds || 0)));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function advanceTrain(state, train, nowS, dt, occupied, segmentOwners) {
  const service = servicesMap()[train.serviceId];
  if (!service) return train;
  const stops = service.stops || [];
  if (!stops.length || train.phase === 'DONE') return train;
  let next = {
    ...train,
    blockedBy: null,
    signalState: 'GO',
    stopReason: null,
    tokenWait: null,
  };
  const currentStop = stops[next.stopIndex];
  const targetStop = stops[next.nextStopIndex];
  if (!targetStop) {
    if (nowS >= Number(currentStop?.departS || currentStop?.arriveS || 0)) {
      next.phase = 'DONE';
      next.speedKmh = 0;
    }
    return next;
  }

  if (next.phase === 'DWELL') {
    next.speedKmh = 0;
    const departS = Number(currentStop.departS || currentStop.arriveS || 0);
    if (nowS < departS) return next;
    next.phase = 'RUNNING';
    next.actualDepartS = { ...(next.actualDepartS || {}), [next.stopIndex]: departS };
  }

  const departS = Number(currentStop.departS || currentStop.arriveS || 0);
  const arriveS = Number(targetStop.arriveS || departS + 1);
  const progress = Math.max(0, Math.min(1, (nowS - departS) / Math.max(1, arriveS - departS)));
  const fromPoint = getStopPoint(currentStop.stationId);
  const toPoint = getStopPoint(targetStop.stationId);
  const desiredPose = interpolateStopPoints(fromPoint, toPoint, progress);
  const currentSegmentId = segmentIdForPose(next.pose);
  const desiredSegmentId = segmentIdForPose(desiredPose);
  if (currentSegmentId && currentSegmentId !== desiredSegmentId && segmentOwners.get(currentSegmentId) === next.id) {
    segmentOwners.delete(currentSegmentId);
  }
  if (desiredSegmentId) {
    const segmentOwner = segmentOwners.get(desiredSegmentId);
    if (segmentOwner && segmentOwner !== next.id) {
      return {
        ...next,
        signalState: 'STOP',
        blockedBy: segmentOwner,
        stopReason: { kind: 'TOKEN_WAIT', blockedBy: segmentOwner, segmentId: desiredSegmentId },
        tokenWait: desiredSegmentId,
        speedKmh: 0,
        waitSeconds: Number(next.waitSeconds || 0) + dt,
      };
    }
    segmentOwners.set(desiredSegmentId, next.id);
  }
  const key = blockKey(desiredPose.edgeId, desiredPose.headS);
  const blocker = key ? findBlocker(key, occupied, Number(state.lookaheadBlocks || 0)) : null;
  if (blocker && blocker !== next.id) {
    return {
      ...next,
      signalState: 'STOP',
      blockedBy: blocker,
      stopReason: { kind: 'BLOCKED', blockedBy: blocker, segmentId: desiredSegmentId },
      speedKmh: 0,
      waitSeconds: Number(next.waitSeconds || 0) + dt,
    };
  }

  next.pose = desiredPose;
  next.speedKmh = Math.round(Math.min(
    distanceBetweenStops(fromPoint, toPoint) / Math.max(1, arriveS - departS) * 3.6,
    speedLimitForEdge(desiredPose.edgeId),
  ));
  if (progress >= 1) {
    next.phase = 'DWELL';
    next.speedKmh = 0;
    next.pose = { ...toPoint, dir: desiredPose.dir };
    next.actualArriveS = { ...(next.actualArriveS || {}), [next.nextStopIndex]: nowS };
    next.stopIndex = next.nextStopIndex;
    next.nextStopIndex += 1;
    if (next.nextStopIndex >= stops.length && nowS >= Number(targetStop.departS || targetStop.arriveS || 0)) {
      next.phase = 'DONE';
    }
  }
  return next;
}

function refreshBlocks(state) {
  const blocks = buildBlocks();
  const occupied = new Set();
  const reserved = new Map();
  state.trains.forEach((train) => {
    if (train.phase === 'DONE') return;
    const key = blockKey(train.pose.edgeId, train.pose.headS);
    if (!key) return;
    occupied.add(key);
    const parsed = parseBlockKey(key);
    for (let offset = 1; offset <= Number(state.lookaheadBlocks || 0); offset += 1) {
      const reserveId = `${parsed.edgeId}:${parsed.index + offset * (train.pose.dir === -1 ? -1 : 1)}`;
      if (!occupied.has(reserveId)) reserved.set(reserveId, train.id);
    }
  });
  const nextBlocks = blocks.map((block) => {
    if (occupied.has(block.id)) {
      const owner = state.trains.find((train) => blockKey(train.pose.edgeId, train.pose.headS) === block.id)?.id || null;
      return { ...block, state: 'OCCUPIED', owner };
    }
    if (reserved.has(block.id)) return { ...block, state: 'RESERVED', owner: reserved.get(block.id) };
    return block;
  });
  return {
    ...state,
    blocks: nextBlocks,
    segmentTokens: buildSegmentTokens(state.trains),
  };
}

function buildSegmentTokens(trains) {
  const owners = buildSegmentOwnerMap(trains);
  return SEGMENTS.map((segment) => ({
    segmentId: segment.id,
    owner: owners.get(segment.id) || null,
  }));
}

function buildSegmentOwnerMap(trains) {
  const owners = new Map();
  (trains || []).forEach((train) => {
    if (!train || train.phase === 'DONE') return;
    const segmentId = segmentIdForPose(train.pose);
    if (segmentId && !owners.has(segmentId)) owners.set(segmentId, train.id);
  });
  return owners;
}

function segmentIdForPose(pose) {
  if (!pose?.edgeId) return '';
  const segment = SEGMENTS.find((item) => Array.isArray(item.edgeIds) && item.edgeIds.includes(pose.edgeId));
  return segment?.id || '';
}

function buildBlocks() {
  const blockLength = Math.max(1, Number(TRACK.blockLengthM || 50));
  return TRACK.edges.flatMap((edge) => {
    const count = Math.max(1, Math.ceil(Number(edge.lengthM || 0) / blockLength));
    return Array.from({ length: count }, (_, index) => ({
      id: `${edge.id}:${index}`,
      edgeId: edge.id,
      s0: index * blockLength,
      s1: Math.min(Number(edge.lengthM || 0), (index + 1) * blockLength),
      state: 'FREE',
      owner: null,
    }));
  });
}

function findBlocker(key, occupied, lookaheadBlocks) {
  const exact = occupied.get(key);
  if (exact) return exact;
  const parsed = parseBlockKey(key);
  for (const [occupiedKey, owner] of occupied.entries()) {
    const other = parseBlockKey(occupiedKey);
    if (other.edgeId !== parsed.edgeId) continue;
    if (Math.abs(other.index - parsed.index) <= lookaheadBlocks) return owner;
  }
  return null;
}

function parseBlockKey(key) {
  const [edgeId, index] = String(key || '').split(':');
  return { edgeId, index: Number(index || 0) };
}

function blockKey(edgeId, headS) {
  const edge = TRACK.edges.find((item) => item.id === edgeId);
  if (!edge) return '';
  const blockLength = Math.max(1, Number(TRACK.blockLengthM || 50));
  const index = Math.max(0, Math.min(Math.ceil(Number(edge.lengthM || 0) / blockLength) - 1, Math.floor(Number(headS || 0) / blockLength)));
  return `${edge.id}:${index}`;
}

function servicesMap() {
  return Object.fromEntries((SERVICE.services || []).map((service) => [service.id, service]));
}

function speedLimitForEdge(edgeId) {
  const limit = (TRACK.speedLimits || []).find((item) => item.edgeId === edgeId)?.limitKmh;
  return Number(limit || 120);
}

function getStopPoint(stationId) {
  const station = TRACK.stations.find((item) => item.id === stationId);
  return station ? { ...station.stopPoint, dir: 1 } : { edgeId: TRACK.edges[0]?.id || '', headS: 0, dir: 1 };
}

function stationName(stationId) {
  return TRACK.stations.find((station) => station.id === stationId)?.name || stationId;
}

function interpolateStopPoints(fromPoint, toPoint, progress) {
  if (!fromPoint || !toPoint) return { edgeId: TRACK.edges[0]?.id || '', headS: 0, dir: 1 };
  const t = Math.max(0, Math.min(1, Number(progress || 0)));
  if (fromPoint.edgeId === toPoint.edgeId) {
    const headS = fromPoint.sM + (toPoint.sM - fromPoint.sM) * t;
    return { edgeId: fromPoint.edgeId, headS, dir: toPoint.sM >= fromPoint.sM ? 1 : -1 };
  }
  const fromEdge = TRACK.edges.find((edge) => edge.id === fromPoint.edgeId);
  const toEdge = TRACK.edges.find((edge) => edge.id === toPoint.edgeId);
  if (!fromEdge || !toEdge) return { edgeId: fromPoint.edgeId, headS: fromPoint.sM, dir: 1 };
  const shared = [fromEdge.from, fromEdge.to].find((nodeId) => nodeId === toEdge.from || nodeId === toEdge.to);
  if (!shared) return t < 0.5 ? { edgeId: fromPoint.edgeId, headS: fromPoint.sM, dir: 1 } : { edgeId: toPoint.edgeId, headS: toPoint.sM, dir: 1 };
  const junctionFromS = shared === fromEdge.from ? 0 : fromEdge.lengthM;
  const junctionToS = shared === toEdge.from ? 0 : toEdge.lengthM;
  const distA = Math.abs(junctionFromS - fromPoint.sM);
  const distB = Math.abs(toPoint.sM - junctionToS);
  const total = Math.max(1, distA + distB);
  const traveled = total * t;
  if (traveled <= distA) {
    const local = distA ? traveled / distA : 1;
    const headS = fromPoint.sM + (junctionFromS - fromPoint.sM) * local;
    return { edgeId: fromPoint.edgeId, headS, dir: junctionFromS >= fromPoint.sM ? 1 : -1 };
  }
  const local = distB ? (traveled - distA) / distB : 1;
  const headS = junctionToS + (toPoint.sM - junctionToS) * local;
  return { edgeId: toPoint.edgeId, headS, dir: toPoint.sM >= junctionToS ? 1 : -1 };
}

function distanceBetweenStops(fromPoint, toPoint) {
  if (!fromPoint || !toPoint) return 0;
  if (fromPoint.edgeId === toPoint.edgeId) return Math.abs(toPoint.sM - fromPoint.sM);
  const fromEdge = TRACK.edges.find((edge) => edge.id === fromPoint.edgeId);
  const toEdge = TRACK.edges.find((edge) => edge.id === toPoint.edgeId);
  if (!fromEdge || !toEdge) return 0;
  const shared = [fromEdge.from, fromEdge.to].find((nodeId) => nodeId === toEdge.from || nodeId === toEdge.to);
  if (!shared) return Number(fromEdge.lengthM || 0) + Number(toEdge.lengthM || 0);
  const junctionFromS = shared === fromEdge.from ? 0 : fromEdge.lengthM;
  const junctionToS = shared === toEdge.from ? 0 : toEdge.lengthM;
  return Math.abs(junctionFromS - fromPoint.sM) + Math.abs(toPoint.sM - junctionToS);
}

export function pointOnEdge(edgeId, headS) {
  const edge = TRACK.edges.find((item) => item.id === edgeId);
  if (!edge) return { x: 0, z: 0 };
  const from = TRACK.nodes.find((node) => node.id === edge.from);
  const to = TRACK.nodes.find((node) => node.id === edge.to);
  if (!from || !to) return { x: 0, z: 0 };
  const t = Math.max(0, Math.min(1, Number(headS || 0) / Math.max(1, Number(edge.lengthM || 1))));
  return {
    x: from.x + (to.x - from.x) * t,
    z: from.z + (to.z - from.z) * t,
  };
}

function addLog(state, message) {
  return {
    ...state,
    updatedAt: new Date().toISOString(),
    log: [message, ...state.log].slice(0, 120),
  };
}
