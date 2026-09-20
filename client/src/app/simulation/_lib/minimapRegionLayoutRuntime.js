import { isPointInsidePolygon } from './lumiaMapRenderGeometryRuntime.js';
import { getMinimapTeamPresentation, layoutMinimapZoneActors } from './minimapTeamPresentationRuntime.js';

const placementCache = new Map();
const MAX_CACHE_ENTRIES = 256;

export function minimapTokenBounds(layout) {
  return layout.tracked && !layout.aggregate
    ? { left: -3.45, right: 3.45, top: -3.6, bottom: 5.3 }
    : { left: -3.45, right: 3.45, top: -3.45, bottom: 3.6 };
}

export function isMinimapFootprintInside(point, scale, bounds, polygon, excluded = []) {
  const minX = point.x + bounds.left * scale;
  const maxX = point.x + bounds.right * scale;
  const minY = point.y + bounds.top * scale;
  const maxY = point.y + bounds.bottom * scale;
  if (excluded.some((box) => minX < box.max.x && maxX > box.min.x && minY < box.max.y && maxY > box.min.y)) return false;
  // Check the edges as well as corners: a concave coast can enter a rectangle.
  for (let step = 0; step <= 4; step += 1) {
    const ratio = step / 4;
    const x = minX + (maxX - minX) * ratio;
    const y = minY + (maxY - minY) * ratio;
    for (const sample of [[x, minY], [x, maxY], [minX, y], [maxX, y]]) {
      if (!isPointInsidePolygon(sample, polygon)) return false;
    }
  }
  return true;
}

// Fit a formation, then pack a dense region if necessary. Never pull an actor
// towards the centre of the whole island or into a neighbouring region.
// The cache stores geometry only (no actor / HP / game state).
export function placeMinimapRegionLayout(layout, zone, excluded = []) {
  if (!layout.length || !zone?.polygon?.length || !zone?.anchor) return [];
  const footprints = layout.map(minimapTokenBounds);
  const signature = JSON.stringify([zone, excluded, layout.map((row, index) => [row.dx, row.dy, footprints[index]])]);
  let transform = placementCache.get(signature);
  if (!transform) {
    const xs = zone.polygon.map(([x]) => x);
    const ys = zone.polygon.map(([, y]) => y);
    const candidates = [zone.anchor];
    for (let y = Math.min(...ys) + 1; y < Math.max(...ys); y += 1.2) {
      for (let x = Math.min(...xs) + 1; x < Math.max(...xs); x += 1.2) {
        if (isPointInsidePolygon([x, y], zone.polygon)) candidates.push({ x, y });
      }
    }
    candidates.sort((a, b) => Math.hypot(a.x - zone.anchor.x, a.y - zone.anchor.y) - Math.hypot(b.x - zone.anchor.x, b.y - zone.anchor.y));
    search: for (const scale of [1, .95, .9, .85, .8, .75, .7]) {
      for (const point of candidates) {
        if (layout.every((row, index) => isMinimapFootprintInside({
          x: point.x + row.dx * scale, y: point.y + row.dy * scale,
        }, scale, footprints[index], zone.polygon, excluded))) {
          transform = layout.map((row) => ({ x: point.x + row.dx * scale, y: point.y + row.dy * scale, scale }));
          break search;
        }
      }
    }
    if (!transform) {
      packing: for (const scale of [1, .9, .8, .7, .65, .6, .55, .5]) {
        const candidatesBySize = new Map();
        const valid = footprints.map((bounds) => {
          const key = JSON.stringify(bounds);
          if (!candidatesBySize.has(key)) candidatesBySize.set(key, candidates.filter((point) => isMinimapFootprintInside(point, scale, bounds, zone.polygon, excluded)));
          return candidatesBySize.get(key);
        });
        // Alternate scan directions avoid a central first marker consuming all
        // the space in a narrow, diagonal region. No RNG or game-state writes.
        for (const [axis, sign] of [['y', 1], ['y', -1], ['x', 1], ['x', -1]]) {
          const placed = [];
          for (let index = 0; index < layout.length; index += 1) {
            const bounds = footprints[index];
            const ordered = [...valid[index]].sort((a, b) => sign * (a[axis] - b[axis]) || a.x - b.x || a.y - b.y);
            const point = ordered.find((candidate) => placed.every((other, otherIndex) => {
              const otherBounds = footprints[otherIndex];
              return candidate.x + bounds.right * scale <= other.x + otherBounds.left * scale
                || candidate.x + bounds.left * scale >= other.x + otherBounds.right * scale
                || candidate.y + bounds.bottom * scale <= other.y + otherBounds.top * scale
                || candidate.y + bounds.top * scale >= other.y + otherBounds.bottom * scale;
            }));
            if (!point) break;
            placed.push({ ...point, scale });
          }
          if (placed.length === layout.length) { transform = placed; break packing; }
        }
      }
    }
    if (!transform) return null;
    if (placementCache.size >= MAX_CACHE_ENTRIES) placementCache.delete(placementCache.keys().next().value);
    placementCache.set(signature, transform);
  }
  return layout.map((row, index) => ({ ...row, ...transform[index] }));
}

export function buildMinimapRegionPresentation(actors, tracked, zone, excluded, visibleActors = actors) {
  if (!actors.length) return [];
  const placed = placeMinimapRegionLayout(layoutMinimapZoneActors(visibleActors, tracked), zone, excluded);
  if (actors.length === visibleActors.length && placed?.every((row) => row.scale >= .7)) return placed;
  const grouped = placeMinimapRegionLayout(layoutMinimapZoneActors(visibleActors, tracked, 24, { aggregateTeams: true }), zone, excluded);
  if (actors.length === visibleActors.length && grouped?.every((row) => row.scale >= .65)) return grouped;
  const summary = [{ actor: actors[0], actors, count: actors.length, dx: 0, dy: 0, aggregate: true,
    regionSummary: true, tracked: actors.some((actor) => tracked.has(String(actor?._id || actor?.id || ''))),
    solo: actors.every((actor) => getMinimapTeamPresentation(actor).solo),
    teamCount: new Set(actors.map((actor) => getMinimapTeamPresentation(actor).teamId)).size,
  }];
  return placeMinimapRegionLayout(summary, zone, excluded) || [];
}
