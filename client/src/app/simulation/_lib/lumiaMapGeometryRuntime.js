import { LUMIA_ZONE_POLYGONS, LUMIA_ZONE_POS } from './simulationConstants';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function safePoints(points) {
  return (Array.isArray(points) ? points : [])
    .map((point) => {
      if (!Array.isArray(point) || point.length < 2) return null;
      const x = Number(point[0]);
      const y = Number(point[1]);
      return Number.isFinite(x) && Number.isFinite(y) ? [x, y] : null;
    })
    .filter(Boolean);
}

export function polygonArea(points) {
  const rows = safePoints(points);
  if (rows.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < rows.length; i += 1) {
    const [x1, y1] = rows[i];
    const [x2, y2] = rows[(i + 1) % rows.length];
    sum += (x1 * y2) - (x2 * y1);
  }
  return Math.abs(sum) / 2;
}

export const LUMIA_ZONE_AREAS = Object.freeze(
  Object.fromEntries(
    Object.entries(LUMIA_ZONE_POLYGONS).map(([zoneId, polygon]) => [zoneId, polygonArea(polygon)])
  )
);

export const LUMIA_AVERAGE_ZONE_AREA = (() => {
  const values = Object.values(LUMIA_ZONE_AREAS).filter((area) => Number(area) > 0);
  if (!values.length) return 1;
  return values.reduce((sum, area) => sum + area, 0) / values.length;
})();

export function getLumiaZoneArea(zoneId) {
  return Math.max(0, Number(LUMIA_ZONE_AREAS[String(zoneId || '')] || 0));
}

export function getLumiaZoneAreaWeight(zoneId) {
  const area = getLumiaZoneArea(zoneId);
  if (!area || !LUMIA_AVERAGE_ZONE_AREA) return 1;
  return clamp(area / LUMIA_AVERAGE_ZONE_AREA, 0.55, 1.6);
}

export function getLumiaZoneTravelAreaWeight(zoneId) {
  const weight = getLumiaZoneAreaWeight(zoneId);
  return clamp(1 + ((weight - 1) * 0.45), 0.72, 1.35);
}

export function getLumiaZoneSearchDensityWeight(zoneId) {
  const weight = getLumiaZoneAreaWeight(zoneId);
  return clamp(1 + ((weight - 1) * 0.22), 0.88, 1.14);
}

export function getLumiaZoneDistance(fromZoneId, toZoneId) {
  const from = LUMIA_ZONE_POS[String(fromZoneId || '')];
  const to = LUMIA_ZONE_POS[String(toZoneId || '')];
  if (!from || !to) return 0;
  const dx = Number(to.x || 0) - Number(from.x || 0);
  const dy = Number(to.y || 0) - Number(from.y || 0);
  return Math.sqrt((dx * dx) + (dy * dy));
}

export function getLumiaWalkEtaSec(fromZoneId, toZoneId, opts = {}) {
  const from = String(fromZoneId || '');
  const to = String(toZoneId || '');
  if (!from || !to || from === to) return 1;

  const distance = getLumiaZoneDistance(from, to);
  if (!distance) return 1;

  const baseDistance = Math.max(10, Number(opts.baseDistance ?? 18));
  const distanceWeight = clamp(distance / baseDistance, 0.8, 1.6);
  const areaWeight = (getLumiaZoneTravelAreaWeight(from) + getLumiaZoneTravelAreaWeight(to)) / 2;
  const raw = 1 + ((distanceWeight * areaWeight) - 0.7);
  return Math.max(1, Math.min(3, Math.ceil(raw)));
}
