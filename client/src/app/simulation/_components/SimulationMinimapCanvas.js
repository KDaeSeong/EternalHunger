'use client';

import { useId, useMemo } from 'react';
import { getObserverVisibleActors } from '../_lib/teamObserverRuntime';
import { getSpatialPosition, SPATIAL_REGION_SIZE } from '../_lib/combatSpatialRuntime.js';

import {
  LUMIA_HYPERLOOP_MARKERS,
  LUMIA_ISLAND_OUTLINE,
  LUMIA_KIOSK_MARKERS,
  LUMIA_MINIMAP_VIEWBOX,
  LUMIA_PASSAGE_SEGMENTS,
  LUMIA_ZONE_POLYGONS,
} from '../_lib/simulationConstants';
import {
  createLumiaConnectedPassages,
  createLumiaRenderMarkers,
  createLumiaRenderPositions,
} from '../_lib/lumiaMapRenderGeometryRuntime';
import { buildCustomMapRenderGeometry } from '../_lib/customMapRenderGeometryRuntime.js';

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function actorIdentity(actor) {
  return String(actor?._id || actor?.id || '');
}

const OFF = [
  [0, 0], [3, 0], [-3, 0], [0, 3], [0, -3],
  [3, 3], [-3, 3], [3, -3], [-3, -3],
  [5, 0], [-5, 0], [0, 5], [0, -5],
];

const TOKEN_OFF = [
  [0, 0], [4.4, 0], [-4.4, 0], [0, 4.4], [0, -4.4],
  [3.3, 3.3], [-3.3, 3.3], [3.3, -3.3], [-3.3, -3.3],
  [6.2, 1.8], [-6.2, 1.8], [1.8, 6.2], [1.8, -6.2],
];

const EMPTY_ZONE_POSITIONS = Object.freeze({});

const LUMIA_RENDER_HYPERLOOP_MARKERS = createLumiaRenderMarkers(
  LUMIA_HYPERLOOP_MARKERS,
  LUMIA_ISLAND_OUTLINE
);
const LUMIA_RENDER_KIOSK_MARKERS = createLumiaRenderMarkers(
  LUMIA_KIOSK_MARKERS,
  LUMIA_ISLAND_OUTLINE
);

function asSet(value) {
  if (value instanceof Set) return value;
  return new Set(safeArray(value).map(String));
}

function groupActorsByZone(actors, activeMapId) {
  const byZone = {};
  safeArray(actors).forEach((actor) => {
    const actorMapId = String(actor?.mapId || '').trim();
    if (actorMapId && String(activeMapId || '') && actorMapId !== String(activeMapId)) return;

    const zoneId = String(actor?.zoneId || '');
    if (!zoneId) return;
    if (!byZone[zoneId]) byZone[zoneId] = [];
    byZone[zoneId].push(actor);
  });
  return byZone;
}

function polygonPoints(points) {
  return safeArray(points)
    .map(([x, y]) => `${Number(x || 0)},${Number(y || 0)}`)
    .join(' ');
}

function shrinkPolygon(points, center, ratio = 0.6) {
  const cx = Number(center?.x);
  const cy = Number(center?.y);
  const r = Math.max(0.1, Math.min(1, Number(ratio || 0.6)));
  if (!Number.isFinite(cx) || !Number.isFinite(cy)) return points;
  return safeArray(points).map(([x0, y0]) => {
    const x = Number(x0 || 0);
    const y = Number(y0 || 0);
    return [
      Number((cx + ((x - cx) * r)).toFixed(2)),
      Number((cy + ((y - cy) * r)).toFixed(2)),
    ];
  });
}

function edgeKey(a, b) {
  const aa = String(a || '');
  const bb = String(b || '');
  return aa < bb ? `${aa}::${bb}` : `${bb}::${aa}`;
}

function MinimapPassage({ segment, supplemental = false }) {
  const [a, b] = safeArray(segment?.edge);
  if (!a || !b) return null;
  const points = segment?.pointsText || polygonPoints(segment.points);
  return (
    <g
      className={`minimap-passage-route ${supplemental ? 'supplemental' : ''}`}
      data-edge={`${a}:${b}`}
    >
      <polyline
        points={points}
        className="minimap-passage-halo"
      />
      <polyline
        points={points}
        className="minimap-passage"
      />
    </g>
  );
}

export default function SimulationMinimapCanvas({
  trackedActorIds = [],
  activeMapId,
  dead,
  forbiddenNow,
  getTeamStateForActor,
  getZoneName,
  hyperloopCharId,
  hyperloopZoneSet,
  recentMoveTrails,
  recentPings,
  survivors,
  zones,
  zoneEdges,
  zonePos,
}) {
  const rawClipId = useId();
  const islandClipId = `simulation-minimap-boundary-${String(rawClipId).replace(/:/g, '')}`;
  const sourcePositions = zonePos && typeof zonePos === 'object' ? zonePos : EMPTY_ZONE_POSITIONS;
  const usesCustomGeometry = String(activeMapId || '').startsWith('local-map-');
  const customGeometry = useMemo(
    () => usesCustomGeometry ? buildCustomMapRenderGeometry(zones, zoneEdges) : null,
    [usesCustomGeometry, zones, zoneEdges]
  );
  const mapOutline = customGeometry?.outline || LUMIA_ISLAND_OUTLINE;
  const mapViewBox = customGeometry?.viewBox || LUMIA_MINIMAP_VIEWBOX;
  const paddedViewBox = useMemo(() => ({
    x: Number(mapViewBox.x || 0) - 5,
    y: Number(mapViewBox.y || 0) - 6,
    width: Number(mapViewBox.width || 100) + 10,
    height: Number(mapViewBox.height || 100) + 12,
  }), [mapViewBox]);
  const positions = useMemo(
    () => customGeometry?.positions || createLumiaRenderPositions(sourcePositions, LUMIA_ISLAND_OUTLINE),
    [customGeometry, sourcePositions]
  );
  const passageSegments = useMemo(
    () => customGeometry?.passages || createLumiaConnectedPassages(LUMIA_PASSAGE_SEGMENTS, positions, LUMIA_ISLAND_OUTLINE),
    [customGeometry, positions]
  );
  const passageEdgeKeys = useMemo(
    () => new Set(passageSegments.map((segment) => edgeKey(...safeArray(segment?.edge)))),
    [passageSegments]
  );
  const supplementalPassages = useMemo(() => {
    if (customGeometry) return [];
    const segments = safeArray(zoneEdges).flatMap((edge) => {
      const [a, b] = safeArray(edge).map(String);
      if (!a || !b || a === b || passageEdgeKeys.has(edgeKey(a, b))) return [];
      return [{ edge: [a, b], points: [] }];
    });
    return createLumiaConnectedPassages(segments, positions, LUMIA_ISLAND_OUTLINE);
  }, [customGeometry, passageEdgeKeys, positions, zoneEdges]);
  const zonePolygons = customGeometry?.polygons || LUMIA_ZONE_POLYGONS;
  const zoneList = safeArray(zones);
  const availableZoneIds = useMemo(
    () => new Set(zoneList.map((zone) => String(zone?.zoneId || '')).filter(Boolean)),
    [zoneList]
  );
  const mapOutlinePoints = useMemo(() => polygonPoints(mapOutline), [mapOutline]);
  const baseZonePolygonRows = useMemo(() => Object.entries(zonePolygons).map(([id, polygon]) => ({
    id,
    zoneName: String(getZoneName?.(id) || id),
    points: polygonPoints(shrinkPolygon(polygon, positions?.[id], 0.78)),
  })), [getZoneName, positions, zonePolygons]);
  const forbiddenZonePolygonRows = useMemo(() => Object.entries(zonePolygons).map(([id, polygon]) => ({
    id,
    zoneName: String(getZoneName?.(id) || id),
    points: polygonPoints(shrinkPolygon(polygon, positions?.[id], 0.82)),
  })), [getZoneName, positions, zonePolygons]);
  const renderedPassages = useMemo(() => [
    ...passageSegments.map((segment) => ({
      segment: { ...segment, pointsText: polygonPoints(segment.points) },
      supplemental: false,
    })),
    ...supplementalPassages.map((segment) => ({
      segment: { ...segment, pointsText: polygonPoints(segment.points) },
      supplemental: true,
    })),
  ], [passageSegments, supplementalPassages]);
  const staticMapFrame = useMemo(() => (
    <>
      <defs>
        <clipPath id={islandClipId}>
          <polygon points={mapOutlinePoints} />
        </clipPath>
      </defs>

      <polygon
        className="minimap-island-outline"
        points={mapOutlinePoints}
      />

      <g className="minimap-zone-area-layer" clipPath={`url(#${islandClipId})`}>
        {baseZonePolygonRows.map((row) => {
          if (!availableZoneIds.has(row.id)) return null;
          return (
            <polygon
              key={`area-base-${row.id}`}
              points={row.points}
              className="minimap-zone-area"
            >
              <title>{row.zoneName}</title>
            </polygon>
          );
        })}
      </g>
    </>
  ), [availableZoneIds, baseZonePolygonRows, islandClipId, mapOutlinePoints]);
  const staticPassageLayer = useMemo(() => (
    <g clipPath={`url(#${islandClipId})`}>
      {renderedPassages.map(({ segment, supplemental }) => {
        const [a, b] = safeArray(segment?.edge);
        if (!availableZoneIds.has(a) || !availableZoneIds.has(b)) return null;
        return (
          <MinimapPassage
            key={`${supplemental ? 'supplemental-' : ''}passage-${a}-${b}`}
            segment={segment}
            supplemental={supplemental}
          />
        );
      })}
    </g>
  ), [availableZoneIds, islandClipId, renderedPassages]);
  const kioskSet = useMemo(
    () => new Set(
      zoneList
        .filter((zone) => zone?.hasKiosk === true || zone?.kiosk === true)
        .map((zone) => String(zone?.zoneId || ''))
        .filter(Boolean)
    ),
    [zoneList]
  );
  const forbiddenSet = useMemo(() => asSet(forbiddenNow), [forbiddenNow]);
  const hyperloopSet = useMemo(() => asSet(hyperloopZoneSet), [hyperloopZoneSet]);
  const aliveByZone = useMemo(() => groupActorsByZone(survivors, activeMapId), [survivors, activeMapId]);
  const deadByZone = useMemo(() => groupActorsByZone(dead, activeMapId), [dead, activeMapId]);
  const trackedSet = useMemo(() => new Set(safeArray(trackedActorIds).map(String)), [trackedActorIds]);
  const hyperloopSelectedChar = useMemo(
    () => safeArray(survivors).find((actor) => actorIdentity(actor) === String(hyperloopCharId || '')) || null,
    [hyperloopCharId, survivors]
  );
  const selectedZoneId = hyperloopSelectedChar ? String(hyperloopSelectedChar?.zoneId || '') : '';
  const visiblePings = useMemo(() => safeArray(recentPings).slice(0, 2), [recentPings]);
  if (!zoneList.length) return <div className="minimap-empty">미니맵 데이터가 없습니다.</div>;

  return (
    <div className="minimap-canvas">
      <svg
        className="minimap-svg"
        viewBox={`${paddedViewBox.x} ${paddedViewBox.y} ${paddedViewBox.width} ${paddedViewBox.height}`}
        role="img"
        aria-label={customGeometry ? '사용자 지도 미니맵' : '루미아 섬 미니맵'}
      >
        {staticMapFrame}

        <g className="minimap-zone-alert-layer" clipPath={`url(#${islandClipId})`}>
          {forbiddenZonePolygonRows.map((row) => {
            if (!availableZoneIds.has(row.id) || !forbiddenSet.has(row.id)) return null;
            return (
              <polygon
                key={`area-${row.id}`}
                points={row.points}
                className="minimap-zone-area forbidden"
              >
                <title>{row.zoneName}</title>
              </polygon>
            );
          })}
        </g>

        {zoneList.map((zone) => {
          const id = String(zone?.zoneId || '');
          const p = positions?.[id];
          if (!id || !p || zonePolygons[id]) return null;
          const isForbidden = forbiddenSet.has(id);
          return (
            <circle
              key={`surface-${id}`}
              cx={p.x}
              cy={p.y}
              r={6.35}
              className={`minimap-zone-surface ${isForbidden ? 'forbidden' : ''}`}
            />
          );
        })}

        {staticPassageLayer}

        <g clipPath={`url(#${islandClipId})`}>
          {safeArray(recentMoveTrails).map((trail) => {
            const from = positions?.[String(trail?.from || '')];
            const to = positions?.[String(trail?.to || '')];
            if (!from || !to) return null;
            const transport = String(trail?.transport || '') === 'hyperloop' ? 'hyperloop' : 'walk';
            const title = [
              String(trail?.name || '').trim(),
              `${getZoneName?.(trail.from) || trail.from} -> ${getZoneName?.(trail.to) || trail.to}`,
              transport,
            ].filter(Boolean).join(' / ');
            return (
              <g key={`move-trail-${trail.id}`} className={`minimap-move-trail ${transport}`}>
                <title>{title}</title>
                <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
                <circle className="minimap-move-arrival" cx={to.x} cy={to.y} r="1.45" />
              </g>
            );
          })}
        </g>

        {zoneList.map((zone) => {
          const id = String(zone?.zoneId || '');
          const p = positions?.[id];
          if (!id || !p) return null;

          const isForbidden = forbiddenSet.has(id);
          const isSelectedZone = !!selectedZoneId && selectedZoneId === id;
          const zoneName = String(getZoneName?.(id) || id);
          const aliveHere = aliveByZone[id]?.length || 0;
          const deadHere = deadByZone[id]?.length || 0;
          const nodeR = 1.18;
          const labelSize = zoneName.length >= 6 ? 2.3 : zoneName.length >= 5 ? 2.55 : 2.9;
          const hasHyperloop = hyperloopSet.has(id);
          const hasKiosk = kioskSet.has(id) || (!customGeometry && Boolean(LUMIA_KIOSK_MARKERS[id]));
          const hyperloopMarker = (!customGeometry && LUMIA_RENDER_HYPERLOOP_MARKERS[id]) || { x: p.x + nodeR, y: p.y - 4.2 };
          const kioskMarker = (!customGeometry && LUMIA_RENDER_KIOSK_MARKERS[id]) || { x: p.x - nodeR, y: p.y + 4.2 };

          return (
            <g key={`z-${id}`}>
              <text
                className="minimap-zone-label"
                x={p.x}
                y={p.y - 3.1}
                textAnchor="middle"
                fontSize={labelSize}
              >
                {zoneName}
              </text>
              <circle
                cx={p.x}
                cy={p.y}
                r={nodeR}
                className={`minimap-node ${isForbidden ? 'forbidden' : ''} ${isSelectedZone ? 'selected' : ''}`}
              />
              <title>{zoneName}</title>

              {hasHyperloop ? (
                <g className="minimap-facility minimap-facility-hyperloop" transform={`translate(${hyperloopMarker.x} ${hyperloopMarker.y})`}>
                  <title>{zoneName} hyperloop</title>
                  <circle r="1.38" />
                  <text x="0" y="0.58" textAnchor="middle">{'>>'}</text>
                </g>
              ) : null}

              {hasKiosk ? (
                <g className="minimap-facility minimap-facility-kiosk" transform={`translate(${kioskMarker.x} ${kioskMarker.y})`}>
                  <title>{zoneName} kiosk</title>
                  <circle r="1.35" />
                  <text x="0" y="0.58" textAnchor="middle">C</text>
                </g>
              ) : null}

              {(aliveHere > 0 || deadHere > 0) ? (
                <text
                  x={p.x}
                  y={p.y + 5.35}
                  textAnchor="middle"
                  fontSize="2.45"
                  fill="rgba(255,255,255,0.62)"
                >
                  {aliveHere > 0 ? `+${aliveHere}` : ''}{deadHere > 0 ? ` / -${deadHere}` : ''}
                </text>
              ) : null}

              {getObserverVisibleActors(aliveByZone[id], trackedSet).map((actor, idx) => {
                const actorId = actorIdentity(actor);
                const offset = TOKEN_OFF[idx % TOKEN_OFF.length];
                const local = getSpatialPosition(actor);
                const cx = p.x + (local ? (local.x / SPATIAL_REGION_SIZE - 0.5) * 12 : offset[0] * 0.5);
                const cy = p.y + (local ? (local.y / SPATIAL_REGION_SIZE - 0.5) * 12 : offset[1] * 0.5);
                const isSelected = actorId === String(hyperloopCharId || '');
                const isTracked = trackedSet.has(actorId);
                const hpRatio = Math.max(0, Math.min(1, Number(actor?.hp || 0) / Math.max(1, Number(actor?.maxHp || 100))));
                const tokenImg = String(actor?.previewImage || '/Images/default_image.svg');
                const teamState = getTeamStateForActor?.(actor);
                const teamColor = teamState?.missingCount > 0
                  ? 'rgba(255, 180, 80, 0.94)'
                  : 'rgba(112, 221, 148, 0.94)';
                const tokenTitle = `${String(actor?.name || '캐릭터')} / HP ${Math.floor(Number(actor?.hp || 0))}/${Math.max(1, Math.floor(Number(actor?.maxHp || 100)))} / ${zoneName}${local ? ` / 지역 내 (${local.x.toFixed(1)}, ${local.y.toFixed(1)})m` : ''}`;

                return (
                  <g key={`a-${id}-${actorId || idx}`} className={`minimap-character-token ${isSelected ? 'selected' : ''} ${isTracked ? 'tracked' : ''}`}>
                    <title>{isTracked ? `관전 중 · ${tokenTitle}` : tokenTitle}</title>
                    {isSelected || isTracked ? (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={3.05}
                        fill="none"
                        stroke="rgba(255,215,0,0.92)"
                        strokeWidth="0.8"
                      />
                    ) : null}
                    <circle
                      cx={cx}
                      cy={cy}
                      r={2.42}
                      fill="rgba(8, 14, 24, 0.92)"
                      stroke={isSelected || isTracked ? 'rgba(255,215,0,0.95)' : teamColor}
                      strokeWidth="0.55"
                    />
                    <image
                      href={tokenImg}
                      x={cx - 1.58}
                      y={cy - 1.58}
                      width="3.16"
                      height="3.16"
                      preserveAspectRatio="xMidYMid slice"
                    />
                    <path
                      d={`M ${cx - 2.32} ${cy + 2.68} H ${cx - 2.32 + (4.64 * hpRatio)}`}
                      className={hpRatio <= 0.32 ? 'minimap-token-hp critical' : 'minimap-token-hp'}
                    />
                    <text
                      x={cx}
                      y={cy + 5.22}
                      textAnchor="middle"
                      className="minimap-token-label"
                    >
                      {String(actor?.name || '?').slice(0, 2)}
                    </text>
                  </g>
                );
              })}

              {getObserverVisibleActors(deadByZone[id], trackedSet, 8).map((actor, idx) => {
                const actorId = actorIdentity(actor);
                const offset = OFF[(idx + 2) % OFF.length];
                const local = getSpatialPosition(actor);
                const isTracked = trackedSet.has(actorId);
                return (
                  <circle
                    key={`d-${id}-${actorId || idx}`}
                    cx={p.x + (local ? (local.x / SPATIAL_REGION_SIZE - 0.5) * 12 : offset[0] * 0.55)}
                    cy={p.y + (local ? (local.y / SPATIAL_REGION_SIZE - 0.5) * 12 : offset[1] * 0.55)}
                    r={isTracked ? 1.4 : 0.85}
                    fill="rgba(170,170,170,0.70)"
                    stroke={isTracked ? 'rgba(255,215,0,0.95)' : 'rgba(0,0,0,0.28)'}
                    strokeWidth="0.35"
                  ><title>{`${isTracked ? '관전 중 · ' : ''}${actor.name || '참가자'} / 사망 / ${zoneName}`}</title></circle>
                );
              })}
            </g>
          );
        })}

        <g clipPath={`url(#${islandClipId})`}>
          {visiblePings.map((ping) => {
            const p = positions?.[String(ping?.zoneId || '')];
            if (!p) return null;
            return (
              <g
                key={`ping-${ping.id}`}
                className={`minimap-ping ${String(ping.kind || '')}`}
                transform={`translate(${p.x} ${p.y})`}
              >
                <circle r="5.6" />
                <circle className="minimap-ping-core" r="1.05" />
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
