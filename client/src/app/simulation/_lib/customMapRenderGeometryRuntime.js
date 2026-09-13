const DEFAULT_VIEW_BOX = Object.freeze({ x: 0, y: 0, width: 100, height: 100 });
const CONTENT_PADDING = 10;

const zoneIdOf = (zone) => String(zone?.zoneId || zone?.id || zone?._id || '').trim();

function finitePoint(value) {
  const x = Array.isArray(value) ? Number(value[0]) : Number(value?.x);
  const y = Array.isArray(value) ? Number(value[1]) : Number(value?.y);
  return Number.isFinite(x) && Number.isFinite(y) ? [x, y] : null;
}

export function readZonePolygon(zone) {
  const points = (Array.isArray(zone?.polygon) ? zone.polygon : [])
    .map(finitePoint)
    .filter(Boolean);
  return points.length >= 3 ? points : [];
}

function readZoneCenter(zone) {
  const candidates = [zone?.position, zone?.center, zone?.mapPosition,
    zone?.x != null || zone?.y != null ? { x: zone?.x, y: zone?.y } : null];
  for (const candidate of candidates) {
    const point = finitePoint(candidate);
    if (point) return point;
  }
  return null;
}

function averagePoint(points) {
  if (!points.length) return null;
  const sum = points.reduce((acc, [x, y]) => [acc[0] + x, acc[1] + y], [0, 0]);
  return [sum[0] / points.length, sum[1] / points.length];
}

function buildNormalizer(points) {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const sourceWidth = Math.max(1, maxX - minX);
  const sourceHeight = Math.max(1, maxY - minY);
  const targetSize = 100 - CONTENT_PADDING * 2;
  const scale = Math.min(targetSize / sourceWidth, targetSize / sourceHeight);
  const usedWidth = sourceWidth * scale;
  const usedHeight = sourceHeight * scale;
  const offsetX = (100 - usedWidth) / 2;
  const offsetY = (100 - usedHeight) / 2;
  return ([x, y]) => [
    Number((offsetX + (x - minX) * scale).toFixed(3)),
    Number((offsetY + (y - minY) * scale).toFixed(3)),
  ];
}

function placeMissingPositions(missingIds, positions) {
  if (!missingIds.length) return;
  const radius = missingIds.length <= 2 ? 22 : missingIds.length <= 6 ? 30 : 36;
  missingIds.forEach((id, index) => {
    const angle = (-Math.PI / 2) + (Math.PI * 2 * index) / missingIds.length;
    positions[id] = {
      x: Number((50 + Math.cos(angle) * radius).toFixed(3)),
      y: Number((50 + Math.sin(angle) * radius).toFixed(3)),
    };
  });
}

export function buildCustomMapRenderGeometry(zones, zoneEdges = []) {
  const rows = (Array.isArray(zones) ? zones : [])
    .map((zone) => ({ id: zoneIdOf(zone), zone, polygon: readZonePolygon(zone), center: readZoneCenter(zone) }))
    .filter((row) => row.id);
  const explicitPoints = rows.flatMap((row) => row.polygon.length ? row.polygon : (row.center ? [row.center] : []));
  if (!explicitPoints.length) return null;

  const normalize = buildNormalizer(explicitPoints);
  const polygons = {};
  const positions = {};
  for (const row of rows) {
    if (row.polygon.length) {
      const polygon = row.polygon.map(normalize);
      polygons[row.id] = polygon;
      const center = averagePoint(polygon);
      positions[row.id] = { x: center[0], y: center[1] };
    } else if (row.center) {
      const [x, y] = normalize(row.center);
      positions[row.id] = { x, y };
    }
  }
  placeMissingPositions(rows.filter((row) => !positions[row.id]).map((row) => row.id).sort(), positions);

  const validIds = new Set(rows.map((row) => row.id));
  const seenEdges = new Set();
  const passages = [];
  for (const rawEdge of Array.isArray(zoneEdges) ? zoneEdges : []) {
    const [a, b] = Array.isArray(rawEdge) ? rawEdge.map(String) : [];
    if (!a || !b || a === b || !validIds.has(a) || !validIds.has(b) || !positions[a] || !positions[b]) continue;
    const edgeKey = a < b ? `${a}::${b}` : `${b}::${a}`;
    if (seenEdges.has(edgeKey)) continue;
    seenEdges.add(edgeKey);
    passages.push({ edge: [a, b], points: [[positions[a].x, positions[a].y], [positions[b].x, positions[b].y]] });
  }

  return {
    kind: 'custom',
    viewBox: { ...DEFAULT_VIEW_BOX },
    outline: [[2, 2], [98, 2], [98, 98], [2, 98]],
    polygons,
    positions,
    passages,
  };
}

export const CUSTOM_MAP_VIEW_BOX = DEFAULT_VIEW_BOX;
