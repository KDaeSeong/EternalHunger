// Keep the complete visual footprint inside the island, not only each point's center.
// A character token and its label can extend roughly 6.3 viewBox units from a zone node.
const DEFAULT_NODE_INSET = 7.2;
const DEFAULT_ROUTE_INSET = 1.15;
const DEFAULT_MARKER_INSET = 2.2;

function toPoint(value) {
  if (Array.isArray(value) && value.length >= 2) {
    const x = Number(value[0]);
    const y = Number(value[1]);
    return Number.isFinite(x) && Number.isFinite(y) ? [x, y] : null;
  }
  if (value && typeof value === 'object') {
    const x = Number(value.x);
    const y = Number(value.y);
    return Number.isFinite(x) && Number.isFinite(y) ? [x, y] : null;
  }
  return null;
}

function safePolygon(value) {
  return (Array.isArray(value) ? value : []).map(toPoint).filter(Boolean);
}

function roundPoint([x, y]) {
  return [Number(x.toFixed(3)), Number(y.toFixed(3))];
}

function pointDistance(a, b) {
  return Math.hypot(Number(a?.[0] || 0) - Number(b?.[0] || 0), Number(a?.[1] || 0) - Number(b?.[1] || 0));
}

function distanceToSegment(point, start, end) {
  const [px, py] = point;
  const [x1, y1] = start;
  const [x2, y2] = end;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSq = (dx * dx) + (dy * dy);
  const t = lengthSq > 0
    ? Math.max(0, Math.min(1, (((px - x1) * dx) + ((py - y1) * dy)) / lengthSq))
    : 0;
  return Math.hypot(px - (x1 + (dx * t)), py - (y1 + (dy * t)));
}

export function isPointInsidePolygon(value, polygonValue) {
  const point = toPoint(value);
  const polygon = safePolygon(polygonValue);
  if (!point || polygon.length < 3) return false;
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const crosses = (yi > y) !== (yj > y);
    if (crosses && x < (((xj - xi) * (y - yi)) / (yj - yi)) + xi) inside = !inside;
  }
  return inside;
}

export function getDistanceToPolygonBoundary(value, polygonValue) {
  const point = toPoint(value);
  const polygon = safePolygon(polygonValue);
  if (!point || polygon.length < 2) return 0;
  return Math.min(...polygon.map((start, index) => (
    distanceToSegment(point, start, polygon[(index + 1) % polygon.length])
  )));
}

function findInteriorTarget(polygon) {
  const xs = polygon.map(([x]) => x);
  const ys = polygon.map(([, y]) => y);
  const boundsCenter = [
    (Math.min(...xs) + Math.max(...xs)) / 2,
    (Math.min(...ys) + Math.max(...ys)) / 2,
  ];
  if (isPointInsidePolygon(boundsCenter, polygon)) return boundsCenter;

  const average = [
    polygon.reduce((sum, [x]) => sum + x, 0) / polygon.length,
    polygon.reduce((sum, [, y]) => sum + y, 0) / polygon.length,
  ];
  return isPointInsidePolygon(average, polygon) ? average : polygon[0];
}

export function insetPointWithinPolygon(value, polygonValue, minimumDistance = 0) {
  const point = toPoint(value);
  const polygon = safePolygon(polygonValue);
  if (!point || polygon.length < 3) return point || [0, 0];
  const inset = Math.max(0, Number(minimumDistance || 0));
  if (isPointInsidePolygon(point, polygon) && getDistanceToPolygonBoundary(point, polygon) >= inset) {
    return roundPoint(point);
  }

  const target = findInteriorTarget(polygon);
  for (let step = 1; step <= 240; step += 1) {
    const ratio = step / 240;
    const candidate = [
      point[0] + ((target[0] - point[0]) * ratio),
      point[1] + ((target[1] - point[1]) * ratio),
    ];
    if (isPointInsidePolygon(candidate, polygon)
      && getDistanceToPolygonBoundary(candidate, polygon) >= inset) {
      return roundPoint(candidate);
    }
  }
  return roundPoint(target);
}

export function createLumiaRenderPositions(positions, outline, minimumDistance = DEFAULT_NODE_INSET) {
  return Object.fromEntries(
    Object.entries(positions && typeof positions === 'object' ? positions : {}).flatMap(([zoneId, value]) => {
      const point = toPoint(value);
      if (!point) return [];
      const [x, y] = insetPointWithinPolygon(point, outline, minimumDistance);
      return [[zoneId, { x, y }]];
    })
  );
}

export function createLumiaRenderMarkers(markers, outline, minimumDistance = DEFAULT_MARKER_INSET) {
  return createLumiaRenderPositions(markers, outline, minimumDistance);
}

function dedupeAdjacentPoints(points) {
  return points.filter((point, index) => index === 0 || pointDistance(point, points[index - 1]) > 0.015);
}

function segmentLeavesPolygon(start, end, polygon, minimumDistance) {
  for (let step = 0; step <= 16; step += 1) {
    const ratio = step / 16;
    const sample = [
      start[0] + ((end[0] - start[0]) * ratio),
      start[1] + ((end[1] - start[1]) * ratio),
    ];
    if (!isPointInsidePolygon(sample, polygon)
      || getDistanceToPolygonBoundary(sample, polygon) < minimumDistance) return true;
  }
  return false;
}

function constrainPolylineToPolygon(points, polygon, minimumDistance) {
  if (points.length < 2) return points;
  const constrained = [points[0]];
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    if (!segmentLeavesPolygon(start, end, polygon, minimumDistance)) {
      constrained.push(end);
      continue;
    }

    const steps = Math.max(2, Math.ceil(pointDistance(start, end) / 0.72));
    for (let step = 1; step <= steps; step += 1) {
      const ratio = step / steps;
      const sample = [
        start[0] + ((end[0] - start[0]) * ratio),
        start[1] + ((end[1] - start[1]) * ratio),
      ];
      constrained.push(insetPointWithinPolygon(sample, polygon, minimumDistance));
    }
  }
  return dedupeAdjacentPoints(constrained);
}

export function createLumiaConnectedPassages(
  segments,
  positions,
  outline,
  minimumDistance = DEFAULT_ROUTE_INSET
) {
  return (Array.isArray(segments) ? segments : []).flatMap((segment) => {
    const [fromZoneId, toZoneId] = Array.isArray(segment?.edge) ? segment.edge.map(String) : [];
    const start = toPoint(positions?.[fromZoneId]);
    const end = toPoint(positions?.[toZoneId]);
    if (!fromZoneId || !toZoneId || !start || !end) return [];

    const sourcePoints = (Array.isArray(segment?.points) ? segment.points : []).map(toPoint).filter(Boolean);
    const forwardCost = sourcePoints.length
      ? pointDistance(start, sourcePoints[0]) + pointDistance(end, sourcePoints[sourcePoints.length - 1])
      : 0;
    const reverseCost = sourcePoints.length
      ? pointDistance(start, sourcePoints[sourcePoints.length - 1]) + pointDistance(end, sourcePoints[0])
      : 0;
    if (reverseCost < forwardCost) sourcePoints.reverse();

    const tracedPoints = sourcePoints
      .map((point) => insetPointWithinPolygon(point, outline, minimumDistance));
    if (!tracedPoints.length) tracedPoints.push(start, end);

    if (pointDistance(start, tracedPoints[0]) <= 0.015) tracedPoints[0] = start;
    else tracedPoints.unshift(start);
    if (pointDistance(end, tracedPoints[tracedPoints.length - 1]) <= 0.015) {
      tracedPoints[tracedPoints.length - 1] = end;
    } else {
      tracedPoints.push(end);
    }

    const connectedPoints = constrainPolylineToPolygon(tracedPoints, outline, minimumDistance);

    return [{
      ...segment,
      edge: [fromZoneId, toZoneId],
      points: dedupeAdjacentPoints(connectedPoints.map(roundPoint)),
    }];
  });
}

export const LUMIA_RENDER_GEOMETRY_DEFAULTS = Object.freeze({
  nodeInset: DEFAULT_NODE_INSET,
  routeInset: DEFAULT_ROUTE_INSET,
  markerInset: DEFAULT_MARKER_INSET,
});
