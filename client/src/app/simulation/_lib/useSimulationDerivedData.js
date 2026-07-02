import { useMemo } from 'react';
import { getRuleset } from '../../../utils/rulesets';
import {
  buildDetonationRiskSummary,
  buildRecentPings,
  buildZoneEdges,
  buildZonePositions,
  getEmptyDetonationRiskSummary,
} from './mapDerived';
import { buildRunSummaries, getEmptyRunSummaries } from './runSummaries';
import {
  buildSimulationDiagnostics,
  formatDiagnosticsLine,
  getEmptySimulationDiagnostics,
} from './simulationDiagnostics';

function safeCompute(label, factory, fallback) {
  try {
    return factory();
  } catch (error) {
    console.error(`[simulation:${label}]`, error);
    return fallback;
  }
}

export function useSimulationDerivedData({
  activeMap,
  assistCounts,
  baseZoneGraph,
  day,
  dead,
  forbiddenNow,
  getZoneName,
  itemMetaById,
  itemNameById,
  killCounts,
  phase,
  runEvents,
  settings,
  showMarketPanel,
  showResultModal,
  survivors,
  uiModal,
  zoneNameById,
  zones,
}) {
  const shouldComputeHeavyDerived = showResultModal || showMarketPanel || uiModal === 'map' || uiModal === 'chars' || uiModal === 'log';
  const shouldComputeMapDerived = true;

  const heavyRunSummaries = useMemo(() => {
    if (!shouldComputeHeavyDerived) return getEmptyRunSummaries();
    return safeCompute('heavyRunSummaries', () => buildRunSummaries({
      runEvents,
      itemNameById,
      zoneNameById,
      itemMetaById,
      survivors,
      dead,
      killCounts,
      assistCounts,
    }), getEmptyRunSummaries());
  }, [runEvents, itemNameById, zoneNameById, itemMetaById, survivors, dead, killCounts, assistCounts, shouldComputeHeavyDerived]);

  const simulationDiagnostics = useMemo(() => {
    if (!shouldComputeHeavyDerived) return getEmptySimulationDiagnostics();
    return safeCompute('simulationDiagnostics', () => buildSimulationDiagnostics({
      runEvents,
      survivors,
      dead,
      itemMetaById,
      zoneNameById,
      ruleset: getRuleset(settings?.rulesetId),
    }), getEmptySimulationDiagnostics());
  }, [runEvents, survivors, dead, itemMetaById, zoneNameById, settings?.rulesetId, shouldComputeHeavyDerived]);

  const simulationDiagnosticsLine = useMemo(
    () => formatDiagnosticsLine(simulationDiagnostics),
    [simulationDiagnostics]
  );

  const zonePos = useMemo(() => {
    if (!shouldComputeMapDerived) return {};
    return safeCompute('zonePos', () => buildZonePositions(zones), {});
  }, [zones, shouldComputeMapDerived]);

  const zoneEdges = useMemo(() => {
    if (!shouldComputeMapDerived) return [];
    return safeCompute('zoneEdges', () => buildZoneEdges({ zones, zoneGraph: baseZoneGraph }), []);
  }, [baseZoneGraph, zones, shouldComputeMapDerived]);

  const pingNow = useMemo(() => {
    const events = Array.isArray(runEvents) ? runEvents : [];
    let latest = 0;
    for (let i = events.length - 1; i >= 0; i -= 1) {
      const ts = Number(events[i]?.ts || 0);
      if (Number.isFinite(ts) && ts > latest) latest = ts;
      if (latest > 0) break;
    }
    return latest || Number.MAX_SAFE_INTEGER;
  }, [runEvents]);

  const recentPings = useMemo(() => {
    if (!shouldComputeMapDerived) return [];
    return safeCompute('recentPings', () => buildRecentPings({ runEvents, pingNow, zonePos }), []);
  }, [runEvents, pingNow, zonePos, shouldComputeMapDerived]);

  const detonationRiskSummary = useMemo(() => safeCompute('detonationRiskSummary', () => buildDetonationRiskSummary({
    day,
    activeMap,
    zones,
    forbiddenNow,
    rulesetId: settings?.rulesetId,
    survivors,
    phase,
    getZoneName,
  }), getEmptyDetonationRiskSummary()), [day, activeMap, zones, forbiddenNow, settings?.rulesetId, survivors, phase, getZoneName]);

  return {
    ...heavyRunSummaries,
    detonationRiskSummary,
    heavyRunSummaries,
    recentPings,
    simulationDiagnostics,
    simulationDiagnosticsLine,
    zoneEdges,
    zonePos,
  };
}
