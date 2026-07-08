'use client';

import { LUMIA_ISLAND_OUTLINE, LUMIA_ZONE_POLYGONS } from '../_lib/simulationConstants';

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

export default function SimulationMinimapCanvas({
  activeMapId,
  dead,
  forbiddenNow,
  getTeamStateForActor,
  getZoneName,
  hyperloopCharId,
  hyperloopZoneSet,
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
  const aliveByZone = groupActorsByZone(survivors, activeMapId);
  const deadByZone = groupActorsByZone(dead, activeMapId);
  const hyperloopSelectedChar = safeArray(survivors).find((actor) => String(actor?._id) === String(hyperloopCharId)) || null;
  const selectedZoneId = hyperloopSelectedChar ? String(hyperloopSelectedChar?.zoneId || '') : '';
  const positions = zonePos && typeof zonePos === 'object' ? zonePos : {};
  const availableZoneIds = new Set(zoneList.map((zone) => String(zone?.zoneId || '')).filter(Boolean));

  return (
    <div className="minimap-canvas">
      <svg className="minimap-svg" viewBox="0 0 100 100" role="img" aria-label="미니맵">
        <polygon
          className="minimap-island-outline"
          points={polygonPoints(LUMIA_ISLAND_OUTLINE)}
        />

        {Object.entries(LUMIA_ZONE_POLYGONS).map(([id, polygon]) => {
          if (!availableZoneIds.has(id)) return null;
          const isForbidden = forbiddenSet.has(id);
          const zoneName = String(getZoneName?.(id) || id);
          return (
            <polygon
              key={`area-${id}`}
              points={polygonPoints(polygon)}
              className={`minimap-zone-area ${isForbidden ? 'forbidden' : ''}`}
            >
              <title>{zoneName}</title>
            </polygon>
          );
        })}

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

        {safeArray(zoneEdges).map(([a, b]) => {
          const pa = positions?.[a];
          const pb = positions?.[b];
          if (!pa || !pb) return null;
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

        {zoneList.map((zone) => {
          const id = String(zone?.zoneId || '');
          const p = positions?.[id];
          if (!id || !p) return null;

          const isForbidden = forbiddenSet.has(id);
          const isSelectedZone = !!selectedZoneId && selectedZoneId === id;
          const zoneName = String(getZoneName?.(id) || id);
          const aliveHere = aliveByZone[id]?.length || 0;
          const deadHere = deadByZone[id]?.length || 0;
          const nodeR = 4.8;
          const labelSize = zoneName.length >= 6 ? 2.05 : zoneName.length >= 5 ? 2.3 : 2.65;
          const hasHyperloop = hyperloopSet.has(id);

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
                <text x={p.x + nodeR} y={p.y - 4.2} textAnchor="middle" fontSize="5.0" fill="rgba(180,220,255,0.92)">🌀</text>
              ) : null}

              {(aliveHere > 0 || deadHere > 0) ? (
                <text
                  x={p.x}
                  y={p.y + 5.8}
                  textAnchor="middle"
                  fontSize="3.0"
                  fill="rgba(255,255,255,0.72)"
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

        {safeArray(recentPings).map((ping) => {
          const p = positions?.[String(ping?.zoneId || '')];
          if (!p) return null;
          return (
            <g
              key={`ping-${ping.id}`}
              className={`minimap-ping ${String(ping.kind || '')}`}
              transform={`translate(${p.x} ${p.y})`}
            >
              <circle r="6.8" />
              <text className="minimap-ping-icon" x="0" y="1.5" textAnchor="middle">
                {ping.icon}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
