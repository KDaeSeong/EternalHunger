import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createInitialSpawnState,
  getHyperloopDeviceZoneId,
  localKeyHyperloops,
  readLocalJsonArray,
  uniqStr,
} from './simulationEngine';
import { applyRegionDataToZones } from './lumiaRegionData';
import { applyActiveMapIdToState } from './mapActionRuntime';
import {
  buildBaseZoneGraph,
  buildHyperloopZoneGraph,
  getHyperloopZoneIds,
  isHyperloopTransit as isHyperloopTransitEdge,
} from './mapGraphRuntime';

const FALLBACK_ZONES = [
  { zoneId: 'alley', name: '골목길', isForbidden: false },
  { zoneId: 'gas_station', name: '주유소', isForbidden: false },
  { zoneId: 'archery', name: '양궁장', isForbidden: false },
  { zoneId: 'school', name: '학교', isForbidden: false },
  { zoneId: 'police', name: '경찰서', isForbidden: false },
  { zoneId: 'firestation', name: '소방서', isForbidden: false },
  { zoneId: 'temple', name: '절', isForbidden: false },
  { zoneId: 'stream', name: '개울', isForbidden: false },
  { zoneId: 'park', name: '연못', isForbidden: false },
  { zoneId: 'hospital', name: '병원', isForbidden: false },
  { zoneId: 'hotel', name: '호텔', isForbidden: false },
  { zoneId: 'beach', name: '모래사장', isForbidden: false },
  { zoneId: 'forest', name: '숲', isForbidden: false },
  { zoneId: 'apartment', name: '고급 주택가', isForbidden: false },
  { zoneId: 'cemetery', name: '묘지', isForbidden: false },
  { zoneId: 'cathedral', name: '성당', isForbidden: false },
  { zoneId: 'warehouse', name: '창고', isForbidden: false },
  { zoneId: 'port', name: '항구', isForbidden: false },
  { zoneId: 'barge', name: '바지선', isForbidden: false },
  { zoneId: 'factory', name: '공장', isForbidden: false },
  { zoneId: 'lab', name: '연구소', isForbidden: false },
];

function safeCompute(label, factory, fallback) {
  try {
    return factory();
  } catch (error) {
    console.error(`[simulation:${label}]`, error);
    return fallback;
  }
}

export function useSimulationMapState({
  selectedCharId,
  survivors,
} = {}) {
  const [maps, setMaps] = useState([]);
  const [activeMapId, setActiveMapId] = useState('');
  const [hyperloopDestIdRaw, setHyperloopDestId] = useState('');
  const [spawnState, setSpawnState] = useState(() => createInitialSpawnState(''));

  const mapsRef = useRef([]);
  const activeMapIdRef = useRef('');
  const activeMapRef = useRef(null);

  const activeMapName = useMemo(() => safeCompute('activeMapName', () => {
    const list = Array.isArray(maps) ? maps : [];
    return list.find((map) => String(map?._id) === String(activeMapId))?.name || '맵 없음';
  }, '맵 없음'), [maps, activeMapId]);

  const activeMap = useMemo(() => safeCompute('activeMap', () => {
    const list = Array.isArray(maps) ? maps : [];
    return list.find((map) => String(map?._id) === String(activeMapId)) || null;
  }, null), [maps, activeMapId]);

  useEffect(() => {
    mapsRef.current = Array.isArray(maps) ? maps : [];
  }, [maps]);

  useEffect(() => {
    activeMapIdRef.current = String(activeMapId || '');
  }, [activeMapId]);

  useEffect(() => {
    activeMapRef.current = activeMap;
  }, [activeMap]);

  const applyActiveMapId = useCallback((nextMapId) => applyActiveMapIdToState(nextMapId, {
    refs: {
      activeMapIdRef,
    },
    actions: {
      setActiveMapId,
      setSpawnState,
    },
  }), []);

  const zones = useMemo(() => safeCompute('zones', () => {
    const list = Array.isArray(activeMap?.zones) ? activeMap.zones : [];
    return applyRegionDataToZones(list.length ? list : FALLBACK_ZONES);
  }, []), [activeMap]);

  const zoneNameById = useMemo(() => safeCompute('zoneNameById', () => {
    const out = {};
    (Array.isArray(zones) ? zones : []).forEach((zone) => {
      if (zone?.zoneId) out[String(zone.zoneId)] = zone.name || String(zone.zoneId);
    });
    return out;
  }, {}), [zones]);

  const getZoneName = useCallback((zoneId) => {
    const key = String(zoneId || '');
    return zoneNameById[key] || key || '미상';
  }, [zoneNameById]);

  const hyperloopDestIds = useMemo(() => safeCompute('hyperloopDestIds', () => {
    const ids = uniqStr(readLocalJsonArray(localKeyHyperloops(activeMapId)));
    if (!ids.length) return [];
    const mapSet = new Set((Array.isArray(maps) ? maps : []).map((map) => String(map?._id || '')));
    return ids.filter((id) => mapSet.has(String(id)));
  }, []), [activeMapId, maps]);

  const hyperloopPadZoneId = useMemo(() => safeCompute('hyperloopPadZoneId', () => {
    const serverZoneId = String(activeMap?.hyperloopDeviceZoneId || '').trim();
    if (serverZoneId) return serverZoneId;
    const saved = String(getHyperloopDeviceZoneId(activeMapId) || '').trim();
    if (saved) return saved;
    const list = Array.isArray(zones) ? zones : [];
    return String(list?.[0]?.zoneId || '');
  }, ''), [activeMap, activeMapId, zones]);

  const hyperloopPadName = useMemo(() => {
    const zoneId = String(hyperloopPadZoneId || '').trim();
    if (!zoneId) return '';
    return String(getZoneName(zoneId) || zoneId);
  }, [getZoneName, hyperloopPadZoneId]);

  const isSelectedCharOnHyperloopPad = useMemo(() => safeCompute('isSelectedCharOnHyperloopPad', () => {
    const who = String(selectedCharId || '').trim();
    if (!who) return false;
    const pad = String(hyperloopPadZoneId || '').trim();
    if (!pad) return false;
    const actor = (Array.isArray(survivors) ? survivors : []).find((char) => String(char?._id || '') === who) || null;
    return String(actor?.zoneId || '').trim() === pad;
  }, false), [selectedCharId, survivors, hyperloopPadZoneId]);

  const hyperloopDestId = useMemo(() => {
    if (!hyperloopDestIds.length) return '';
    const rawId = String(hyperloopDestIdRaw || '');
    return rawId && hyperloopDestIds.includes(rawId) ? rawId : String(hyperloopDestIds[0]);
  }, [hyperloopDestIdRaw, hyperloopDestIds]);

  const baseZoneGraph = useMemo(() => safeCompute('baseZoneGraph', () => (
    buildBaseZoneGraph(activeMap, zones)
  ), {}), [activeMap, zones]);

  const hyperloopZoneIds = useMemo(() => safeCompute('hyperloopZoneIds', () => (
    getHyperloopZoneIds(activeMap, zones)
  ), []), [activeMap, zones]);

  const hyperloopZoneSet = useMemo(() => new Set(hyperloopZoneIds), [hyperloopZoneIds]);

  const zoneGraph = useMemo(() => safeCompute('zoneGraph', () => (
    buildHyperloopZoneGraph(baseZoneGraph, zones, hyperloopZoneIds)
  ), {}), [baseZoneGraph, zones, hyperloopZoneIds]);

  const isHyperloopTransit = useCallback((fromZoneId, toZoneId) => (
    isHyperloopTransitEdge(baseZoneGraph, hyperloopZoneIds, fromZoneId, toZoneId)
  ), [baseZoneGraph, hyperloopZoneIds]);

  return {
    activeMap,
    activeMapId,
    activeMapIdRef,
    activeMapName,
    activeMapRef,
    applyActiveMapId,
    baseZoneGraph,
    getZoneName,
    hyperloopDestId,
    hyperloopDestIds,
    hyperloopPadName,
    hyperloopPadZoneId,
    hyperloopZoneSet,
    isHyperloopTransit,
    isSelectedCharOnHyperloopPad,
    maps,
    mapsRef,
    setHyperloopDestId,
    setMaps,
    setSpawnState,
    spawnState,
    zoneGraph,
    zoneNameById,
    zones,
  };
}
