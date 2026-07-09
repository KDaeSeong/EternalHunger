'use client';

import {
  LUMIA_HYPERLOOP_MARKERS,
  LUMIA_ISLAND_OUTLINE,
  LUMIA_KIOSK_MARKERS,
  LUMIA_MINIMAP_VIEWBOX,
  LUMIA_PASSAGE_SEGMENTS,
  LUMIA_ZONE_POLYGONS,
} from '../_lib/simulationConstants';

function safeArray(value) {
  return Array.isArray(value) ? value : [];
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

const MINIMAP_VIEWBOX_PAD = {
  x: -5,
  y: -6,
  width: LUMIA_MINIMAP_VIEWBOX.width + 10,
  height: LUMIA_MINIMAP_VIEWBOX.height + 12,
};

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

function edgeKey(a, b) {
  const aa = String(a || '');
  const bb = String(b || '');
  return aa < bb ? `${aa}::${bb}` : `${bb}::${aa}`;
}

export default function SimulationMinimapCanvas({
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
  const zoneList = safeArray(zones);
  if (!zoneList.length) return <div className="minimap-empty">미니맵 데이터가 없습니다.</div>;

  const forbiddenSet = asSet(forbiddenNow);
  const hyperloopSet = asSet(hyperloopZoneSet);
  const kioskSet = new Set(
    zoneList
      .filter((zone) => zone?.hasKiosk === true || zone?.kiosk === true)
      .map((zone) => String(zone?.zoneId || ''))
      .filter(Boolean)
  );
  const aliveByZone = groupActorsByZone(survivors, activeMapId);
  const deadByZone = groupActorsByZone(dead, activeMapId);
  const hyperloopSelectedChar = safeArray(survivors).find((actor) => String(actor?._id) === String(hyperloopCharId)) || null;
  const selectedZoneId = hyperloopSelectedChar ? String(hyperloopSelectedChar?.zoneId || '') : '';
  const positions = zonePos && typeof zonePos === 'object' ? zonePos : {};
  const availableZoneIds = new Set(zoneList.map((zone) => String(zone?.zoneId || '')).filter(Boolean));
  const visiblePings = safeArray(recentPings).slice(0, 2);
  const passageEdgeKeys = new Set();

  return (
    <div className="minimap-canvas">
      <svg
        className="minimap-svg"
        viewBox={`${MINIMAP_VIEWBOX_PAD.x} ${MINIMAP_VIEWBOX_PAD.y} ${MINIMAP_VIEWBOX_PAD.width} ${MINIMAP_VIEWBOX_PAD.height}`}
        role="img"
        aria-label="미니맵"
      >
        <defs>
          <clipPath id="lumia-minimap-island-clip">
            <polygon points={polygonPoints(LUMIA_ISLAND_OUTLINE)} />
          </clipPath>
        </defs>

        <polygon
          className="minimap-island-outline"
          points={polygonPoints(LUMIA_ISLAND_OUTLINE)}
        />

        <g className="minimap-zone-area-layer" clipPath="url(#lumia-minimap-island-clip)">
          {Object.entries(LUMIA_ZONE_POLYGONS).map(([id, polygon]) => {
            if (!availableZoneIds.has(id)) return null;
            const zoneName = String(getZoneName?.(id) || id);
            return (
              <polygon
                key={`area-base-${id}`}
                points={polygonPoints(polygon)}
                className="minimap-zone-area"
              >
                <title>{zoneName}</title>
              </polygon>
            );
          })}
        </g>

        <g className="minimap-zone-alert-layer" clipPath="url(#lumia-minimap-island-clip)">
          {Object.entries(LUMIA_ZONE_POLYGONS).map(([id, polygon]) => {
            if (!availableZoneIds.has(id)) return null;
            const isForbidden = forbiddenSet.has(id);
            if (!isForbidden) return null;
            const zoneName = String(getZoneName?.(id) || id);
            return (
              <polygon
                key={`area-${id}`}
                points={polygonPoints(polygon)}
                className="minimap-zone-area forbidden"
              >
                <title>{zoneName}</title>
              </polygon>
            );
          })}
        </g>

        {zoneList.map((zone) => {
          const id = String(zone?.zoneId || '');
          const p = positions?.[id];
          if (!id || !p || LUMIA_ZONE_POLYGONS[id]) return null;
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

        {safeArray(LUMIA_PASSAGE_SEGMENTS).map((segment) => {
          const [a, b] = safeArray(segment?.edge);
          if (!availableZoneIds.has(a) || !availableZoneIds.has(b)) return null;
          passageEdgeKeys.add(edgeKey(a, b));
          return (
            <polyline
              key={`passage-${a}-${b}`}
              points={polygonPoints(segment.points)}
              className="minimap-passage"
            />
          );
        })}

        {safeArray(zoneEdges).map(([a, b]) => {
          const pa = positions?.[a];
          const pb = positions?.[b];
          if (!pa || !pb) return null;
          if (passageEdgeKeys.has(edgeKey(a, b))) return null;
          return (
            <line
              key={`e-${a}-${b}`}
              x1={pa.x}
              y1={pa.y}
              x2={pb.x}
              y2={pb.y}
              className="minimap-edge"
            />
          );
        })}

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

        {zoneList.map((zone) => {
          const id = String(zone?.zoneId || '');
          const p = positions?.[id];
          if (!id || !p) return null;

          const isForbidden = forbiddenSet.has(id);
          const isSelectedZone = !!selectedZoneId && selectedZoneId === id;
          const zoneName = String(getZoneName?.(id) || id);
          const aliveHere = aliveByZone[id]?.length || 0;
          const deadHere = deadByZone[id]?.length || 0;
          const nodeR = 3.45;
          const labelSize = zoneName.length >= 6 ? 1.95 : zoneName.length >= 5 ? 2.18 : 2.5;
          const hasHyperloop = hyperloopSet.has(id);
          const hasKiosk = kioskSet.has(id) || Boolean(LUMIA_KIOSK_MARKERS[id]);
          const hyperloopMarker = LUMIA_HYPERLOOP_MARKERS[id] || { x: p.x + nodeR, y: p.y - 4.2 };
          const kioskMarker = LUMIA_KIOSK_MARKERS[id] || { x: p.x - nodeR, y: p.y + 4.2 };

          return (
            <g key={`z-${id}`}>
              <text
                className="minimap-zone-label"
                x={p.x}
                y={p.y - nodeR - 1.4}
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
                  <circle r="1.28" />
                  <text x="0" y="0.54" textAnchor="middle">{'>>'}</text>
                </g>
              ) : null}

              {hasKiosk ? (
                <g className="minimap-facility minimap-facility-kiosk" transform={`translate(${kioskMarker.x} ${kioskMarker.y})`}>
                  <title>{zoneName} kiosk</title>
                  <circle r="1.24" />
                  <text x="0" y="0.54" textAnchor="middle">C</text>
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

              {(aliveByZone[id] || []).slice(0, 12).map((actor, idx) => {
                const offset = TOKEN_OFF[idx % TOKEN_OFF.length];
                const cx = p.x + offset[0] * 0.55;
                const cy = p.y + offset[1] * 0.55;
                const isSelected = String(actor?._id || '') === String(hyperloopCharId || '');
                const hpRatio = Math.max(0, Math.min(1, Number(actor?.hp || 0) / Math.max(1, Number(actor?.maxHp || 100))));
                const tokenImg = String(actor?.previewImage || '/Images/default_image.png');
                const teamState = getTeamStateForActor?.(actor);
                const teamColor = teamState?.missingCount > 0
                  ? 'rgba(255, 180, 80, 0.94)'
                  : 'rgba(112, 221, 148, 0.94)';
                const tokenTitle = `${String(actor?.name || '캐릭터')} / HP ${Math.floor(Number(actor?.hp || 0))}/${Math.max(1, Math.floor(Number(actor?.maxHp || 100)))} / ${zoneName}`;

                return (
                  <g key={`a-${id}-${actor._id || idx}`} className={`minimap-character-token ${isSelected ? 'selected' : ''}`}>
                    <title>{tokenTitle}</title>
                    {isSelected ? (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={3.3}
                        fill="none"
                        stroke="rgba(255,215,0,0.92)"
                        strokeWidth="0.8"
                      />
                    ) : null}
                    <circle
                      cx={cx}
                      cy={cy}
                      r={2.65}
                      fill="rgba(8, 14, 24, 0.92)"
                      stroke={isSelected ? 'rgba(255,215,0,0.95)' : teamColor}
                      strokeWidth="0.55"
                    />
                    <image
                      href={tokenImg}
                      x={cx - 1.75}
                      y={cy - 1.75}
                      width="3.5"
                      height="3.5"
                      preserveAspectRatio="xMidYMid slice"
                    />
                    <path
                      d={`M ${cx - 2.55} ${cy + 2.95} H ${cx - 2.55 + (5.1 * hpRatio)}`}
                      className={hpRatio <= 0.32 ? 'minimap-token-hp critical' : 'minimap-token-hp'}
                    />
                    <text
                      x={cx}
                      y={cy + 5.8}
                      textAnchor="middle"
                      className="minimap-token-label"
                    >
                      {String(actor?.name || '?').slice(0, 2)}
                    </text>
                  </g>
                );
              })}

              {(deadByZone[id] || []).slice(0, 8).map((actor, idx) => {
                const offset = OFF[(idx + 2) % OFF.length];
                return (
                  <circle
                    key={`d-${id}-${actor._id || idx}`}
                    cx={p.x + offset[0] * 0.55}
                    cy={p.y + offset[1] * 0.55}
                    r={0.85}
                    fill="rgba(170,170,170,0.70)"
                    stroke="rgba(0,0,0,0.28)"
                    strokeWidth="0.35"
                  />
                );
              })}
            </g>
          );
        })}

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
      </svg>
    </div>
  );
}
