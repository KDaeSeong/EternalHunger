import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { LUMIA_MINIMAP_REFERENCE_IMAGE, LUMIA_MINIMAP_VIEWBOX, LUMIA_ZONE_POS } from '../src/app/simulation/_lib/simulationConstants.js';
import { LUMIA_REFERENCE_ZONE_PIXELS, LUMIA_REFERENCE_ZONES, LUMIA_REFERENCE_LABEL_RECTS, referencePixelToPoint } from '../src/app/simulation/_lib/lumiaReferenceMapGeometry.js';
import { buildMinimapRegionPresentation, minimapTokenBounds, isMinimapFootprintInside } from '../src/app/simulation/_lib/minimapRegionLayoutRuntime.js';
import { isPointInsidePolygon } from '../src/app/simulation/_lib/lumiaMapRenderGeometryRuntime.js';

const image = await readFile(new URL(`../public${LUMIA_MINIMAP_REFERENCE_IMAGE.src}`, import.meta.url));
assert.equal(image.readUInt32BE(16), 728, 'reference PNG width');
assert.equal(image.readUInt32BE(20), 789, 'reference PNG height');
assert.equal(Object.keys(LUMIA_REFERENCE_ZONES).length, 21);
const toImage = ({x, y}) => ({
  x: LUMIA_MINIMAP_REFERENCE_IMAGE.mapBounds.x + x / LUMIA_MINIMAP_VIEWBOX.width * LUMIA_MINIMAP_REFERENCE_IMAGE.mapBounds.width,
  y: LUMIA_MINIMAP_REFERENCE_IMAGE.mapBounds.y + y / LUMIA_MINIMAP_VIEWBOX.height * LUMIA_MINIMAP_REFERENCE_IMAGE.mapBounds.height,
});
for (const pixel of [[0, 0], [43, 81], [728, 789], [323, 597], [430, 636]]) {
  const result = toImage(referencePixelToPoint(pixel));
  assert.ok(Math.abs(result.x - pixel[0]) < .001 && Math.abs(result.y - pixel[1]) < .001, 'background and overlays must use exactly the same image transform');
}

const roster = (count, solo = false) => Array.from({ length: count }, (_, index) => Object.freeze({
  _id: `actor-${index}`, name: `참가자 ${index}`, hp: index % 2 ? 18 : 100, maxHp: 100,
  ...(solo ? {} : {teamId: `team:${Math.floor(index / 3) + 1}`, teamName: `${Math.floor(index / 3) + 1}팀`}),
}));
let placements = 0;
let crowdedRegions = 0;
for (const [id, zone] of Object.entries(LUMIA_REFERENCE_ZONES)) {
  assert.equal(isPointInsidePolygon(zone.anchor, zone.polygon), true, `${id}: display anchor must belong to its region`);
  const imageAnchor = toImage(zone.anchor);
  assert.ok(Math.abs(imageAnchor.x - LUMIA_REFERENCE_ZONE_PIXELS[id].anchor[0]) < .001 && Math.abs(imageAnchor.y - LUMIA_REFERENCE_ZONE_PIXELS[id].anchor[1]) < .001, `${id}: reference-pixel anchor round trip`);
  for (const actors of [roster(1), roster(3), roster(9), roster(24), roster(24, true), roster(36)]) {
    const snapshot = JSON.stringify(actors);
    const tracked = new Set(actors.slice(0, 3).map((row) => row._id));
    const rows = buildMinimapRegionPresentation(actors, tracked, zone, LUMIA_REFERENCE_LABEL_RECTS, actors.slice(0, 24));
    assert.ok(rows?.length, `${id}: no occupied zone may silently lose all markers`);
    assert.deepEqual(rows.flatMap((row) => row.actors).map((actor) => actor._id).sort(), actors.map((row) => row._id).sort(), `${id}: all participants must be represented, including overflow`);
    for (const row of rows) {
      assert.equal(isMinimapFootprintInside(row, row.scale, minimapTokenBounds(row), zone.polygon, LUMIA_REFERENCE_LABEL_RECTS), true, `${id}: full marker stays in its region and off every region name`);
      assert.ok(row.scale >= .65, `${id}: do not turn crowded markers into illegible dots`);
      if (row.regionSummary) crowdedRegions += 1;
      placements += 1;
    }
    rows.forEach((row, index) => {
      const a = minimapTokenBounds(row);
      for (const other of rows.slice(index + 1)) {
        const b = minimapTokenBounds(other);
        assert.ok(row.x + a.right * row.scale <= other.x + b.left * other.scale + .001
          || row.x + a.left * row.scale >= other.x + b.right * other.scale - .001
          || row.y + a.bottom * row.scale <= other.y + b.top * other.scale + .001
          || row.y + a.top * row.scale >= other.y + b.bottom * other.scale - .001,
        `${id}: marker badges, tracked HP captions, and bars must not overlap`);
      }
    });
    assert.equal(JSON.stringify(actors), snapshot, 'rendering must not write HP or team state');
    assert.deepEqual(buildMinimapRegionPresentation(actors, tracked, zone, LUMIA_REFERENCE_LABEL_RECTS, actors.slice(0, 24)), rows, 'cached geometry must preserve current actor state and deterministic placement');
  }
}

// Coastal nameplates sometimes sit outside the island. An interior nameplate
// must never fall into a DIFFERENT region's alert area (hotel / port regression).
Object.entries(LUMIA_REFERENCE_ZONES).forEach(([id], index) => {
  const box = LUMIA_REFERENCE_LABEL_RECTS[index];
  const center = [(box.min.x + box.max.x) / 2, (box.min.y + box.max.y) / 2];
  for (const [otherId, other] of Object.entries(LUMIA_REFERENCE_ZONES)) {
    if (id !== otherId) assert.equal(isPointInsidePolygon(center, other.polygon), false, `${id} name must not be painted as ${otherId}`);
  }
  if (['hotel', 'port'].includes(id)) assert.equal(isPointInsidePolygon(center, LUMIA_REFERENCE_ZONES[id].polygon), true);
});

// Independent containment probe: no display area may paint another region.
// This does NOT establish pixel-exact terrain fidelity; visual review is separate.
for (let y = 0; y < 103; y += .5) for (let x = 0; x < 100; x += .5) {
  assert.ok(Object.values(LUMIA_REFERENCE_ZONES).filter((zone) => isPointInsidePolygon([x, y], zone.polygon)).length <= 1, `overlapping alert regions at ${x},${y}`);
}
assert.notDeepEqual(LUMIA_REFERENCE_ZONES.warehouse.anchor, LUMIA_ZONE_POS.warehouse, 'display must not reuse legacy inset navigation nodes');
const canvas = await readFile(new URL('../src/app/simulation/_components/SimulationMinimapCanvas.js', import.meta.url), 'utf8');
assert.match(canvas, /customGeometry\?\.polygons \|\| LUMIA_REFERENCE_POLYGONS/);
assert.match(canvas, /customGeometry \? shrinkPolygon\(polygon, positions\?\.\[id\], 0\.82\) : polygon/);
assert.match(canvas, /buildMinimapRegionPresentation\(actors, trackedSet, geometry/);
assert.match(canvas, /minimap-region-roster/);
console.log(JSON.stringify({ regions: 21, rosterScenarios: 126, placements, readableCrowdSummaries: crowdedRegions, imageTransformRoundTrip: true, regionMembership: true, labelClearance: true, sourceSurveyVisualAcceptance: 'requires separate browser review' }, null, 2));
