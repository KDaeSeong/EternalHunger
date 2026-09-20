import { simulationRandom } from '../../../utils/simulationRandom.js';
import { buildBaseZoneGraph } from './mapGraphRuntime';
import { bfsNextStepToAnyTarget } from './pathfindingRuntime';

export const ENDGAME_START = Object.freeze({ day: 6, phase: 'night' });
export function isEndgamePhase(day, phase) {
  return Number(day || 0) * 2 + (phase === 'night' ? 1 : 0) >= ENDGAME_START.day * 2 + 1;
}

export function getEndgameDurationSec(ruleset = {}) {
  const value = Number(ruleset.suddenDeath?.totalSec ?? ruleset.suddenDeath?.durationSec ?? 370);
  return Math.max(30, Number.isFinite(value) ? value : 370);
}

// Pressure changes the world, never the actors' HP, positions, or winner.
export function createEndgamePressure({ previous, mapObj, forbiddenIds = new Set(), nowSec = 0, ruleset = {} } = {}) {
  if (previous) return structuredClone(previous);
  const zoneIds = (mapObj?.zones || []).map((zone) => String(zone.zoneId));
  const safe = zoneIds.filter((id) => !forbiddenIds.has(id));
  const graph = buildBaseZoneGraph(mapObj, mapObj?.zones || []);
  const anchor = safe[Math.floor(simulationRandom() * safe.length)] || '';
  const neighbor = (graph[anchor] || []).find((id) => safe.includes(id));
  const initialSafeZoneIds = [anchor, neighbor || safe.find((id) => id !== anchor)].filter(Boolean);
  const totalSec = getEndgameDurationSec(ruleset);
  const singleAfter = Math.max(10, Math.min(totalSec - 10, Number(ruleset.suddenDeath?.singleZoneAfterSec ?? 90)));
  return { startedAtSec: nowSec, singleZoneAtSec: nowSec + singleAfter, allClosedAtSec: nowSec + totalSec,
    initialSafeZoneIds, finalZoneId: anchor, stage: '', zoneIds };
}

export function advanceEndgamePressure(endgame, forbiddenIds, nowSec, actions = {}) {
  if (!endgame) return false;
  const stage = nowSec >= endgame.allClosedAtSec ? 'closed' : nowSec >= endgame.singleZoneAtSec ? 'final' : 'approach';
  const safe = new Set(stage === 'closed' ? [] : stage === 'final' ? [endgame.finalZoneId] : endgame.initialSafeZoneIds);
  const added = endgame.zoneIds.filter((id) => !safe.has(id) && !forbiddenIds.has(id));
  added.forEach((id) => forbiddenIds.add(id));
  endgame.forbiddenZoneIds = [...forbiddenIds];
  if (endgame.stage === stage) return false;
  endgame.stage = stage;
  const actualSafe = endgame.zoneIds.filter((id) => !forbiddenIds.has(id));
  const label = actions.getZoneName?.(endgame.finalZoneId) || endgame.finalZoneId;
  actions.emitRunEvent?.('endgame_zone', { stage, safeZoneIds: actualSafe, finalZoneId: endgame.finalZoneId,
    singleZoneAtSec: endgame.singleZoneAtSec, allClosedAtSec: endgame.allClosedAtSec }, actions.atNow?.());
  actions.addLog?.(stage === 'approach'
    ? `🚩 최종 구역 예고: ${actualSafe.map((id) => actions.getZoneName?.(id) || id).join(', ')} → ${endgame.singleZoneAtSec - nowSec}초 후 ${label} 한 곳 → ${endgame.allClosedAtSec - nowSec}초 후 전지역 폐쇄. 직접 이동해야 합니다.`
    : stage === 'final' ? `🚩 마지막 안전구역: ${label}. ${Math.max(0, endgame.allClosedAtSec - nowSec)}초 후 폐쇄됩니다.`
      : '🚫 마지막 안전구역 폐쇄: 모든 참가자에게 동일한 구역 위험이 적용됩니다.', 'highlight');
  return true;
}

export function pickEndgameMove(actor, endgame, forbiddenIds, zoneGraph, nowSec) {
  if (!endgame || endgame.stage === 'closed') return null;
  const current = String(actor.zoneId || '');
  const safe = endgame.zoneIds.filter((id) => !forbiddenIds.has(id));
  const mustRotate = forbiddenIds.has(current) || nowSec >= endgame.singleZoneAtSec - 20;
  if (!mustRotate || !safe.length) return null;
  const targets = new Set(safe.includes(endgame.finalZoneId) ? [endgame.finalZoneId] : safe);
  // Escaping may need to cross a dangerous intermediate zone. This is a real
  // graph step with normal travel time; no direct position or timer correction.
  const route = bfsNextStepToAnyTarget(current, targets, zoneGraph, new Set());
  if (!route.nextStep) return null;
  return { nextStep: route.nextStep, targetZoneId: endgame.finalZoneId };
}
